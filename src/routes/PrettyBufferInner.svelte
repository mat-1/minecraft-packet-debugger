<script lang="ts">
	import { type Writable } from 'svelte/store'

	export let history: any[]
	export let buffer: Uint8Array

	export let minByteWidths: number[]
	export let selectedRange: Writable<[number, number] | null>

	function getWidth(item) {
		let start = item.data.offset
		let end = getEndOffset(item)

		let sum = 0
		for (let i = start; i < end; i++) {
			sum += minByteWidths[i] || 2.5
		}
		return sum
	}

	function getEndOffset(item) {
		if (item.end?.offset !== undefined) return item.end.offset
		if (item.inner) return getEndOffset(item.inner[item.inner.length - 1])
		return item.data.offset + 1
	}

	function selectItem(item) {
		const itemRange: [number, number] = [item.data.offset, getEndOffset(item)]
		if (selectedRange) {
			if (selectedRange[0] === itemRange[0] && selectedRange[1] === itemRange[1]) {
				$selectedRange = null
			} else {
				$selectedRange = itemRange
			}
		} else {
			$selectedRange = itemRange
		}
	}
</script>

{#each history as item}
	{@const type = item.type}
	{#if type === 'scope'}
		{@const error = item.end?.offset === undefined || item.data?.offset === undefined}
		{@const width = getWidth(item)}
		{#if width !== 0}
			<span
				class="part-container"
				style={(error ? 'display: inline-flex;' : '') + `--width: ${width}`}
				class:comment={width === 0}
			>
				<div class="part">
					<div
						class="part-content-container"
						style={error
							? 'background: red'
							: `background: hsl(${Math.random() * 50 - 10}, 50%, 15%)`}
						on:click|stopPropagation={() => selectItem(item)}
						on:keypress|stopPropagation={() => selectItem(item)}
						class:unselected={$selectedRange &&
							(item.data.offset < $selectedRange[0] || getEndOffset(item) > $selectedRange[1])}
					>
						<div class="part-content">
							{#if item.data.name}
								<b>{item.data.name}</b>
							{/if}
							{#if item.data?.type && (!item.inner || item.inner[0].type === 'scope')}
								<div class="type">
									{item.data.type}
									{#if item.data.inner_type}({item.data.inner_type}){/if}
								</div>
							{/if}
							{#if item.end?.value !== undefined}
								<i class="value"
									>{typeof item.end?.value === 'string'
										? item.end?.value
										: JSON.stringify(item.end?.value)}</i
								>
							{/if}
						</div>
					</div>
					{#if item.inner}
						<svelte:self history={item.inner} {buffer} {minByteWidths} {selectedRange} />
					{/if}
				</div>
			</span>
		{/if}
	{/if}
{/each}

<style>
	.part-container {
		width: calc(var(--width) * var(--base-byte-width));
		min-width: calc(var(--min-width) * var(--base-byte-width));
		vertical-align: top;
		display: inline-flex;
	}
	.part {
		width: 100%;
	}
	.part-content {
		text-align: center;
		margin: 0 auto;
		width: fit-content;
		overflow-wrap: anywhere;
	}
	.part-content-container {
		border: 1px solid #000;
	}

	.comment {
		overflow: none;
		opacity: 0.5;
	}

	.value {
		font-size: 0.8em;
	}

	.unselected {
		opacity: 0.3;
	}
	.part-content-container {
		cursor: pointer;
	}
</style>
