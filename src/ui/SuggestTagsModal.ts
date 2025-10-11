import { App, Modal, Notice, Setting, TFile } from "obsidian";

/**
 * AIが提案したタグを表示し、ノートに適用するためのモーダル。
 */
export class SuggestTagsModal extends Modal {
	private selectedTags: Set<string>;

	constructor(
		app: App,
		private file: TFile,
		private suggestedTags: string[]
	) {
		super(app);
		this.selectedTags = new Set<string>();
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Suggested Tags" });
		contentEl.createEl("p", {
			text: "Select the tags you want to add to the note's frontmatter.",
		});

		if (this.suggestedTags.length === 0) {
			contentEl.createEl("p", {
				text: "No new tag suggestions found.",
			});
		}

		this.suggestedTags.forEach((tag) => {
			new Setting(contentEl).setName(tag).addToggle((toggle) => {
				toggle.onChange((value) => {
					if (value) {
						this.selectedTags.add(tag);
					} else {
						this.selectedTags.delete(tag);
					}
				});
			});
		});

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText("Apply Tags")
					.setCta()
					.onClick(() => this.applyTags())
			)
			.addButton((button) =>
				button.setButtonText("Cancel").onClick(() => this.close())
			);
	}

	async applyTags() {
		if (this.selectedTags.size === 0) {
			new Notice("No tags selected.");
			this.close();
			return;
		}

		try {
			await this.app.fileManager.processFrontMatter(this.file, (fm) => {
				// 'tags'が文字列または文字列配列の場合に対応
				const existingTags = fm.tags
					? Array.isArray(fm.tags)
						? fm.tags
						: [String(fm.tags)]
					: [];

				// 新しいタグを追加し、重複を排除
				const newTags = Array.from(
					new Set([...existingTags, ...this.selectedTags])
				);

				fm.tags = newTags;
			});
			new Notice("Tags applied successfully!");
		} catch (error) {
			console.error("Error applying tags:", error);
			new Notice("Failed to apply tags. Check console for details.");
		}

		this.close();
	}

	onClose() {
		this.contentEl.empty();
	}
}
