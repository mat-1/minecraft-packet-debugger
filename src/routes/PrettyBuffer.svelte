<script lang="ts">
	import { type Writable, writable } from 'svelte/store'
	import PrettyBufferInner from './PrettyBufferInner.svelte'

	export let history: any[]
	export let buffer: Uint8Array

	// the minimum width that each "byte" element must take up (in pixels).
	let minByteWidths = []
	let lastIndex = 0

	function updateItemWidth(item: any) {
		const byteOffsetStart = item.data.offset
		const byteOffsetEnd = item.end?.offset ?? item.data.offset + 1
		const length = byteOffsetEnd - byteOffsetStart

		if (byteOffsetEnd > lastIndex) lastIndex = byteOffsetEnd

		const totalItemWidth = 2.5

		const widthPerByte = totalItemWidth / length
		for (let i = byteOffsetStart; i < byteOffsetEnd; i++) {
			// we can only make the width bigger
			minByteWidths[i] = Math.max(minByteWidths[i], widthPerByte)
		}

		// recursive
		item.inner?.forEach(updateItemWidth)
	}

	let selectedRange: Writable<[number, number] | null> = writable(null)

	$: {
		minByteWidths = []
		lastIndex = 0
		for (const _ of buffer) {
			minByteWidths.push(1)
		}
		history.forEach(updateItemWidth)
	}

	function resetSelectedRange() {
		selectedRange.set(null)
	}
</script>

<svelte:document
	on:click|stopPropagation={resetSelectedRange}
	on:keydown|stopPropagation={resetSelectedRange}
/>

<div class="pretty-buffer-container">
	<div id="pretty-buffer">
		{#each buffer as byte, i}
			<span
				class="byte"
				style="--width:{minByteWidths[i]}"
				class:unselected={$selectedRange && (i < $selectedRange[0] || i >= $selectedRange[1])}
				>{byte}
			</span>
		{/each}
	</div>
	<PrettyBufferInner {history} {buffer} {minByteWidths} {selectedRange} /><span
		class="overflow-bytes"
	>
		{#each buffer.slice(lastIndex) as byte, i}
			<span class="overflow byte" style="--width:{minByteWidths[i + lastIndex]}">
				{#if byte < 32 || byte > 126}
					.
				{:else}
					{String.fromCharCode(byte)}
				{/if}
			</span>
		{/each}
	</span>
</div>

<style>
	.byte {
		display: inline-block;
		width: calc(var(--width) * var(--base-byte-width));
		text-align: center;
		white-space: nowrap;
	}

	#pretty-buffer {
		font-family: monospace;
	}

	.pretty-buffer-container {
		width: max-content;
	}

	.overflow {
		background: #222;
		border: 1px solid #000;
		height: 2rem;
		line-height: 2rem;
	}

	.unselected {
		color: #555;
	}
</style>
