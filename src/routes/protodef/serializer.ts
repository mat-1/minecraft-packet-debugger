import { Buffer } from 'buffer'
import type { ProtoDef } from '.'

export class Serializer extends TransformStream {
	proto: ProtoDef
	mainType: string
	queue: Buffer

	constructor(proto, mainType: string) {
		super({ writableObjectMode: true })
		this.proto = proto
		this.mainType = mainType
		this.queue = Buffer.alloc(0)
	}

	createPacketBuffer(packet) {
		return this.proto.createPacketBuffer(this.mainType, packet)
	}

	_transform(chunk, enc, cb) {
		let buf
		try {
			buf = this.createPacketBuffer(chunk)
		} catch (e) {
			return cb(e)
		}
		this.push(buf)
		return cb()
	}
}

export class Parser extends TransformStream {
	proto: ProtoDef
	mainType: string
	queue: Buffer

	constructor(proto, mainType) {
		super({ readableObjectMode: true })
		this.proto = proto
		this.mainType = mainType
		this.queue = Buffer.alloc(0)
	}

	parsePacketBuffer(buffer: Buffer, offset = 0) {
		return this.proto.parsePacketBuffer(this.mainType, buffer, offset)
	}

	_transform(chunk, enc, cb) {
		this.queue = Buffer.concat([this.queue, chunk])
		while (true) {
			let packet
			try {
				packet = this.parsePacketBuffer(this.queue)
			} catch (e) {
				if (e.partialReadError) {
					return cb()
				} else {
					e.buffer = this.queue
					this.queue = Buffer.alloc(0)
					return cb(e)
				}
			}

			this.push(packet)
			this.queue = this.queue.slice(packet.metadata.size)
		}
	}
}

export class FullPacketParser extends TransformStream {
	constructor(proto, mainType, noErrorLogging = false) {
		super({ readableObjectMode: true })
		this.proto = proto
		this.mainType = mainType
		this.noErrorLogging = noErrorLogging
	}

	parsePacketBuffer(buffer) {
		return this.proto.parsePacketBuffer(this.mainType, buffer)
	}

	_transform(chunk, enc, cb) {
		let packet
		try {
			packet = this.parsePacketBuffer(chunk)
			if (packet.metadata.size !== chunk.length && !this.noErrorLogging) {
				console.log(
					'Chunk size is ' +
						chunk.length +
						' but only ' +
						packet.metadata.size +
						' was read ; partial packet : ' +
						JSON.stringify(packet.data) +
						'; buffer :' +
						chunk.toString('hex')
				)
			}
		} catch (e) {
			if (e.partialReadError) {
				if (!this.noErrorLogging) {
					console.log(e.stack)
				}
				return cb()
			} else {
				return cb(e)
			}
		}
		this.push(packet)
		cb()
	}
}
