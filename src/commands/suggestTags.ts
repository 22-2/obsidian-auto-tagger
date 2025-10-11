import { App, Notice, TFile, getAllTags } from "obsidian";
import { buildTagSuggestionPrompt, callGeminiApi } from "src/api/gemini";
import type { PersonalContextSettings } from "src/settings";
import { SuggestTagsModal } from "src/ui/SuggestTagsModal";
import { getAllVaultTags } from "src/utils/obsidian";

/**
 * AIを使用してタグを提案し、適用するコマンドの本体。
 * @param app ObsidianのAppインスタンス
 * @param settings プラグインの設定
 */
export async function suggestTags(app: App, settings: PersonalContextSettings) {
	if (!settings.common.geminiApiKey) {
		new Notice("Gemini API key is not set in the plugin settings.");
		return;
	}

	const activeFile = app.workspace.getActiveFile();
	if (!activeFile) {
		new Notice("No active file is open.");
		return;
	}

	const notice = new Notice("AI is suggesting tags...", 0);

	try {
		// 1. Vault内に存在するすべてのタグを取得し、'#'を除去
		const allVaultTags = getAllVaultTags(app);

		// 2. 現在のノートの情報を取得
		const fileContent = await app.vault.cachedRead(activeFile);
		const fileCache = app.metadataCache.getFileCache(activeFile);

		// 3. 現在のノートにすでに存在するタグ（フロントマターと本文の両方）を取得
		const existingTagsWithHash = fileCache
			? getAllTags(fileCache) ?? []
			: [];
		const existingTags = existingTagsWithHash.map((tag) =>
			tag.substring(1)
		);

		// 4. プロンプトを構築
		const prompt = buildTagSuggestionPrompt(
			activeFile.basename,
			fileContent,
			allVaultTags,
			existingTags
		);

		// 5. APIを呼び出し
		const responseText = await callGeminiApi(prompt, settings);

		// 6. レスポンスをパース
		let result: { suggestedTags: string[] };
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

		// 7. AIの提案から、すでにノートに存在するタグを再度除外し、結果をモーダルで表示
		if (result.suggestedTags && Array.isArray(result.suggestedTags)) {
			const existingTagsSet = new Set(existingTags);
			const newSuggestedTags = result.suggestedTags.filter(
				(tag) => !existingTagsSet.has(tag)
			);

			if (newSuggestedTags.length > 0) {
				new SuggestTagsModal(app, activeFile, newSuggestedTags).open();
			} else {
				new Notice("No new tag suggestions found.");
			}
		} else {
			new Notice("Could not get tag suggestions from AI.");
		}
	} catch (error) {
		notice.hide();
		console.error("Error suggesting tags:", error);
		new Notice(
			"Failed to get tag suggestions. Check developer console for details."
		);
	}
}
