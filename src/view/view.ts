import { ItemView, WorkspaceLeaf } from "obsidian";
import type MyPlugin from "../main";
import AppComponent from "./App.svelte";

export const VIEW_TYPE = "svelte-view";

export class SvelteView extends ItemView {
	component: AppComponent | null = null;
	plugin: MyPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE;
	}

	getDisplayText() {
		return "Svelte View";
	}

	async onOpen() {
		this.component = new AppComponent({
			target: this.contentEl,
			props: {
				plugin: this.plugin,
			},
		});
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy();
			this.component = null;
		}
	}
}
