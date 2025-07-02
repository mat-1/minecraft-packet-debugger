// based on https://github.com/scravy/uuid-1345/blob/master/index.js#L424

const byte2hex = []
const hex2byte = {}
for (let i = 0; i < 256; i++) {
	const hex = (i + 0x100).toString(16).slice(1)
	hex2byte[hex] = i
	byte2hex[i] = hex
}

export function stringify(buffer: Buffer): string {
	return (
		byte2hex[buffer[0]] +
		byte2hex[buffer[1]] +
		byte2hex[buffer[2]] +
		byte2hex[buffer[3]] +
		'-' +
		byte2hex[buffer[4]] +
		byte2hex[buffer[5]] +
		'-' +
		byte2hex[buffer[6]] +
		byte2hex[buffer[7]] +
		'-' +
		byte2hex[buffer[8]] +
		byte2hex[buffer[9]] +
		'-' +
		byte2hex[buffer[10]] +
		byte2hex[buffer[11]] +
		byte2hex[buffer[12]] +
		byte2hex[buffer[13]] +
		byte2hex[buffer[14]] +
		byte2hex[buffer[15]]
	)
}

export function parse(string: string): Buffer {
	const buffer = Buffer.alloc(16)
	let j = 0
	for (let i = 0; i < 16; i++) {
		buffer[i] = hex2byte[string[j++] + string[j++]]
		if (i === 3 || i === 5 || i === 7 || i === 9) {
			j += 1
		}
	}

	return buffer
}
