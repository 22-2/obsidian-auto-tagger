import {
	App,
	Modal,
	Notice,
	Setting,
	TextAreaComponent,
	TFile,
} from "obsidian";

type LinkStyle = "wikilink" | "markdown" | "none";
type ListPrefix = "none" | "dash" | "asterisk" | "numbered";

/**
 * AIが見つけた関連ノートを表示し、フォーマットしてコピーするためのモーダル。
 */
export class RelatedNotesModal extends Modal {
	private showFullPath = false;
	private linkStyle: LinkStyle = "wikilink";
	private listPrefix: ListPrefix = "dash";
	private excludeLinkedNotes = true; // デフォルトで既存リンクを除外する

	private previewText = "";
	private textArea!: TextAreaComponent;

	constructor(
		app: App,
		private relatedNotes: string[],
		private existingLinkPaths: Set<string> // 既存リンクのパスをコンストラクタで受け取る
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "AI Suggested Related Notes" });

		// Preview Area
		this.textArea = new TextAreaComponent(contentEl).setPlaceholder(
			"Formatted results will appear here..."
		);
		this.textArea.inputEl.style.width = "100%";
		this.textArea.inputEl.style.height = "200px";
		this.textArea.inputEl.style.minHeight = "100px";
		this.textArea.inputEl.readOnly = true;
		contentEl.addClass("personal-context-modal-content");

		// --- Options ---
		new Setting(contentEl)
			.setName("Exclude already linked notes")
			.setDesc(
				"Hide notes that are already linked from the current note."
			)
			.addToggle((toggle) => {
				toggle.setValue(this.excludeLinkedNotes).onChange((value) => {
					this.excludeLinkedNotes = value;
					this.updatePreview();
				});
			});

		new Setting(contentEl)
			.setName("Link style")
			.setDesc("Optionally turn each file result in to a link.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("wikilink", "Wikilink")
					.addOption("markdown", "Markdown")
					.addOption("none", "None")
					.setValue(this.linkStyle)
					.onChange((value: string) => {
						this.linkStyle = value as LinkStyle;
						this.updatePreview();
					});
			});

		new Setting(contentEl)
			.setName("List prefix")
			.setDesc("Optionally add a list item prefix to each file result.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("none", "None")
					.addOption("dash", "Dash (-)")
					.addOption("asterisk", "Asterisk (*)")
					.addOption("numbered", "Numbered (1.)")
					.setValue(this.listPrefix)
					.onChange((value: string) => {
						this.listPrefix = value as ListPrefix;
						this.updatePreview();
					});
			});

		// --- Buttons ---
		new Setting(contentEl)
			.setClass("personal-context-modal-buttons")
			.addButton((button) =>
				button
					.setButtonText("Copy results")
					.setCta()
					.onClick(() => {
						navigator.clipboard.writeText(this.previewText);
						new Notice("Results copied to clipboard!");
					})
			)
			.addButton((button) =>
				button.setButtonText("Done").onClick(() => {
					this.close();
				})
			);

		this.updatePreview(); // Initial preview generation
	}

	updatePreview() {
		// トグルの状態に基づいて表示するノートをフィルタリング
		const notesToDisplay = this.excludeLinkedNotes
			? this.relatedNotes.filter(
					(path) => !this.existingLinkPaths.has(path)
			  )
			: this.relatedNotes;

		// フィルタリング後のノートが0件の場合のメッセージを表示
		if (notesToDisplay.length === 0) {
			this.previewText = this.excludeLinkedNotes
				? "No new related notes found. Toggle the 'Exclude' option to see all suggestions."
				: "No related notes were found by the AI.";
			this.textArea.setValue(this.previewText);
			return;
		}

		const lines = notesToDisplay.map((path, index) => {
			const file = this.app.vault.getAbstractFileByPath(path);
			const tfile = file instanceof TFile ? file : null;

			// 1. 表示名とリンクテキストを決定する
			const fileName =
				tfile?.basename ||
				path.split("/").pop()?.replace(/\.md$/, "") ||
				path;
			const linkPath = tfile
				? this.app.metadataCache.fileToLinktext(tfile, "/", false)
				: path.replace(/\.md$/, "");
			const displayText = this.showFullPath ? linkPath : fileName;

			// 2. リンク形式を適用する
			let formattedLink: string;
			switch (this.linkStyle) {
				case "wikilink":
					// basenameのみのリンクにするか、フルパスにするかをshowFullPathで制御
					formattedLink = this.showFullPath
						? `[[${linkPath}]]`
						: `[[${fileName}]]`;
					break;
				case "markdown":
					// MarkdownリンクのパスはURIエンコードが必要
					formattedLink = `[${displayText}](${encodeURI(path)})`;
					break;
				case "none":
				default:
					formattedLink = displayText;
					break;
			}

			// 3. 接頭辞を追加する
			let prefix = "";
			switch (this.listPrefix) {
				case "dash":
					prefix = "- ";
					break;
				case "asterisk":
					prefix = "* ";
					break;
				case "numbered":
					prefix = `${index + 1}. `;
					break;
				case "none":
				default:
					break;
			}

			return `${prefix}${formattedLink}`;
		});

		this.previewText = lines.join("\n");
		this.textArea.setValue(this.previewText);
	}

	onClose() {
		this.contentEl.empty();
	}
}
