import { getFieldInfo, tryCatch } from './utils'
import numericTypes from './datatypes/numeric'
import * as UtilTypes from './datatypes/utils'
import * as structureTypes from './datatypes/structures'
import * as conditionalTypes from './datatypes/conditional'
import { Buffer } from 'buffer'

function isFieldInfo(type) {
	return (
		typeof type === 'string' || (Array.isArray(type) && typeof type[0] === 'string') || type.type
	)
}

function findArgs(acc, v, k) {
	if (typeof v === 'string' && v.charAt(0) === '$') {
		acc.push({ path: k, val: v.substring(1) })
	} else if (Array.isArray(v) || typeof v === 'object') {
		acc = acc.concat(v.reduce(findArgs, []).map((v) => ({ path: k + '.' + v.path, val: v.val })))
	}
	return acc
}

function setField(path, val, into) {
	const c = path.split('.').reverse()
	while (c.length > 1) {
		into = into[c.pop()]
	}
	into[c.pop()] = val
}

function extendType(functions, defaultTypeArgs) {
	const json = JSON.stringify(defaultTypeArgs)
	const argPos = Object.keys(defaultTypeArgs).reduce(findArgs, [])
	function produceArgs(typeArgs) {
		const args = JSON.parse(json)
		argPos.forEach((v) => {
			setField(v.path, typeArgs[v.val], args)
		})
		return args
	}
	return [
		function read(buffer, offset, typeArgs, context, history) {
			return functions[0].call(this, buffer, offset, produceArgs(typeArgs), context, history)
		},
		function write(value, buffer, offset, typeArgs, context) {
			return functions[1].call(this, value, buffer, offset, produceArgs(typeArgs), context)
		},
		function sizeOf(value, typeArgs, context) {
			if (typeof functions[2] === 'function') {
				return functions[2].call(this, value, produceArgs(typeArgs), context)
			} else {
				return functions[2]
			}
		}
	]
}

export class ProtoDef {
	types: Record<string, any>

	constructor(validation = true) {
		this.types = {}
		this.addDefaultTypes()
	}

	addDefaultTypes() {
		this.addTypes(numericTypes)
		this.addTypes(UtilTypes)
		this.addTypes(structureTypes)
		this.addTypes(conditionalTypes)
	}

	addProtocol(protocolData, path) {
		const self = this
		function recursiveAddTypes(protocolData, path) {
			if (protocolData === undefined) {
				return
			}
			if (protocolData.types) {
				self.addTypes(protocolData.types)
			}
			recursiveAddTypes(protocolData[path.shift()], path)
		}

		recursiveAddTypes(protocolData, path)
	}

	addType(name, functions, validate = true) {
		if (functions === 'native') {
			return
		}
		if (isFieldInfo(functions)) {
			const { type, typeArgs } = getFieldInfo(functions)
			this.types[name] = typeArgs ? extendType(this.types[type], typeArgs) : this.types[type]
		} else {
			this.types[name] = functions
		}
	}

	addTypes(types) {
		Object.keys(types).forEach((name) => this.addType(name, types[name], false))
	}

	setVariable(key, val) {
		this.types[key] = val
	}

	read(buffer: Buffer, cursor: number, _fieldInfo, rootNodes, history: any[]) {
		const { type, typeArgs } = getFieldInfo(_fieldInfo)
		const typeFunctions = this.types[type]
		if (!typeFunctions) {
			throw new Error('missing data type: ' + type)
		}
		const data = typeFunctions[0].call(this, buffer, cursor, typeArgs, rootNodes, history)
		return data
	}

	write(value, buffer, offset, _fieldInfo, rootNode) {
		const { type, typeArgs } = getFieldInfo(_fieldInfo)
		const typeFunctions = this.types[type]
		if (!typeFunctions) {
			throw new Error('missing data type: ' + type)
		}
		return typeFunctions[1].call(this, value, buffer, offset, typeArgs, rootNode)
	}

	sizeOf(value, _fieldInfo, rootNode) {
		const { type, typeArgs } = getFieldInfo(_fieldInfo)
		const typeFunctions = this.types[type]
		if (!typeFunctions) {
			throw new Error('missing data type: ' + type)
		}
		if (typeof typeFunctions[2] === 'function') {
			return typeFunctions[2].call(this, value, typeArgs, rootNode)
		} else {
			return typeFunctions[2]
		}
	}

	createPacketBuffer(type, packet) {
		const length = tryCatch(
			() => this.sizeOf(packet, type, {}),
			(e) => {
				e.message = `SizeOf error for ${e.field} : ${e.message}`
				throw e
			}
		)
		const buffer = Buffer.allocUnsafe(length)
		tryCatch(
			() => this.write(packet, buffer, 0, type, {}),
			(e) => {
				e.message = `Write error for ${e.field} : ${e.message}`
				throw e
			}
		)
		return buffer
	}

	parsePacketBuffer(type, buffer, offset = 0) {
		const history = []

		try {
			const { value, size } = this.read(buffer, offset, type, {}, history)
			return {
				history,
				data: value,
				metadata: {
					size: size
				},
				buffer: buffer.slice(0, size),
				fullBuffer: buffer
			}
		} catch (e) {
			console.error(e)
			// history.push({
			//     type: 'error'
			// })
			return {
				history
			}
			// e.message = `Read error for ${e.field} : ${e.message}`
			// throw e
		}
	}
}
