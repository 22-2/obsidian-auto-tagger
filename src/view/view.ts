import { ItemView, WorkspaceLeaf } from "obsidian";
import AppComponent from "./App.svelte";
import type MyPlugin from "../main";
import { mount, unmount } from "svelte";

export const VIEW_TYPE = "svelte-view";

export class SvelteView extends ItemView {
	component: ReturnType<typeof mount> | null = null;
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
		this.component = mount(AppComponent, {
			target: this.contentEl,
			props: {},
		});
	}

	async onClose() {
		this.component && unmount(this.component);
	}
}
