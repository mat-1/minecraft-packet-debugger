export function userInputToBuffer(userInput: string): Uint8Array {
	userInput = userInput.toLowerCase().trim()

	// trim [ and ]
	if (userInput.startsWith('[')) userInput = userInput.slice(1)
	if (userInput.endsWith(']')) userInput = userInput.slice(0, -1)

	const initialUserInput = userInput
	let numberBuffer: number[] = []

	let mightBeHex = false

	while (userInput != '') {
		let userByte = ''
		while (true) {
			if (userInput == '') break
			const char = userInput.slice(0, 1)
			userInput = userInput.slice(1)
			if (char == ',' || char == ' ' || char == ' ') {
				if (userByte == '') continue
				else break
			}
			userByte += char
		}

		if (/^[0-9a-f]{4,}$/.test(userByte)) {
			mightBeHex = true
			break
		}

		// this supports hex too
		const byte = Number(userByte)

		if (isNaN(byte)) {
			mightBeHex = true
			break
		}
		if (byte < 0) throw Error(`${userByte} is not a byte (${byte} < 0)`)
		if (byte > 255)
			throw Error(`${userByte} is not a byte (${byte} > 255, separate bytes by spaces)`)

		numberBuffer.push(byte)
	}

	if (mightBeHex) {
		numberBuffer = []
		userInput = initialUserInput
		let byte = ''

		let hasSpaces = false

		while (userInput != '') {
			const nibble = userInput.slice(0, 1)
			userInput = userInput.slice(1)
			if (nibble == ' ' || nibble == '\t') {
				hasSpaces = true
				if (byte.length >= 1) {
					numberBuffer.push(parseInt(byte, 16))
					byte = ''
				}
				continue
			}
			if (/[0-9a-f]/.test(nibble)) byte += nibble
			else throw Error(`${nibble} is not a valid number`)
			if (byte.length >= 2) {
				numberBuffer.push(parseInt(byte, 16))
				byte = ''
			}
		}
		if (byte) {
			if (hasSpaces) {
				// if it had spaces previously, we're more tolerant here
				numberBuffer.push(parseInt(byte, 16))
			} else {
				throw Error(`Data remaining after parsing buffer as hex: ${byte}`)
			}
		}
	}

	return Uint8Array.from(numberBuffer)
}
