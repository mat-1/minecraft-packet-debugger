export function userInputToBuffer(userInput: string): Uint8Array {
    userInput = userInput.toLowerCase()
    const initialUserInput = userInput
    let numberBuffer: number[] = []

    let mightBeHex = false

    while (userInput != '') {
        let userByte = ''
        while (true) {
            if (userInput == '') break
            const char = userInput.slice(0, 1)
            userInput = userInput.slice(1)
            if (char == ',' || char == ' ') {
                if (userByte == '') continue
                else break
            }
            userByte += char
        }


        if (/^[0-9a-f]{3,}$/.test(userByte)) {
            mightBeHex = true
            break
        }

        // this supports hex too
        const byte = Number(userByte)

        if (isNaN(byte)) {
            // throw Error(`${userByte} is not a number (should be like 0x00)`)
            mightBeHex = true
            break
        }
        if (byte < 0)
            throw Error(`${userByte} is not a byte (${byte} < 0)`)
        if (byte > 255)
            throw Error(`${userByte} is not a byte (${byte} > 255, separate bytes by spaces)`)

        numberBuffer.push(byte)
    }

    if (mightBeHex) {
        numberBuffer = []
        userInput = initialUserInput
        let byte = ''
        while (userInput != '') {
            let nibble = userInput.slice(0, 1)
            userInput = userInput.slice(1)
            if (nibble == ' ') continue
            if (/[0-9a-f]/.test(nibble))
                byte += nibble
            else
                throw Error(`${nibble} is not a valid number`)
            if (byte.length >= 2) {
                numberBuffer.push(parseInt(byte, 16))
                byte = ''
            }
        }
        if (byte)
            throw Error(`Data remaining after parsing buffer as hex: ${byte}`)
    }

    return Uint8Array.from(numberBuffer)
}