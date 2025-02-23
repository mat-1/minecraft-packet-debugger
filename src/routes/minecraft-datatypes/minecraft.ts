'use strict'

import * as pnbt from '../nbt/nbt'
import * as uuid from 'uuid'
import gzip from 'gzip-js'
import { types as protoTypes, utils } from '../protodef'
const [readVarInt, writeVarInt, sizeOfVarInt] = protoTypes.varint
import { Buffer } from 'buffer'

export const varlong = [readVarLong, writeVarLong, sizeOfVarLong]
export const UUID = [readUUID, writeUUID, 16]
export const nbt = [readNbt, writeNbt, sizeOfNbt]
export const optionalNbt = [readOptionalNbt, writeOptionalNbt, sizeOfOptionalNbt]
export const compressedNbt = [readCompressedNbt, writeCompressedNbt, sizeOfCompressedNbt]
export const restBuffer = [readRestBuffer, writeRestBuffer, sizeOfRestBuffer]
export const entityMetadataLoop = [readEntityMetadata, writeEntityMetadata, sizeOfEntityMetadata]
export const topBitSetTerminatedArray = [
	readTopBitSetTerminatedArray,
	writeTopBitSetTerminatedArray,
	sizeOfTopBitSetTerminatedArray
]

const PartialReadError = utils.PartialReadError

function readVarLong(buffer, offset) {
	return readVarInt(buffer, offset)
}

function writeVarLong(value, buffer, offset) {
	return writeVarInt(value, buffer, offset)
}

function sizeOfVarLong(value) {
	return sizeOfVarInt(value)
}

function readUUID(buffer, offset) {
	if (offset + 16 > buffer.length) {
		throw new PartialReadError()
	}
	return {
		value: uuid.stringify(buffer.slice(offset, 16 + offset)),
		size: 16
	}
}

function writeUUID(value, buffer, offset) {
	const buf = value.length === 32 ? Buffer.from(value, 'hex') : uuid.parse(value)
	buf.copy(buffer, offset)
	return offset + 16
}

function readNbt(buffer, offset, typeArgs, context, history: any[]) {
	return pnbt.proto.read(buffer, offset, 'nbt', undefined, history)
}

function writeNbt(value, buffer, offset) {
	return pnbt.proto.write(value, buffer, offset, 'nbt')
}

function sizeOfNbt(value) {
	return pnbt.proto.sizeOf(value, 'nbt')
}

function readOptionalNbt(buffer, offset) {
	if (offset + 1 > buffer.length) {
		throw new PartialReadError()
	}
	if (buffer.readInt8(offset) === 0) return { size: 1 }
	return pnbt.proto.read(buffer, offset, 'nbt')
}

function writeOptionalNbt(value, buffer, offset) {
	if (value === undefined) {
		buffer.writeInt8(0, offset)
		return offset + 1
	}
	return pnbt.proto.write(value, buffer, offset, 'nbt')
}

function sizeOfOptionalNbt(value) {
	if (value === undefined) {
		return 1
	}
	return pnbt.proto.sizeOf(value, 'nbt')
}

// Length-prefixed compressed NBT, see differences: http://wiki.vg/index.php?title=Slot_Data&diff=6056&oldid=4753
function readCompressedNbt(buffer, offset) {
	if (offset + 2 > buffer.length) {
		throw new PartialReadError()
	}
	const length = buffer.readInt16BE(offset)
	if (length === -1) return { size: 2 }
	if (offset + 2 + length > buffer.length) {
		throw new PartialReadError()
	}

	const compressedNbt = buffer.slice(offset + 2, offset + 2 + length)

	const nbtBuffer = gzip.unzip(compressedNbt) // TODO: async

	const results = pnbt.proto.read(nbtBuffer, 0, 'nbt')
	return {
		size: length + 2,
		value: results.value
	}
}

function writeCompressedNbt(value, buffer: Buffer, offset) {
	if (value === undefined) {
		buffer.writeInt16BE(-1, offset)
		return offset + 2
	}
	const nbtBuffer = Buffer.alloc(sizeOfNbt(value))
	pnbt.proto.write(value, nbtBuffer, 0, 'nbt')

	const compressedNbt = Buffer.from(gzip.unzip(nbtBuffer)) // TODO: async
	compressedNbt.writeUInt8(0, 9) // clear the OS field to match MC

	buffer.writeInt16BE(compressedNbt.length, offset)
	compressedNbt.copy(buffer, offset + 2)
	return offset + 2 + compressedNbt.length
}

function sizeOfCompressedNbt(value) {
	if (value === undefined) {
		return 2
	}

	const nbtBuffer = Buffer.alloc(sizeOfNbt(value))
	pnbt.proto.write(value, nbtBuffer, 0, 'nbt')

	const compressedNbt = gzip.zip(nbtBuffer) // TODO: async

	return 2 + compressedNbt.length
}

function readRestBuffer(buffer, offset) {
	return {
		value: buffer.slice(offset),
		size: buffer.length - offset
	}
}

function writeRestBuffer(value, buffer, offset) {
	value.copy(buffer, offset)
	return offset + value.length
}

function sizeOfRestBuffer(value) {
	return value.length
}

function readEntityMetadata(buffer, offset, { type, endVal }) {
	let cursor = offset
	const metadata = []
	let item
	while (true) {
		if (offset + 1 > buffer.length) {
			throw new PartialReadError()
		}
		item = buffer.readUInt8(cursor)
		if (item === endVal) {
			return {
				value: metadata,
				size: cursor + 1 - offset
			}
		}
		const results = this.read(buffer, cursor, type, {})
		metadata.push(results.value)
		cursor += results.size
	}
}

function writeEntityMetadata(value, buffer, offset, { type, endVal }) {
	const self = this
	value.forEach(function (item) {
		offset = self.write(item, buffer, offset, type, {})
	})
	buffer.writeUInt8(endVal, offset)
	return offset + 1
}

function sizeOfEntityMetadata(value, { type }) {
	let size = 1
	for (let i = 0; i < value.length; ++i) {
		size += this.sizeOf(value[i], type, {})
	}
	return size
}

function readTopBitSetTerminatedArray(buffer, offset, { type }) {
	let cursor = offset
	const values = []
	let item
	while (true) {
		if (offset + 1 > buffer.length) {
			throw new PartialReadError()
		}
		item = buffer.readUInt8(cursor)
		buffer[cursor] = buffer[cursor] & 127 // removes top bit
		const results = this.read(buffer, cursor, type, {})
		values.push(results.value)
		cursor += results.size
		if ((item & 128) === 0) {
			// check if top bit is set, if not last value
			return {
				value: values,
				size: cursor - offset
			}
		}
	}
}

function writeTopBitSetTerminatedArray(value, buffer, offset, { type }) {
	const self = this
	let prevOffset = offset
	value.forEach(function (item, i) {
		prevOffset = offset
		offset = self.write(item, buffer, offset, type, {})
		buffer[prevOffset] = i !== value.length - 1 ? buffer[prevOffset] | 128 : buffer[prevOffset] // set top bit for all values but last
	})
	return offset
}

function sizeOfTopBitSetTerminatedArray(value, { type }) {
	let size = 0
	for (let i = 0; i < value.length; ++i) {
		size += this.sizeOf(value[i], type, {})
	}
	return size
}
