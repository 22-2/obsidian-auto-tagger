import { Plugin } from "obsidian";
import {
	type PersonalContextSettings,
	DEFAULT_SETTINGS,
	PersonalContextSettingTab,
} from "./settings";
import { toggleLoggerBy } from "./utils/logger";
import { SvelteView, VIEW_TYPE } from "./view/view";

export default class MyPlugin extends Plugin {
	settings: PersonalContextSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new PersonalContextSettingTab(this));
		this.configureLogger();

		this.registerView(VIEW_TYPE, (leaf) => new SvelteView(leaf, this));

		this.addRibbonIcon("dice", "Activate svelte view", () => {
			this.activateView();
		});

		this.addCommand({
			id: "open-svelte-view",
			name: "Open Svelte View",
			callback: () => {
				this.activateView();
			},
		});
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE);
	}

	async activateView() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE);

		await this.app.workspace.getRightLeaf(false)?.setViewState({
			type: VIEW_TYPE,
			active: true,
		});

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(VIEW_TYPE)[0],
		);
	}

	configureLogger(): void {
		toggleLoggerBy(
			this.settings.common.enableDebugLogging ? "DEBUG" : "ERROR",
		);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
