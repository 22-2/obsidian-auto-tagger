import { sampleSize } from "es-toolkit";
import { App, Notice } from "obsidian";
import { buildPrompt, callGeminiApi } from "src/api/gemini";
import type { PersonalContextSettings } from "src/settings";
import { RelatedNotesModal } from "src/ui/RelatedNotesModal";
import { getAllOutgoingLinks } from "src/utils/obsidian";

/**
 * AIを使用して関連ノートを提案し、結果を表示するコマンドの本体。
 * @param app ObsidianのAppインスタンス
 * @param settings プラグインの設定
 */
export async function suggestRelatedNotes(
	app: App,
	settings: PersonalContextSettings
) {
	if (!settings.common.geminiApiKey) {
		new Notice("Gemini API key is not set in the plugin settings.");
		return;
	}

	const activeFile = app.workspace.getActiveFile();
	if (!activeFile) {
		new Notice("No active file is open.");
		return;
	}

	const notice = new Notice("AI is suggesting related notes...", 0);

	try {
		// 現在のノートからすでにあるリンクを取得
		const existingLinks = await getAllOutgoingLinks(app, activeFile);
		const existingLinkPaths = new Set(
			existingLinks
				.map((link) => link.file?.path)
				.filter((path): path is string => !!path)
		);

		const activeFileContent = await app.vault.cachedRead(activeFile);

		let allFiles = app.vault
			.getMarkdownFiles()
			.filter((file) => file.path !== activeFile.path);

		// 設定に応じてソートまたはシャッフル (設定パスをaiContextに変更)
		if (settings.aiContext.noteSortOrder === "recent") {
			allFiles.sort((a, b) => b.stat.mtime - a.stat.mtime);
		} else if (settings.aiContext.noteSortOrder === "random") {
			allFiles = sampleSize(
				allFiles,
				settings.aiContext.maxNotesToProcess
			);
		}

		// 設定された最大数に絞り込む (設定パスをaiContextに変更)
		const filesToProcess = allFiles.slice(
			0,
			settings.aiContext.maxNotesToProcess
		);

		const noteListPromises = filesToProcess.map(async (file) => {
			const cache = app.metadataCache.getFileCache(file);
			const metadata: {
				path: string;
				tags: unknown;
				aliases: unknown;
				content?: string;
			} = {
				path: file.path,
				tags: cache?.frontmatter?.tags || null,
				aliases: cache?.frontmatter?.aliases || null,
			};

			// 設定パスをaiContextに変更
			if (settings.aiContext.includeNoteContentInContext) {
				const content = await app.vault.cachedRead(file);
				metadata.content = content.substring(0, 500);
			}
			return metadata;
		});

		const allNotesMetadata = await Promise.all(noteListPromises);

		const prompt = buildPrompt(
			activeFile.path,
			activeFileContent,
			allNotesMetadata,
			settings.aiContext.includeNoteContentInContext // 設定パスをaiContextに変更
		);

		const responseText = await callGeminiApi(prompt, settings);

		let result: { relatedNotes: string[] };
		try {
			result = JSON.parse(responseText);
		} catch (e) {
			console.error(
				"Failed to parse JSON from API response:",
				responseText
			);
			throw new Error("Invalid JSON response from API.");
		}

		notice.hide();

		const suggestedNotePaths = result.relatedNotes || [];

		if (suggestedNotePaths.length > 0) {
			// 提案結果と既存リンクの情報を両方モーダルに渡す
			new RelatedNotesModal(
				app,
				suggestedNotePaths,
				existingLinkPaths
			).open();
		} else {
			new Notice("No related notes were found.");
		}
	} catch (error) {
		notice.hide();
		console.error("Error suggesting related notes:", error);
		new Notice(
			"Failed to get related notes. Check developer console for details."
		);
	}
}
