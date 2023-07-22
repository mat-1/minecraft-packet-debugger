<script lang="ts">
	import '../app.css'

	import { userInputToBuffer } from './parse'
	import { Parser, ProtoDef } from './protodef/index'
	import * as minecraftTypes from './minecraft-datatypes/minecraft'
	import { Buffer } from 'buffer'
	import { varint } from './protodef/datatypes/utils'

	import PrettyBuffer from './PrettyBuffer.svelte'
	import { onMount } from 'svelte'

	type State = 'handshaking' | 'status' | 'login' | 'play'
	type Direction = 'toServer' | 'toClient'

	// handshake toserver
	// let userInput =
	// 	'0x00, 0xff, 0xff, 0xff, 0xff, 0x0f, 0x07, 0x6d, 0x61, 0x73, 0x73, 0x63, 0x61, 0x6e, 0x00, 0x00, 0x01'
	// let userInput = '0x05 1 65 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 0 1 1 0 1'
	// let userInput = '0x05 1 65 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 1 1 1'

	let userInput = ''

	let state: State = 'handshaking'
	// let state: State = 'play'
	let direction: Direction = 'toServer'

	let lengthPrefixed = false

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

	let protocol: undefined | any

	function createProtocol(state: State, direction: Direction, protocol: any) {
		const proto = new ProtoDef(false)
		proto.addTypes(minecraftTypes)
		proto.addProtocol(protocol, [state, direction])
		// protocols[key] = proto
		return proto
	}

	function createDeserializer({
		state,
		direction,
		protocol
	}: {
		state: State
		direction: Direction
		protocol: any
	}) {
		return new Parser(createProtocol(state, direction, protocol), 'packet')
	}

	// let deserializer: Parser
	// $: {
	// 	if (protocol)
	// 		deserializer = createDeserializer({
	// 			state,
	// 			direction,
	// 			protocol
	// 		})
	// }

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

		console.log('nestedHistory', nestedHistory)

		return nestedHistory
	}

	let prefixSize = 0
	let prefixValue = 0

	let data
	$: {
		let buf = Buffer.from(buffer.buffer)
		console.log('lengthPrefixed', lengthPrefixed)
		if (lengthPrefixed) {
			const readVarInt = varint[0]
			try {
				const varintResult = readVarInt(buf, 0)
				console.log('varintResult', varintResult)
				prefixSize = varintResult.size
				prefixValue = varintResult.value
			} catch {
				console.log('invalid length')
				prefixSize = 0
			}
		} else {
			prefixSize = 0
		}
		data = deserializer?.parsePacketBuffer(buf, prefixSize) ?? { history: [] }
	}
	let history
	$: {
		history = unflattenHistory([...data.history], buffer, lengthPrefixed)
		if (prefixSize > 0) {
			history.unshift({
				type: 'scope',
				data: {
					name: 'length',
					type: 'varint',
					offset: 0
				},
				end: {
					offset: prefixSize,
					value: prefixValue
				},
				inner: undefined
			})
		}
	}

	let versionIds: string[] = []
	let versionId: string | undefined = undefined

	let dataPaths: any = {}

	onMount(async () => {
		// https://github.com/PrismarineJS/minecraft-data/blob/master/data/dataPaths.json
		dataPaths = await fetch(
			'https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master/data/dataPaths.json'
		).then((r) => r.json())
		versionIds = [...Object.keys(dataPaths.pc)].reverse()
		versionId = versionIds[0]
	})

	// let deserializer: Parser
	$: deserializer = createDeserializer({
		state,
		direction,
		protocol
	})

	$: {
		versionId
		;(async () => {
			if (versionId) {
				const dataPath = dataPaths.pc[versionId].protocol
				protocol = await fetch(
					`https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master/data/${dataPath}/protocol.json`
				).then((r) => r.json())
			}
		})()
	}
</script>

<main>
	<h1>mat's Packet Debugger</h1>

	<label for="version">Version</label>
	<select name="version" bind:value={versionId}>
		{#each versionIds as id}
			<option value={id}>{id}</option>
		{/each}
	</select>

	<label for="state">State</label>
	<select name="state" bind:value={state}>
		<option value="handshaking">Handshake</option>
		<option value="status">Status</option>
		<option value="login">Login</option>
		<option value="play">Play</option>
	</select>
	<label for="direction">Direction</label>
	<select name="direction" bind:value={direction}>
		<option value="toServer">Serverbound</option>
		<option value="toClient">Clientbound</option>
	</select>

	<div>
		<label for="length-prefixed">Length prefixed?</label>
		<input type="checkbox" id="length-prefixed" bind:checked={lengthPrefixed} />
	</div>

	<div>
		<input id="input-buffer" bind:value={userInput} placeholder="Your buffer" />
		{#if invalidBufferError}
			{invalidBufferError}
		{/if}
	</div>

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

	<!-- <p>
	<code>
		<pre>
{JSON.stringify(history, null, 2)}

		</pre>
	</code>
</p> -->
	{#if data.data}
		<p>
			<code>
				<pre>
{JSON.stringify(data.data, null, 2)}

		</pre>
			</code>
		</p>
	{/if}
</main>

<footer>
	<p>hacked together by <a href="https://matdoes.dev">mat</a> using code from <a href="https://github.com/PrismarineJS/node-minecraft-protocol">node-minecraft-protocol</a> and dependencies</p>
	<a href="https://github.com/mat-1/minecraft-packet-debugger">source code</a>
</footer>

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
