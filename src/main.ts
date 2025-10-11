import { Plugin } from "obsidian";
import { AutoTagger } from "./services/autoTagger";
import {
	DEFAULT_SETTINGS,
	PersonalContextSettingTab,
	type PersonalContextSettings,
} from "./settings";
import { toggleLoggerBy } from "./utils/logger";
import { AUTO_TAG_VIEW_TYPE, AutoTagView } from "./view/autoTagView";
import { SvelteView, VIEW_TYPE } from "./view/view";

export default class MyPlugin extends Plugin {
	settings: PersonalContextSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new PersonalContextSettingTab(this));
		this.configureLogger();

		this.registerView(VIEW_TYPE, (leaf) => new SvelteView(leaf, this));
		this.registerView(
			AUTO_TAG_VIEW_TYPE,
			(leaf) => new AutoTagView(leaf, this),
		);

		this.addRibbonIcon("dice", "Activate svelte view", () => {
			this.activateView();
		});

		this.addRibbonIcon("tag", "Open Auto Tagger", () => {
			this.activateAutoTagView();
		});

		this.addCommand({
			id: "open-svelte-view",
			name: "Open Svelte View",
			callback: () => {
				this.activateView();
			},
		});

		this.addCommand({
			id: "open-auto-tag-view",
			name: "Open Auto Tagger",
			callback: () => {
				this.activateAutoTagView();
			},
		});
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(AUTO_TAG_VIEW_TYPE);
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

	async activateAutoTagView() {
		this.app.workspace.detachLeavesOfType(AUTO_TAG_VIEW_TYPE);

		await this.app.workspace.getRightLeaf(false)?.setViewState({
			type: AUTO_TAG_VIEW_TYPE,
			active: true,
		});

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(AUTO_TAG_VIEW_TYPE)[0],
		);
	}

	configureLogger(): void {
		toggleLoggerBy(
			this.settings.common.enableDebugLogging ? "DEBUG" : "ERROR",
		);
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

	/**
	 * AutoTaggerインスタンスを作成（テスト用）
	 */
	createAutoTagger(): AutoTagger {
		return new AutoTagger(
			this.app,
			this.settings.autoTagger,
			this.settings.common,
		);
	}
}
