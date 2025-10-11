import { PluginSettingTab, Setting } from "obsidian";
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

export interface AutoTaggerSettings {
	targetDirectory: string;
	excludeNoteTag: string;
	excludeSuggestionTags: string[];
	systemInstruction: string;
	batchSize: number;
	logFilePath: string;
	maxLogFileSize: number;
}

export interface PersonalContextSettings {
	common: CommonSettings;
	aiContext: AIContextSettings;
	basesSuggester: BasesSuggesterSettings;
	autoTagger: AutoTaggerSettings;
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
	autoTagger: {
		targetDirectory: "",
		excludeNoteTag: "",
		excludeSuggestionTags: [],
		systemInstruction:
			"あなたは知識管理の専門家です。ノートの内容を分析し、最も適切なタグを提案してください。",
		batchSize: 5,
		logFilePath: ".obsidian/plugins/personal-context/logs/auto-tag.log",
		maxLogFileSize: 10,
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
				text
					.setPlaceholder("Enter your API key")
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
						this.plugin.settings.aiContext.maxNotesToProcess = value;
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
					.setValue(this.plugin.settings.aiContext.includeNoteContentInContext)
					.onChange(async (value) => {
						this.plugin.settings.aiContext.includeNoteContentInContext = value;
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
						this.plugin.settings.autoTagger.targetDirectory = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Exclude note tag")
			.setDesc(
				"Notes with this tag will be excluded from auto-tagging (e.g., 'processed').",
			)
			.addText((text) =>
				text
					.setPlaceholder("processed")
					.setValue(this.plugin.settings.autoTagger.excludeNoteTag)
					.onChange(async (value) => {
						this.plugin.settings.autoTagger.excludeNoteTag = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Exclude suggestion tags")
			.setDesc(
				"Comma-separated list of tags to exclude from AI suggestions (e.g., 'meta, system, private').",
			)
			.addText((text) =>
				text
					.setPlaceholder("meta, system")
					.setValue(
						this.plugin.settings.autoTagger.excludeSuggestionTags.join(", "),
					)
					.onChange(async (value) => {
						this.plugin.settings.autoTagger.excludeSuggestionTags = value
							.split(",")
							.map((tag) => tag.trim())
							.filter((tag) => tag.length > 0);
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("System instruction")
			.setDesc(
				"Custom instruction for the AI to guide tagging behavior. This will be sent with each request.",
			)
			.addTextArea((text) => {
				text
					.setPlaceholder("Enter custom instructions for the AI...")
					.setValue(this.plugin.settings.autoTagger.systemInstruction)
					.onChange(async (value) => {
						this.plugin.settings.autoTagger.systemInstruction = value;
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
						".obsidian/plugins/personal-context/logs/auto-tag.log",
					)
					.setValue(this.plugin.settings.autoTagger.logFilePath)
					.onChange(async (value) => {
						this.plugin.settings.autoTagger.logFilePath = value.trim();
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
