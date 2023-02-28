function readPString(buffer, offset, typeArgs, rootNode) {
    const { value, size } = this.read(buffer, offset, 'shortString', rootNode)
    for (const c of value) {
        if (c === '\0') throw new Error('unexpected tag end')
    }
    return { value, size }
}

function writePString(value, buffer, offset, typeArgs, rootNode) {
    return this.write(value, buffer, offset, 'shortString', rootNode)
}

function sizeOfPString(value, buffer, offset, typeArgs, rootNode) {
    return this.sizeOf(value, buffer, offset, 'shortString', rootNode)
}

export const context = [readPString, writePString, sizeOfPString]
