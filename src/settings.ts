import { PluginSettingTab, Setting } from "obsidian";
import type AutoTaggerPlugin from "./main";
import { TagSuggest } from "./ui/interaction";

const GEMINI_MODELS = [
	// "gemini-2.5-pro",
	"gemini-2.5-flash",
	"gemini-2.5-flash-lite", // 2.5シリーズ
	"gemini-2.0-flash", // 2.0シリーズ
	"gemini-2.0-flash-lite",
];

// --- 設定インターフェース ---
export interface CommonSettings {
	geminiApiKey: string;
	geminiModel: string;
	enableThinkingMode: boolean;
	enableDebugLogging: boolean;
}

export interface AutoTaggerSettings {
	targetDirectory: string;
	excludeNoteTags: string[];
	excludeSuggestionTags: string[];
	systemInstruction: string;
	batchSize: number;
	logFilePath: string;
	maxLogFileSize: number;
	enableLogging: boolean;
}

export interface PersonalContextSettings {
	common: CommonSettings;
	autoTagger: AutoTaggerSettings;
}

// --- デフォルト設定 ---
export const DEFAULT_SETTINGS: PersonalContextSettings = {
	common: {
		geminiApiKey: "",
		geminiModel: GEMINI_MODELS[0],
		enableThinkingMode: false,
		enableDebugLogging: false,
	},
	autoTagger: {
		targetDirectory: "",
		excludeNoteTags: [],
		excludeSuggestionTags: [],
		systemInstruction:
			"あなたは知識管理の専門家です。ノートの内容を分析し、最も適切なタグを提案してください。",
		batchSize: 5,
		logFilePath: ".obsidian/plugins/auto-tagger/logs/auto-tag.log",
		maxLogFileSize: 10,
		enableLogging: true,
	},
};

export class AutoTaggerSettingTab extends PluginSettingTab {
	plugin: AutoTaggerPlugin;

	constructor(plugin: AutoTaggerPlugin) {
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

		// --- Auto Tagger Section ---
		containerEl.createEl("h3", { text: "Auto Tagger Settings" });
		const autoTaggerDesc = containerEl.createEl("p", {
			cls: "setting-item-description",
		});
		autoTaggerDesc.setText(
			"Settings for automatic tagging of notes using Gemini AI.",
		);

		new Setting(containerEl)
			.setName("Target directory")
			.setDesc(
				"Directory path to process notes from (e.g., 'notes/' or leave empty for vault root).",
			)
			.addText((text) =>
				text
					.setPlaceholder("notes/")
					.setValue(this.plugin.settings.autoTagger.targetDirectory)
					.onChange(async (value) => {
						this.plugin.settings.autoTagger.targetDirectory =
							value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Exclude note tags")
			.setDesc(
				"Comma-separated list of tags. Notes with any of these tags will be excluded from auto-tagging (e.g., 'processed, archived'). Use the autocomplete to select tags.",
			)
			.addSearch((search) => {
				search
					.setPlaceholder("processed, archived")
					.setValue(this.plugin.settings.autoTagger.excludeNoteTags.join(", "))
					.onChange(async (value) => {
						// Remove '#' prefix from each tag if present
						this.plugin.settings.autoTagger.excludeNoteTags =
							value
								.split(",")
								.map((tag) => tag.replace(/^#+/, "").trim())
								.filter((tag) => tag.length > 0);
						await this.plugin.saveSettings();
					});
				new TagSuggest(this.app, search.inputEl);
			});

		new Setting(containerEl)
			.setName("Exclude suggestion tags")
			.setDesc(
				"Comma-separated list of tags to exclude from AI suggestions (e.g., 'meta, system, private'). Use the autocomplete to select tags.",
			)
			.addSearch((search) => {
				search
					.setPlaceholder("meta, system")
					.setValue(
						this.plugin.settings.autoTagger.excludeSuggestionTags.join(
							", ",
						),
					)
					.onChange(async (value) => {
						// Remove '#' prefix from each tag if present
						this.plugin.settings.autoTagger.excludeSuggestionTags =
							value
								.split(",")
								.map((tag) => tag.replace(/^#+/, "").trim())
								.filter((tag) => tag.length > 0);
						await this.plugin.saveSettings();
					});
				new TagSuggest(this.app, search.inputEl);
			});

		new Setting(containerEl)
			.setName("System instruction")
			.setDesc(
				"Custom instruction for the AI to guide tagging behavior. This will be sent with each request.",
			)
			.addTextArea((text) => {
				text.setPlaceholder("Enter custom instructions for the AI...")
					.setValue(this.plugin.settings.autoTagger.systemInstruction)
					.onChange(async (value) => {
						this.plugin.settings.autoTagger.systemInstruction =
							value;
						await this.plugin.saveSettings();
					});
				text.inputEl.rows = 4;
				text.inputEl.cols = 50;
			});

		new Setting(containerEl)
			.setName("Log file path")
			.setDesc(
				"Path where auto-tagging logs will be saved (relative to vault root).",
			)
			.addText((text) =>
				text
					.setPlaceholder(
						".obsidian/plugins/auto-tagger/logs/auto-tag.log",
					)
					.setValue(this.plugin.settings.autoTagger.logFilePath)
					.onChange(async (value) => {
						this.plugin.settings.autoTagger.logFilePath =
							value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Max log file size (MB)")
			.setDesc(
				"Maximum size of the log file before rotation. When exceeded, a new log file will be created.",
			)
			.addSlider((slider) =>
				slider
					.setLimits(1, 50, 1)
					.setValue(this.plugin.settings.autoTagger.maxLogFileSize)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.autoTagger.maxLogFileSize = value;
						await this.plugin.saveSettings();
					}),
			);

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
