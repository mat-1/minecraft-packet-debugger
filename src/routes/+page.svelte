<script lang="ts">
	import '../app.css'

	import { userInputToBuffer } from './parse'
	import { Parser, ProtoDef } from './protodef/index'
	import * as minecraftTypes from './minecraft-datatypes/minecraft'
	import * as nbt from './nbt/nbt'
	import { Buffer } from 'buffer'
	import { varint } from './protodef/datatypes/utils'

	import { onMount } from 'svelte'
	import { browser } from '$app/environment'
	import PrettyBuffer from './PrettyBuffer.svelte'

	let dataKind: 'packet' | 'nbt' = browser
		? (localStorage.getItem('dataKind') as any) ?? 'packet'
		: 'packet'
	$: if (browser) localStorage.setItem('dataKind', dataKind)

	type State = 'handshaking' | 'status' | 'login' | 'play' | 'configuration'
	type Direction = 'toServer' | 'toClient'

	let userInput = browser ? localStorage.getItem('userInput') ?? '' : ''
	$: if (browser) localStorage.setItem('userInput', userInput)

	let state: State = browser
		? (localStorage.getItem('state') as any) ?? 'handshaking'
		: 'handshaking'
	$: if (browser) localStorage.setItem('state', state)
	// let state: State = 'play'
	let direction: Direction = browser
		? (localStorage.getItem('direction') as any) ?? 'toServer'
		: 'toServer'
	$: if (browser) localStorage.setItem('direction', direction)

	let isNetworkNbt: boolean = browser
		? (localStorage.getItem('isNetworkNbt') as any) === 'true'
		: false
	$: if (browser) localStorage.setItem('isNetworkNbt', isNetworkNbt.toString())

	let lengthPrefixed: boolean = browser
		? (localStorage.getItem('lengthPrefixed') as any) === 'true'
		: false
	$: if (browser) localStorage.setItem('lengthPrefixed', isNetworkNbt.toString())

	let buffer: Uint8Array = new Uint8Array()
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
		proto.addTypes(nbt.protos.big.types)
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

	let deserializer: Parser
	$: {
		if (protocol)
			switch (dataKind) {
				case 'packet':
					console.log('creating packet parser')
					deserializer = createDeserializer({
						state,
						direction,
						protocol
					})
					break
				case 'nbt':
					console.log('creating nbt parser')
					deserializer = new Parser(nbt.protos.big, isNetworkNbt ? 'anonymousNbt' : 'nbt')
					break
			}
	}

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
	<h1>mat's {dataKind == 'packet' ? 'Packet' : 'NBT'} Debugger</h1>

	<div>
		<label for="kind">Kind</label>
		<select name="kind" bind:value={dataKind}>
			<option value="packet">Packet</option>
			<option value="nbt">NBT</option>
		</select>
	</div>

	{#if dataKind == 'packet'}
		<div>
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
				<option value="configuration">Configuration</option>
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
		</div>
	{:else}
		<div>
			<label for="is-network-nbt">Network NBT?</label>
			<input type="checkbox" id="is-network-nbt" bind:checked={isNetworkNbt} />
		</div>
	{/if}

	<div id="input-buffer-container">
		<input id="input-buffer" bind:value={userInput} placeholder="Your buffer" />
		{#if invalidBufferError}
			{invalidBufferError}
		{/if}
	</div>

	<div class="pretty-buffer-container-container">
		<PrettyBuffer {buffer} {history} />
	</div>

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
	<p>
		hacked together by <a href="https://matdoes.dev">mat</a> using code from
		<a href="https://github.com/PrismarineJS/node-minecraft-protocol">node-minecraft-protocol</a> and
		dependencies.
	</p>
	<a href="https://github.com/mat-1/minecraft-packet-debugger">source code</a>
</footer>

<style>
	:root {
		--base-byte-width: 2rem;
	}
	.pretty-buffer-container-container {
		overflow: auto;
	}

	#input-buffer-container {
		margin: 1em 0;
	}
</style>
