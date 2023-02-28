export function userInputToBuffer(userInput: string): Uint8Array {
    userInput = userInput.toLowerCase()
    const numberBuffer: number[] = []

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

        // this supports hex too
        const byte = Number(userByte)

        if (isNaN(byte))
            throw Error(`${userByte} is not a number (should be like 0x00)`)
        if (byte < 0)
            throw Error(`${userByte} is not a byte (${byte} < 0)`)
        if (byte > 255)
            throw Error(`${userByte} is not a byte (${byte} > 255, separate bytes by spaces)`)

        numberBuffer.push(byte)
    }

    return Uint8Array.from(numberBuffer)
}