<script lang="ts">
	import '../app.css'

	import { userInputToBuffer } from './parse'
	import { ProtoDefCompiler } from './protodef/compiler'
	import { Parser, ProtoDef } from './protodef/index'
	import * as compilerMinecraftTypes from './minecraft-datatypes/compiler-minecraft'
	import { Buffer } from 'buffer'

	import protocol from './protocol.json'
	import PrettyBuffer from './PrettyBuffer.svelte'

	// let userInput = '0x00 0x01 0x00 0x00 0x01 0x01'
	// let userInput = '0x00 0x00 0x00 0x01 0x01'
	let userInput =
		'0x00, 0xff, 0xff, 0xff, 0xff, 0x0f, 0x07, 0x6d, 0x61, 0x73, 0x73, 0x63, 0x61, 0x6e, 0x00, 0x00, 0x01'
	// let userInput =
	// 	'0x00, 0xff, 0xff, 0xff, 0xff, 0x0f, 0x07, 0x6d, 0x61, 0x73, 0x73, 0x63, 0x61, 0x6e, 0x00, 0x00'
	let buffer: Uint8Array
	let invalidBufferError: string | undefined
	$: {
		try {
			buffer = userInputToBuffer(userInput)
			invalidBufferError = undefined
		} catch (e) {
			invalidBufferError = e.toString()
		}
	}

	type State = 'handshaking' | 'status' | 'login' | 'play'
	type Direction = 'toServer' | 'toClient'

	let state: State = 'handshaking'

	function createProtocol(state: State, direction: Direction, version: string, compiled: boolean) {
		if (compiled) {
			const compiler = new ProtoDefCompiler()
			compiler.addTypes(compilerMinecraftTypes)
			compiler.addProtocol(protocol, [state, direction])
			const proto = compiler.compileProtoDefSync()
			// protocols[key] = proto
			return proto
		}

		const proto = new ProtoDef(false)
		proto.addTypes(compilerMinecraftTypes)
		proto.addProtocol(protocol, [state, direction])
		// protocols[key] = proto
		return proto
	}

	function createDeserializer({
		state,
		direction,
		version,
		compiled = false
	}: {
		state: State
		direction: Direction
		version: string
		compiled?: boolean
	}) {
		return new Parser(createProtocol(state, direction, version, compiled), 'packet')
	}

	$: deserializer = createDeserializer({
		state,
		direction: 'toServer',
		version: '1.19.3'
	})

	function unflattenHistory(history: any[], buffer: Uint8Array, end: any = {}): any[] {
		const nestedHistory = []

		while (history.length > 0) {
			const item = history.shift()
			const type: string = item.type
			if (type.endsWith('_start')) {
				const thisEnd = {}
				const inner = unflattenHistory(history, buffer, thisEnd)

				const data = {
					type: type.slice(0, type.length - 6),
					data: item.data,
					end: Object.keys(thisEnd).length > 0 ? thisEnd : undefined,
					inner: inner.length > 0 ? inner : undefined
				}
				nestedHistory.push(data)
			} else if (type.endsWith('_end')) {
				Object.assign(end, item.data)
				console.log(item.data)
				return nestedHistory
			} else nestedHistory.push(item)
		}

		return nestedHistory
	}

	$: data = deserializer.parsePacketBuffer(Buffer.from(buffer.buffer))
	$: history = unflattenHistory([...data.history], buffer)
</script>

<h1>mat's Packet Debugger</h1>

<label for="state">State</label>
<select name="state" bind:value={state}>
	<option value="handshaking">Handshake</option>
	<option value="status">Status</option>
	<option value="login">Login</option>
	<option value="play">Play</option>
</select>

<input id="input-buffer" bind:value={userInput} />
{#if invalidBufferError}
	{invalidBufferError}
{/if}

<div class="pretty-buffer-container-container">
	<div class="pretty-buffer-container">
		<div id="pretty-buffer">
			{#each buffer as byte}
				<span class="byte">{byte}</span>
			{/each}
		</div>
		<PrettyBuffer {history} {buffer} />
	</div>
</div>

<p>
	<code>
		<pre>
{JSON.stringify(history, null, 2)}

		</pre>
	</code>
</p>
{#if data.data}
	<p>
		<code>
			<pre>
{JSON.stringify(data.data, null, 2)}

		</pre>
		</code>
	</p>
{/if}

<style>
	:root {
		--byte-width: 5rem;
	}
	.byte {
		display: inline-block;
		width: var(--byte-width);
		text-align: center;
	}

	#pretty-buffer {
		font-family: monospace;
	}

	.pretty-buffer-container {
		width: max-content;
	}

	.pretty-buffer-container-container {
		overflow: auto;
	}
</style>
