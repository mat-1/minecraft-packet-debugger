export function getField(countField: string, context: any) {
	const countFieldArr = countField.split('/')
	let i = 0
	if (countFieldArr[i] === '') {
		while (context['..'] !== undefined) {
			context = context['..']
		}
		i++
	}
	for (; i < countFieldArr.length; i++) {
		context = context[countFieldArr[i]]
	}
	return context
}

export function getFieldInfo(fieldInfo: any) {
	if (typeof fieldInfo === 'string') {
		return { type: fieldInfo }
	} else if (Array.isArray(fieldInfo)) {
		return { type: fieldInfo[0], typeArgs: fieldInfo[1] }
	} else if (typeof fieldInfo.type === 'string') {
		return fieldInfo
	} else {
		throw new Error('Not a fieldinfo')
	}
}

export function getCount(
	buffer: Buffer,
	offset: number,
	{ count, countType }: { count: number; countType: string },
	rootNode: any,
	history: any[]
) {
	let c = 0
	let size = 0
	if (typeof count === 'number') {
		c = count
	} else if (typeof count !== 'undefined') {
		c = getField(count, rootNode)
	} else if (typeof countType !== 'undefined') {
		;({ size, value: c } = tryDoc(
			() => this.read(buffer, offset, getFieldInfo(countType), rootNode, history),
			'$count'
		))
	} else {
		// TODO : broken schema, should probably error out.
		c = 0
	}
	return { count: c, size }
}

export function sendCount(len, buffer, offset, { count, countType }, rootNode) {
	if (typeof count !== 'undefined' && len !== count) {
		// TODO: Throw
	} else if (typeof countType !== 'undefined') {
		offset = this.write(len, buffer, offset, getFieldInfo(countType), rootNode)
	} else {
		// TODO: Throw
	}
	return offset
}

export function calcCount(
	len: number,
	{ count, countType }: { count: number; countType: string },
	rootNode
) {
	if (typeof count === 'undefined' && typeof countType !== 'undefined') {
		return tryDoc(() => this.sizeOf(len, getFieldInfo(countType), rootNode), '$count')
	} else {
		return 0
	}
}

export function addErrorField(e: { field?: string }, field: string) {
	e.field = e.field ? field + '.' + e.field : field
	throw e
}

export function tryCatch<T>(tryfn: () => T, catchfn: (e: any) => void): T | void {
	try {
		return tryfn()
	} catch (e) {
		catchfn(e)
	}
}

export function tryDoc<T>(tryfn: () => T, field): T | void {
	return tryCatch(tryfn, (e) => addErrorField(e, field))
}

export class ExtendableError extends Error {
	constructor(message: string) {
		super(message)
		this.name = this.constructor.name
		this.message = message
		if (Error.captureStackTrace != null) {
			Error.captureStackTrace(this, this.constructor)
		}
	}
}

export class PartialReadError extends ExtendableError {
	partialReadError: boolean

	constructor(message?: string) {
		super(message)
		this.partialReadError = true
	}
}
