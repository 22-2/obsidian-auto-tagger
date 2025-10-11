<script lang="ts">
	import type MyPlugin from "../main";
	import { onMount } from "svelte";

	export let plugin: MyPlugin;

	let counter = 0;

	onMount(() => {
		console.log("Svelte component mounted");
	});

	const increment = () => {
		counter += 1;
	};
</script>

<main>
	<h1>Svelte View</h1>
	<p>This is a Svelte component rendered in Obsidian.</p>

	<button on:click={increment}>Click me</button>
	<p>You've clicked the button {counter} times.</p>
</main>

<style>
	main {
		padding: 1rem;
	}
	h1 {
		color: var(--text-normal);
	}
</style>
