import type { Page } from "playwright";
import { expect } from "playwright/test";
import { ObsidianPageObject } from "./ObsidianPageObject";
import type { VaultPageTextContext } from "./types";

/**
 * AutoTagger専用のPage Object
 * AutoTagger機能のE2Eテストで使用するヘルパーメソッドを提供
 */
export class AutoTaggerPageObject extends ObsidianPageObject {
	constructor(
		page: Page,
		pluginHandleMap?: VaultPageTextContext["pluginHandleMap"],
	) {
		super(page, pluginHandleMap, { viewType: "auto-tag-view" });
	}

	// ===== AutoTagger View セレクタ =====

	get autoTagView(): ReturnType<typeof this.page.locator> {
		return this.page.locator('[data-type="auto-tag-view"]');
	}

	get startButton(): ReturnType<typeof this.page.locator> {
		return this.autoTagView.locator('button:has-text("開始")');
	}

	get stopButton(): ReturnType<typeof this.page.locator> {
		return this.autoTagView.locator('button:has-text("停止")');
	}

	get progressBar(): ReturnType<typeof this.page.locator> {
		return this.autoTagView.locator(".progress-bar");
	}

	get progressText(): ReturnType<typeof this.page.locator> {
		return this.autoTagView.locator(".progress-text");
	}

	get summarySection(): ReturnType<typeof this.page.locator> {
		return this.autoTagView.locator(".summary-section");
	}

	get logContainer(): ReturnType<typeof this.page.locator> {
		return this.autoTagView.locator(".log-container");
	}

	// ===== AutoTagger 設定操作 =====

	async setTargetDirectory(directory: string): Promise<void> {
		const input = this.autoTagView.locator("input#target-directory");
		await input.fill(directory);
	}

	async setExcludeNoteTag(tag: string): Promise<void> {
		const input = this.autoTagView.locator("input#exclude-note-tag");
		await input.fill(tag);
	}

	async setExcludeSuggestionTags(tags: string): Promise<void> {
		const input = this.autoTagView.locator("input#exclude-suggestion-tags");
		await input.fill(tags);
	}

	async setSystemInstruction(instruction: string): Promise<void> {
		const textarea = this.autoTagView.locator(
			"textarea#system-instruction",
		);
		await textarea.fill(instruction);
	}

	// ===== AutoTagger アクション =====

	async clickStart(): Promise<void> {
		await this.startButton.click();
	}

	async clickStop(): Promise<void> {
		await this.stopButton.click();
	}

	async waitForProcessingComplete(timeout = 60000): Promise<void> {
		await this.page.waitForFunction(
			() => {
				const summarySection =
					document.querySelector(".summary-section");
				return summarySection !== null;
			},
			{ timeout },
		);
	}

	async waitForProcessingStopped(timeout = 30000): Promise<void> {
		await this.page.waitForFunction(
			() => {
				const stopButton = document.querySelector(
					'button:has-text("停止")',
				);
				return stopButton && (stopButton as HTMLButtonElement).disabled;
			},
			{ timeout },
		);
	}

	// ===== AutoTagger データ取得 =====

	async getProgressText(): Promise<string | null> {
		return this.progressText.textContent();
	}

	async getSummaryData(): Promise<{
		totalNotes: number;
		successCount: number;
		errorCount: number;
		totalTagsApplied: number;
	} | null> {
		const summaryVisible = await this.summarySection.isVisible();
		if (!summaryVisible) return null;

		const text = await this.summarySection.textContent();
		if (!text) return null;

		// サマリーテキストから数値を抽出
		const totalNotesMatch = text.match(/総ノート数:\s*(\d+)/);
		const successMatch = text.match(/成功:\s*(\d+)/);
		const errorMatch = text.match(/失敗:\s*(\d+)/);
		const tagsMatch = text.match(/適用タグ総数:\s*(\d+)/);

		return {
			totalNotes: totalNotesMatch ? parseInt(totalNotesMatch[1]) : 0,
			successCount: successMatch ? parseInt(successMatch[1]) : 0,
			errorCount: errorMatch ? parseInt(errorMatch[1]) : 0,
			totalTagsApplied: tagsMatch ? parseInt(tagsMatch[1]) : 0,
		};
	}

	async getLogEntries(): Promise<string[]> {
		const logEntries = await this.logContainer.locator(".log-entry").all();
		return Promise.all(
			logEntries.map((entry) => entry.textContent() || ""),
		) as Promise<string[]>;
	}

	// ===== AutoTagger アサーション =====

	async expectAutoTagViewVisible(): Promise<void> {
		await expect(this.autoTagView).toBeVisible();
	}

	async expectStartButtonEnabled(): Promise<void> {
		await expect(this.startButton).toBeEnabled();
	}

	async expectStartButtonDisabled(): Promise<void> {
		await expect(this.startButton).toBeDisabled();
	}

	async expectStopButtonEnabled(): Promise<void> {
		await expect(this.stopButton).toBeEnabled();
	}

	async expectStopButtonDisabled(): Promise<void> {
		await expect(this.stopButton).toBeDisabled();
	}

	async expectProgressBarVisible(): Promise<void> {
		await expect(this.progressBar).toBeVisible();
	}

	async expectSummaryVisible(): Promise<void> {
		await expect(this.summarySection).toBeVisible();
	}

	async expectLogContains(text: string): Promise<void> {
		await expect(this.logContainer).toContainText(text);
	}

	// ===== ノート操作ヘルパー =====

	/**
	 * 複数のテストノートを一括作成
	 */
	async createTestNotes(
		count: number,
		pathPrefix: string,
		contentGenerator: (index: number) => string,
	): Promise<string[]> {
		const paths: string[] = [];

		for (let i = 0; i < count; i++) {
			const path = `${pathPrefix}/note-${i + 1}.md`;
			const content = contentGenerator(i);
			await this.writeFile(path, content);
			paths.push(path);
		}

		return paths;
	}

	/**
	 * 複数のノートを一括削除
	 */
	async deleteTestNotes(paths: string[]): Promise<void> {
		for (const path of paths) {
			await this.deleteFile(path);
		}
	}

	/**
	 * ノートのfrontmatterからタグを取得
	 */
	async getNoteTags(path: string): Promise<string[]> {
		const content = await this.readFile(path);
		const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

		if (!frontmatterMatch) return [];

		const frontmatter = frontmatterMatch[1];
		const tagsMatch = frontmatter.match(/tags:\n((?:  - .*\n)*)/);

		if (!tagsMatch) return [];

		const tagLines = tagsMatch[1].split("\n").filter((line) => line.trim());
		return tagLines.map((line) => line.replace(/^\s*-\s*/, ""));
	}

	/**
	 * ノートにタグが追加されたことを確認
	 */
	async expectNoteHasTags(path: string): Promise<void> {
		const tags = await this.getNoteTags(path);
		expect(tags.length).toBeGreaterThan(0);
	}

	/**
	 * ノートに特定のタグが含まれることを確認
	 */
	async expectNoteHasTag(path: string, tag: string): Promise<void> {
		const tags = await this.getNoteTags(path);
		expect(tags).toContain(tag);
	}

	/**
	 * ノートに特定のタグが含まれないことを確認
	 */
	async expectNoteDoesNotHaveTag(path: string, tag: string): Promise<void> {
		const tags = await this.getNoteTags(path);
		expect(tags).not.toContain(tag);
	}

	// ===== AutoTagger サービス直接操作 =====

	/**
	 * AutoTaggerサービスを直接実行（UIを経由しない）
	 */
	async runAutoTaggerDirectly(
		pluginId: string,
		targetDirectory: string,
		excludeTag = "",
	): Promise<{
		summary: any;
		finalState: any;
	}> {
		return this.page.evaluate(
			async ([pid, dir, tag]) => {
				const plugin = (window as any).app.plugins.getPlugin(
					pid,
				) as any;

				// 手動でノートをフィルタリング
				const allFiles = (window as any).app.vault.getMarkdownFiles();
				let targetNotes = allFiles;

				// ディレクトリでフィルタリング
				if (dir && dir.trim() !== "") {
					const normalizedDir = dir.replace(/^\/+|\/+$/g, "");
					targetNotes = targetNotes.filter((f: any) =>
						f.path.startsWith(normalizedDir),
					);
				}

				// 除外タグでフィルタリング
				if (tag && tag.trim() !== "") {
					const normalizedTag = tag.replace(/^#+/, "");
					const filteredNotes: any[] = [];

					for (const file of targetNotes) {
						const cache = (
							window as any
						).app.metadataCache.getFileCache(file);
						const hasExcludeTag =
							cache?.frontmatter?.tags?.includes(normalizedTag) ||
							cache?.tags?.some(
								(t: any) =>
									t.tag.replace(/^#+/, "") === normalizedTag,
							);

						if (!hasExcludeTag) {
							filteredNotes.push(file);
						}
					}

					targetNotes = filteredNotes;
				}

				const autoTagger = plugin.createAutoTagger();

				await autoTagger.start(
					targetNotes,
					() => {},
					() => {},
				);

				return {
					summary: autoTagger.getSummary(),
					finalState: autoTagger.getState(),
				};
			},
			[pluginId, targetDirectory, excludeTag] as const,
		);
	}

	/**
	 * プラグイン設定を更新
	 */
	async updatePluginSettings(
		pluginId: string,
		settings: {
			targetDirectory?: string;
			excludeNoteTag?: string;
			excludeSuggestionTags?: string[];
			systemInstruction?: string;
		},
	): Promise<void> {
		await this.page.evaluate(
			async ([pid, newSettings]) => {
				const plugin = (window as any).app.plugins.getPlugin(
					pid,
				) as any;

				if (newSettings.targetDirectory !== undefined) {
					plugin.settings.autoTagger.targetDirectory =
						newSettings.targetDirectory;
				}
				if (newSettings.excludeNoteTag !== undefined) {
					plugin.settings.autoTagger.excludeNoteTag =
						newSettings.excludeNoteTag;
				}
				if (newSettings.excludeSuggestionTags !== undefined) {
					plugin.settings.autoTagger.excludeSuggestionTags =
						newSettings.excludeSuggestionTags;
				}
				if (newSettings.systemInstruction !== undefined) {
					plugin.settings.autoTagger.systemInstruction =
						newSettings.systemInstruction;
				}

				await plugin.saveSettings();
			},
			[pluginId, settings] as const,
		);
	}
}
