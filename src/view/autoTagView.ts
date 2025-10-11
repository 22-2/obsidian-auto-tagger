import { ItemView, type WorkspaceLeaf } from "obsidian";
import { mount, unmount } from "svelte";
import type MyPlugin from "../main";
import AutoTagViewComponent from "./AutoTagView.svelte";

export const AUTO_TAG_VIEW_TYPE = "auto-tag-view";

export class AutoTagView extends ItemView {
	component: ReturnType<typeof mount> | null = null;
	plugin: MyPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return AUTO_TAG_VIEW_TYPE;
	}

	getDisplayText() {
		return "Auto Tagger";
	}

	async onOpen() {
		this.component = mount(AutoTagViewComponent, {
			target: this.contentEl,
			props: {
				plugin: this.plugin,
			},
		});
	}

	async onClose() {
		this.component && unmount(this.component);
	}
}
