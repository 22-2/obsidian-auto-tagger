import { App, Notice, getAllTags } from "obsidian"; // getAllTags をインポート
import { BasesView } from "obsidian-typings";
import { buildBatchTaggingPrompt, callGeminiApi } from "src/api/gemini";
import { PersonalContextSettings } from "src/settings";
import { SuggestTagsAndKeywordsModal } from "src/ui/SuggestTagsAndKeywordsModal";
import {
	getAllKeywordsFromActiveBasesView,
	getBasesDataRows,
} from "src/utils/bases";
import { getAllVaultTags } from "src/utils/obsidian";
import {
	AISuggestion,
	BatchNoteData,
	type BasesDataItem,
} from "src/utils/types";

export async function suggestTagsAndKeywordsForBases(
	app: App,
	settings: PersonalContextSettings
) {
	if (!settings.common.geminiApiKey) {
		new Notice("Gemini API key is not set in the plugin settings.");
		return;
	}

	if (!app.internalPlugins.plugins.bases) {
		new Notice("The 'Bases' plugin is not enabled.");
		return;
	}

	const basesLeaves = app.workspace.getLeavesOfType("bases");
	if (basesLeaves.length === 0) {
		new Notice("No Bases view is currently open.");
		return;
	}
	const view = basesLeaves[0].view as unknown as BasesView;

	const notice = new Notice("Gathering notes from Bases view...", 0);

	try {
		// 1. Basesビューから全ノートを取得
		const allBasesItems: BasesDataItem[] = getBasesDataRows(view);

		// 2. 各ノートのタグ数を正確に計算するヘルパー関数 (本文とフロントマターの両方)
		const getTagCount = (item: BasesDataItem): number => {
			const fileCache = app.metadataCache.getFileCache(item.file);
			if (!fileCache) return 0;
			// getAllTagsは '#tag' の形式でタグの配列を返すので、その長さを取得
			const tags = getAllTags(fileCache) ?? [];
			return tags.length;
		};

		// 3. タグの数が少ない順にノートをソート
		allBasesItems.sort((a, b) => getTagCount(a) - getTagCount(b));

		// 4. ソートされたリストの先頭から指定された数だけノートを取得
		const basesDataItems = allBasesItems.slice(
			0,
			settings.basesSuggester.sampleSize
		);

		if (basesDataItems.length === 0) {
			notice.hide();
			new Notice("No notes found in the Bases view to process.");
			return;
		}

		notice.setMessage("AI is suggesting tags and keywords...");

		// 5. Vault全体のタグリストとBasesのキーワードリストを取得
		const allVaultTags = getAllVaultTags(app);
		const allBasesKeywords = getAllKeywordsFromActiveBasesView(app);

		// 6. AIに渡すためのノート情報を準備
		const notesData: BatchNoteData[] = await Promise.all(
			basesDataItems.map(async (item) => {
				const content = await app.vault.cachedRead(item.file);
				return {
					path: item.file.path,
					content: content.substring(0, 2000),
					frontmatter: item.frontmatter,
				};
			})
		);

		// 7. プロンプトを構築してAPIを呼び出し
		const prompt = buildBatchTaggingPrompt(
			notesData,
			allVaultTags,
			allBasesKeywords
		);
		const responseText = await callGeminiApi(prompt, settings);

		// 8. レスポンスをパース
		let result: { suggestions: AISuggestion[] };
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

		// 9. モーダルで結果を表示
		if (result.suggestions && result.suggestions.length > 0) {
			new SuggestTagsAndKeywordsModal(app, result.suggestions).open();
		} else {
			new Notice("AI did not return any suggestions.");
		}
	} catch (error) {
		notice.hide();
		console.error("Error suggesting tags and keywords:", error);
		new Notice(
			"Failed to get suggestions. Check developer console for details."
		);
	}
}
