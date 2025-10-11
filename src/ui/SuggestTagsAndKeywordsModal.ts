import {
	App,
	Modal,
	Notice,
	Setting,
	TFile,
	TextAreaComponent,
} from "obsidian";
import { AISuggestion } from "src/utils/types";

interface SuggestionState {
	path: string;
	tags: Map<string, boolean>; // tag -> isSelected
	keywords: string; // Comma-separated string for editing
}

export class SuggestTagsAndKeywordsModal extends Modal {
	private suggestionsState: SuggestionState[];

	constructor(app: App, private suggestions: AISuggestion[]) {
		super(app);

		this.suggestionsState = this.suggestions.map((s) => ({
			path: s.path,
			tags: new Map(s.suggestedTags.map((tag) => [tag, true])),
			keywords: s.suggestedKeywords.join(", "),
		}));
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "AI Suggestions for Notes" });
		contentEl.createEl("p", {
			text: "Review the suggestions and apply them to the notes' frontmatter.",
		});

		// スクロール可能なリストコンテナを追加
		const listContainer = contentEl.createDiv(
			"personal-context-suggestions-list"
		);

		this.suggestionsState.forEach((state, index) => {
			const container = listContainer.createDiv(
				"personal-context-suggestion-container"
			);
			const file = this.app.vault.getAbstractFileByPath(state.path);
			const fileName = file ? file.name : state.path;

			// --- Note Title (Clickable) ---
			const titleEl = container.createEl("h4", {
				text: fileName,
				cls: "personal-context-suggestion-title",
			});
			titleEl.addEventListener("click", () => {
				if (file instanceof TFile) {
					this.app.workspace.getLeaf().openFile(file);
					// this.close();
				}
			});

			// --- Tags Section ---
			container.createEl("h5", {
				text: "Suggested Tags",
				cls: "personal-context-suggestion-section-title",
			});
			const tagsGrid = container.createDiv(
				"personal-context-suggestion-tags-grid"
			);
			if (state.tags.size === 0) {
				tagsGrid.createEl("span", {
					text: "No new tags suggested.",
					cls: "text-muted",
				});
			} else {
				state.tags.forEach((isSelected, tag) => {
					const tagId = `tag-${index}-${tag.replace(
						/[^a-zA-Z0-9]/g,
						""
					)}`;
					const tagItem = tagsGrid.createDiv(
						"personal-context-suggestion-tag-item"
					);
					const checkbox = tagItem.createEl("input", {
						type: "checkbox",
						attr: { id: tagId },
					});
					checkbox.checked = isSelected;
					checkbox.onchange = () => {
						state.tags.set(tag, checkbox.checked);
					};
					tagItem.createEl("label", {
						text: tag,
						attr: { for: tagId },
					});
				});
			}

			// --- Keywords Section ---
			container.createEl("h5", {
				text: "Suggested Keywords",
				cls: "personal-context-suggestion-section-title",
			});
			const keywordsContainer = container.createDiv(
				"personal-context-suggestion-keywords"
			);
			new TextAreaComponent(keywordsContainer)
				.setValue(state.keywords)
				.onChange((value) => {
					state.keywords = value;
				})
				.setPlaceholder("Enter keywords, separated by commas");
		});

		// --- Action Buttons ---
		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText("Apply Suggestions")
					.setCta()
					.onClick(() => this.applyChanges())
			)
			.addButton((button) =>
				button.setButtonText("Cancel").onClick(() => this.close())
			);
	}

	async applyChanges() {
		const notice = new Notice("Applying changes...", 0);
		try {
			const promises = this.suggestionsState.map(async (state) => {
				const file = this.app.vault.getAbstractFileByPath(state.path);
				if (!(file instanceof TFile)) {
					console.warn(`File not found, skipping: ${state.path}`);
					return;
				}

				const newTags = Array.from(state.tags.entries())
					.filter(([, isSelected]) => isSelected)
					.map(([tag]) => tag);

				const newKeywords = state.keywords
					.split(",")
					.map((k) => k.trim())
					.filter(Boolean);

				if (newTags.length === 0 && newKeywords.length === 0) {
					return; // No changes to apply
				}

				await this.app.fileManager.processFrontMatter(file, (fm) => {
					// Merge tags
					const existingTags = fm.tags
						? Array.isArray(fm.tags)
							? fm.tags
							: [String(fm.tags)]
						: [];
					fm.tags = Array.from(
						new Set([...existingTags, ...newTags])
					);

					// Merge keywords
					const existingKeywords = fm.keywords
						? Array.isArray(fm.keywords)
							? fm.keywords
							: [String(fm.keywords)]
						: [];
					fm.keywords = Array.from(
						new Set([...existingKeywords, ...newKeywords])
					);
				});
			});

			await Promise.all(promises);
			notice.setMessage("Changes applied successfully!");
			setTimeout(() => notice.hide(), 3000);
		} catch (error) {
			console.error("Error applying changes:", error);
			notice.setMessage(
				"Failed to apply changes. Check console for details."
			);
			setTimeout(() => notice.hide(), 5000);
		}

		this.close();
	}

	onClose() {
		this.contentEl.empty();
	}
}
