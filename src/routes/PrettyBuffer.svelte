<script lang="ts">
	export let history: any[]
	export let buffer: Uint8Array
</script>

{#each history as item}
	{@const type = item.type}
	{#if type === 'scope'}
		{@const error = item.end?.offset === undefined || item.data?.offset === undefined}
		{@const width = error ? undefined : item.end.offset - item.data.offset}
		{#if width !== 0}
		<span
			class="part-container"
			style={error ? 'display: inline-flex;' : `--width: ${width}`}
			class:comment={width === 0}
		>
			<div class="part">
				<div
					class="part-content-container"
					style={error
						? 'background: red'
						: `background: hsl(${Math.random() * 50 - 10}, 50%, 15%)`}
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
							<i>{JSON.stringify(item.end?.value)}</i>
						{/if}
					</div>
				</div>
				{#if item.inner}
					<svelte:self history={item.inner} {buffer} />
				{/if}
			</div>
		</span>
		{/if}
	{/if}
{/each}

<style>
	.part-container {
		width: calc(var(--width) * var(--byte-width));
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
</style>
