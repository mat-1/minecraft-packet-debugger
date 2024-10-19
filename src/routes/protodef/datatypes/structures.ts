import { getField, getCount, sendCount, calcCount, tryDoc } from '../utils'
import structuresSchema from '../schemas/structures.json'

export const array = [readArray, writeArray, sizeOfArray, structuresSchema.array]
export const count = [readCount, writeCount, sizeOfCount, structuresSchema.count]
export const container = [
	readContainer,
	writeContainer,
	sizeOfContainer,
	structuresSchema.container
]

function readArray(buffer, offset, typeArgs, rootNode, history: any[]) {
	const results = {
		value: [],
		size: 0
	}
	let value
	let { count, size } = getCount.call(this, buffer, offset, typeArgs, rootNode, history)
	offset += size
	results.size += size
	for (let i = 0; i < count; i++) {
		;({ size, value } = tryDoc(
			() => this.read(buffer, offset, typeArgs.type, rootNode, history),
			i
		))
		results.size += size
		offset += size
		results.value.push(value)
	}
	return results
}

function writeArray(value, buffer, offset, typeArgs, rootNode) {
	offset = sendCount.call(this, value.length, buffer, offset, typeArgs, rootNode)
	return value.reduce(
		(offset, v, index) =>
			tryDoc(() => this.write(v, buffer, offset, typeArgs.type, rootNode), index),
		offset
	)
}

function sizeOfArray(value, typeArgs, rootNode) {
	let size = calcCount.call(this, value.length, typeArgs, rootNode)
	size = value.reduce(
		(size, v, index) => tryDoc(() => size + this.sizeOf(v, typeArgs.type, rootNode), index),
		size
	)
	return size
}

function readContainer(buffer, offset, typeArgs, context, history: any[]) {
	const results = {
		value: { '..': context },
		size: 0
	}
	typeArgs.forEach(({ type, name, anon }) => {
		const innerTypeName = Array.isArray(type) ? type[1]?.type ?? type[0] : type
		const typeName = Array.isArray(type) ? type[0] : type

		history.push({
			type: 'scope_start',
			data: {
				name,
				offset,
				type: typeName,
				inner_type: typeName !== innerTypeName ? innerTypeName : undefined
			}
		})
		tryDoc(() => {
			const readResults = this.read(buffer, offset, type, results.value, history)
			results.size += readResults.size
			offset += readResults.size
			if (anon) {
				if (readResults.value !== undefined) {
					Object.keys(readResults.value).forEach((key) => {
						results.value[key] = readResults.value[key]
					})
				}
			} else {
				results.value[name] = readResults.value
			}
			console.log(type, 'value', readResults)
			history.push({
				type: 'scope_end',
				data: /varint|[ui]\d+|string/.test(innerTypeName)
					? { offset, value: readResults.value }
					: { offset }
			})
		}, name || 'unknown')
	})
	delete results.value['..']
	return results
}

function writeContainer(value, buffer, offset, typeArgs, context) {
	value['..'] = context
	offset = typeArgs.reduce(
		(offset, { type, name, anon }) =>
			tryDoc(
				() => this.write(anon ? value : value[name], buffer, offset, type, value),
				name || 'unknown'
			),
		offset
	)
	delete value['..']
	return offset
}

function sizeOfContainer(value, typeArgs, context) {
	value['..'] = context
	const size = typeArgs.reduce(
		(size, { type, name, anon }) =>
			size + tryDoc(() => this.sizeOf(anon ? value : value[name], type, value), name || 'unknown'),
		0
	)
	delete value['..']
	return size
}

function readCount(buffer, offset, { type }, rootNode) {
	return this.read(buffer, offset, type, rootNode)
}

function writeCount(value, buffer, offset, { countFor, type }, rootNode) {
	// Actually gets the required field, and writes its length. Value is unused.
	// TODO : a bit hackityhack.
	return this.write(getField(countFor, rootNode).length, buffer, offset, type, rootNode)
}

function sizeOfCount(value, { countFor, type }, rootNode) {
	// TODO : should I use value or getField().length ?
	return this.sizeOf(getField(countFor, rootNode).length, type, rootNode)
}
