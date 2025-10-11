import { App, PluginSettingTab, Setting } from "obsidian";
import type PersonalContextPlugin from "./main";

const GEMINI_MODELS = [
	// "gemini-2.5-pro",
	"gemini-2.5-flash",
	"gemini-2.5-flash-lite", // 2.5シリーズ
	"gemini-2.0-flash", // 2.0シリーズ
	"gemini-2.0-flash-lite",
];

// --- 新しい設定インターフェース ---
export interface CommonSettings {
	geminiApiKey: string;
	geminiModel: string;
	enableThinkingMode: boolean;
	enableDebugLogging: boolean;
}

export interface AIContextSettings {
	maxNotesToProcess: number;
	noteSortOrder: "recent" | "random";
	includeNoteContentInContext: boolean;
}

export interface BasesSuggesterSettings {
	sampleSize: number;
	// excludeExisting: boolean; // 新オプション <-- この行を削除
}

export interface PersonalContextSettings {
	common: CommonSettings;
	aiContext: AIContextSettings;
	basesSuggester: BasesSuggesterSettings;
}

// --- 新しいデフォルト設定 ---
export const DEFAULT_SETTINGS: PersonalContextSettings = {
	common: {
		geminiApiKey: "",
		geminiModel: GEMINI_MODELS[0],
		enableThinkingMode: false,
		enableDebugLogging: false,
	},
	aiContext: {
		maxNotesToProcess: 100,
		noteSortOrder: "random",
		includeNoteContentInContext: false,
	},
	basesSuggester: {
		sampleSize: 10,
		// excludeExisting: true, // デフォルトで有効 <-- この行を削除
	},
};

export class PersonalContextSettingTab extends PluginSettingTab {
	plugin: PersonalContextPlugin;

	constructor(plugin: PersonalContextPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Personal Context Settings" });

		// --- Common AI Settings Section ---
		containerEl.createEl("h3", { text: "Common AI Settings" });

		new Setting(containerEl)
			.setName("Gemini API Key")
			.setDesc("Enter your Google AI Studio Gemini API key.")
			.addText((text) => {
				text.setPlaceholder("Enter your API key")
					.setValue(this.plugin.settings.common.geminiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.common.geminiApiKey = value.trim();
						await this.plugin.saveSettings();
					});
				text.inputEl.type = "password";
			});

		const thinkingToggleSetting = new Setting(containerEl)
			.setName("Enable Thinking Mode")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.common.enableThinkingMode)
					.onChange(async (value) => {
						this.plugin.settings.common.enableThinkingMode = value;
						await this.plugin.saveSettings();
					}),
			);

		const updateThinkingToggleState = (selectedModel: string) => {
			if (selectedModel.includes("2.5-pro")) {
				thinkingToggleSetting.setDisabled(true);
				thinkingToggleSetting.setDesc(
					"Thinking Mode is always enabled and cannot be turned off for Gemini 2.5 Pro.",
				);
			} else if (selectedModel.includes("2.5")) {
				thinkingToggleSetting.setDisabled(false);
				thinkingToggleSetting.setDesc(
					"Allow the model to use its internal thinking process. (Only for 2.5 Flash/Flash-Lite)",
				);
			} else {
				thinkingToggleSetting.setDisabled(true);
				thinkingToggleSetting.setDesc(
					"Thinking Mode is not available for this model.",
				);
			}
		};

		new Setting(containerEl)
			.setName("Gemini Model")
			.setDesc("Choose the Gemini model for analysis.")
			.addDropdown((dropdown) => {
				GEMINI_MODELS.forEach((model) => {
					dropdown.addOption(model, model);
				});
				dropdown
					.setValue(this.plugin.settings.common.geminiModel)
					.onChange(async (value) => {
						this.plugin.settings.common.geminiModel = value;
						updateThinkingToggleState(value);
						await this.plugin.saveSettings();
					});
			});

		updateThinkingToggleState(this.plugin.settings.common.geminiModel);

		// --- AI Context Settings Section ---
		containerEl.createEl("h3", { text: "AI Context Settings" });
		const aiContextDesc = containerEl.createEl("p", {
			cls: "setting-item-description",
		});
		aiContextDesc.setText(
			"Common settings for how the AI gathers context from your vault.",
		);

		new Setting(containerEl)
			.setName("Note selection method for context")
			.setDesc(
				"How to select notes from your vault to provide to the AI as context (for 'Suggest related notes').",
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOption("recent", "Most recently updated")
					.addOption("random", "Randomly selected")
					.setValue(this.plugin.settings.aiContext.noteSortOrder)
					.onChange(async (value) => {
						this.plugin.settings.aiContext.noteSortOrder = value as
							| "recent"
							| "random";
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Maximum notes to consider")
			.setDesc(
				"The maximum number of notes to provide as context for the AI. Affects 'Suggest related notes'.",
			)
			.addSlider((slider) =>
				slider
					.setLimits(10, 500, 10)
					.setValue(this.plugin.settings.aiContext.maxNotesToProcess)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.aiContext.maxNotesToProcess =
							value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Include note content in context")
			.setDesc(
				"ON: Include other notes' content for more accuracy (higher API cost). OFF: Use only metadata (faster, lower cost).",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.aiContext
							.includeNoteContentInContext,
					)
					.onChange(async (value) => {
						this.plugin.settings.aiContext.includeNoteContentInContext =
							value;
						await this.plugin.saveSettings();
					}),
			);

		// --- Bases Suggester Section ---
		containerEl.createEl("h3", { text: "Suggest for Bases View" });
		const basesSuggesterDesc = containerEl.createEl("p", {
			cls: "setting-item-description",
		});
		basesSuggesterDesc.setText(
			"Settings for the 'Suggest tags & keywords for notes in Bases view' command.",
		);

		new Setting(containerEl)
			.setName("Number of notes to process")
			.setDesc(
				"The number of notes to sample from the Bases view for analysis, prioritizing those with fewer tags.",
			)
			.addSlider((slider) =>
				slider
					.setLimits(1, 30, 1)
					.setValue(this.plugin.settings.basesSuggester.sampleSize)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.basesSuggester.sampleSize = value;
						await this.plugin.saveSettings();
					}),
			);

		// --- ここから "Exclude notes" の設定を削除 ---

		// --- Advanced Section ---
		containerEl.createEl("h3", { text: "Advanced" });

		new Setting(containerEl)
			.setName("Enable debug logging")
			.setDesc(
				"Turn on detailed logging in the developer console for debugging.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.common.enableDebugLogging)
					.onChange(async (value) => {
						this.plugin.settings.common.enableDebugLogging = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
