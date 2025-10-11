import { Plugin } from "obsidian";
import {
	DEFAULT_SETTINGS,
	type PersonalContextSettings,
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
		toggleLoggerBy(this.settings.common.enableDebugLogging ? "DEBUG" : "ERROR");
	}

	async loadSettings() {
		const loadedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
		// Ensure nested objects are properly merged
		if (loadedData) {
			this.settings.common = Object.assign(
				{},
				DEFAULT_SETTINGS.common,
				loadedData.common,
			);
			this.settings.aiContext = Object.assign(
				{},
				DEFAULT_SETTINGS.aiContext,
				loadedData.aiContext,
			);
			this.settings.basesSuggester = Object.assign(
				{},
				DEFAULT_SETTINGS.basesSuggester,
				loadedData.basesSuggester,
			);
			this.settings.autoTagger = Object.assign(
				{},
				DEFAULT_SETTINGS.autoTagger,
				loadedData.autoTagger,
			);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
