import { getCount, sendCount, calcCount, PartialReadError } from '../utils'
import utilsSchema from '../schemas/utils.json'

export const varint = [readVarInt, writeVarInt, sizeOfVarInt, utilsSchema.varint]
export const bool = [readBool, writeBool, 1, utilsSchema.bool]
export const pstring = [readPString, writePString, sizeOfPString, utilsSchema.pstring]
export const buffer = [readBuffer, writeBuffer, sizeOfBuffer, utilsSchema.buffer]
export const void_ = [readVoid, writeVoid, 0, utilsSchema.void]
export const bitfield = [readBitField, writeBitField, sizeOfBitField, utilsSchema.bitfield]
export const cstring = [readCString, writeCString, sizeOfCString, utilsSchema.cstring]
export const mapper = [readMapper, writeMapper, sizeOfMapper, utilsSchema.mapper]

function mapperEquality(a, b) {
	return a === b || parseInt(a) === parseInt(b)
}

function readMapper(buffer: Buffer, offset: number, { type, mappings }, rootNode, history: any[]) {
	const { size, value } = this.read(buffer, offset, type, rootNode, history)
	let mappedValue = null
	const keys = Object.keys(mappings)
	for (let i = 0; i < keys.length; i++) {
		if (mapperEquality(keys[i], value)) {
			mappedValue = mappings[keys[i]]
			break
		}
	}
	if (mappedValue == null) throw new Error(value + ' is not in the mappings value')
	return {
		size: size,
		value: mappedValue
	}
}

function writeMapper(value, buffer, offset, { type, mappings }, rootNode) {
	const keys = Object.keys(mappings)
	let mappedValue = null
	for (let i = 0; i < keys.length; i++) {
		if (mapperEquality(mappings[keys[i]], value)) {
			mappedValue = keys[i]
			break
		}
	}
	if (mappedValue == null) throw new Error(value + ' is not in the mappings value')
	return this.write(mappedValue, buffer, offset, type, rootNode)
}

function sizeOfMapper(value, { type, mappings }, rootNode) {
	const keys = Object.keys(mappings)
	let mappedValue = null
	for (let i = 0; i < keys.length; i++) {
		if (mapperEquality(mappings[keys[i]], value)) {
			mappedValue = keys[i]
			break
		}
	}
	if (mappedValue == null) throw new Error(value + ' is not in the mappings value')
	return this.sizeOf(mappedValue, type, rootNode)
}

function readVarInt(buffer: Buffer, offset: number) {
	let result = 0
	let shift = 0
	let cursor = offset

	while (true) {
		if (cursor + 1 > buffer.length) {
			throw new PartialReadError()
		}
		const b = buffer.readUInt8(cursor)
		result |= (b & 0x7f) << shift // Add the bits to our number, except MSB
		cursor++
		if (!(b & 0x80)) {
			// If the MSB is not set, we return the number
			return {
				value: result,
				size: cursor - offset
			}
		}
		shift += 7 // we only have 7 bits, MSB being the return-trigger
		if (shift >= 64)
			// Make sure our shift don't overflow.
			throw Error('varint is too big')
	}
}

function sizeOfVarInt(value) {
	let cursor = 0
	while (value & ~0x7f) {
		value >>>= 7
		cursor++
	}
	return cursor + 1
}

function writeVarInt(value, buffer, offset) {
	let cursor = 0
	while (value & ~0x7f) {
		buffer.writeUInt8((value & 0xff) | 0x80, offset + cursor)
		cursor++
		value >>>= 7
	}
	buffer.writeUInt8(value, offset + cursor)
	return offset + cursor + 1
}

function readPString(buffer: Buffer, offset, typeArgs, rootNode, history: any[]) {
	history.push({
		type: 'scope_start',
		data: { name: 'length', offset, type: typeArgs.countType }
	})
	const { size, count } = getCount.call(this, buffer, offset, typeArgs, rootNode, history)
	history.push({
		type: 'scope_end',
		data: { offset: offset + size, value: count }
	})
	const cursor = offset + size
	const strEnd = cursor + count
	if (strEnd > buffer.length) {
		throw new PartialReadError(
			'Missing characters in string, found size is ' +
				buffer.length +
				' expected size was ' +
				strEnd
		)
	}

	const value = buffer.toString(typeArgs.encoding || 'utf8', cursor, strEnd)

	return {
		value,
		size: strEnd - offset
	}
}

function writePString(value, buffer, offset, typeArgs, rootNode) {
	const length = Buffer.byteLength(value, 'utf8')
	offset = sendCount.call(this, length, buffer, offset, typeArgs, rootNode)
	buffer.write(value, offset, length, typeArgs.encoding || 'utf8')
	return offset + length
}

function sizeOfPString(value, typeArgs, rootNode) {
	const length = Buffer.byteLength(value, typeArgs.encoding || 'utf8')
	const size = calcCount.call(this, length, typeArgs, rootNode)
	return size + length
}

function readBool(buffer, offset) {
	if (offset + 1 > buffer.length) throw new PartialReadError()
	const value = buffer.readInt8(offset)
	return {
		value: !!value,
		size: 1
	}
}

function writeBool(value, buffer, offset) {
	buffer.writeInt8(+value, offset)
	return offset + 1
}

function readBuffer(buffer, offset, typeArgs, rootNode, history: any[]) {
	history.push({
		type: 'scope_start',
		data: { name: 'length', offset, type: typeArgs.countType }
	})
	const { size, count } = getCount.call(this, buffer, offset, typeArgs, rootNode)
	history.push({
		type: 'scope_end',
		data: { offset: offset + size, value: count }
	})
	offset += size
	if (offset + count > buffer.length) throw new PartialReadError()
	return {
		value: buffer.slice(offset, offset + count),
		size: size + count
	}
}

function writeBuffer(value, buffer, offset, typeArgs, rootNode) {
	if (!(value instanceof Buffer)) value = Buffer.from(value)
	offset = sendCount.call(this, value.length, buffer, offset, typeArgs, rootNode)
	value.copy(buffer, offset)
	return offset + value.length
}

function sizeOfBuffer(value, typeArgs, rootNode) {
	if (!(value instanceof Buffer)) value = Buffer.from(value)
	const size = calcCount.call(this, value.length, typeArgs, rootNode)
	return size + value.length
}

function readVoid() {
	return {
		value: undefined,
		size: 0
	}
}

function writeVoid(value, buffer, offset) {
	return offset
}

function generateBitMask(n) {
	return (1 << n) - 1
}

function readBitField(buffer, offset, typeArgs) {
	const beginOffset = offset
	let curVal = null
	let bits = 0
	const value = typeArgs.reduce((acc, { size, signed, name }) => {
		let currentSize = size
		let val = 0
		while (currentSize > 0) {
			if (bits === 0) {
				if (buffer.length < offset + 1) {
					throw new PartialReadError()
				}
				curVal = buffer[offset++]
				bits = 8
			}
			const bitsToRead = Math.min(currentSize, bits)
			val = (val << bitsToRead) | ((curVal & generateBitMask(bits)) >> (bits - bitsToRead))
			bits -= bitsToRead
			currentSize -= bitsToRead
		}
		if (signed && val >= 1 << (size - 1)) {
			val -= 1 << size
		}
		acc[name] = val
		return acc
	}, {})
	const size = offset - beginOffset
	return { value, size }
}
function writeBitField(value, buffer, offset, typeArgs) {
	let toWrite = 0
	let bits = 0
	typeArgs.forEach(({ size, signed, name }) => {
		const val: number = value[name]
		if ((!signed && val < 0) || (signed && val < -(1 << (size - 1)))) {
			throw new Error(`${value} < ${signed ? -(1 << (size - 1)) : 0}`)
		} else if ((!signed && val >= 1 << size) || (signed && val >= (1 << (size - 1)) - 1)) {
			throw new Error(`${value} >= ${signed ? 1 << size : (1 << (size - 1)) - 1}`)
		}
		while (size > 0) {
			const writeBits = Math.min(8 - bits, size)
			toWrite = (toWrite << writeBits) | ((val >> (size - writeBits)) & generateBitMask(writeBits))
			size -= writeBits
			bits += writeBits
			if (bits === 8) {
				buffer[offset++] = toWrite
				bits = 0
				toWrite = 0
			}
		}
	})
	if (bits !== 0) {
		buffer[offset++] = toWrite << (8 - bits)
	}
	return offset
}

function sizeOfBitField(value, typeArgs) {
	return Math.ceil(
		typeArgs.reduce((acc, { size }) => {
			return acc + size
		}, 0) / 8
	)
}

function readCString(buffer, offset, typeArgs) {
	let size = 0
	while (offset + size < buffer.length && buffer[offset + size] !== 0x00) {
		size++
	}
	if (buffer.length < offset + size + 1) {
		throw new PartialReadError()
	}

	return {
		value: buffer.toString(typeArgs?.encoding || 'utf8', offset, offset + size),
		size: size + 1
	}
}

function writeCString(value, buffer, offset, typeArgs) {
	const length = Buffer.byteLength(value, typeArgs?.encoding || 'utf8')
	buffer.write(value, offset, length, typeArgs?.encoding || 'utf8')
	offset += length
	buffer.writeInt8(0x00, offset)
	return offset + 1
}

function sizeOfCString(value) {
	const length = Buffer.byteLength(value, 'utf8')
	return length + 1
}
