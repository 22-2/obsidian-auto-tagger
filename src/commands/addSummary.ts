import { App, Notice } from "obsidian";
import { buildSummaryPrompt, callGeminiApi } from "src/api/gemini";
import type { PersonalContextSettings } from "src/settings";
import { splitMd } from "src/utils/markdown";

/**
 * AIを使用して「要約」を生成し、フロントマターに追加するコマンド。
 * @param app ObsidianのAppインスタンス
 * @param settings プラグインの設定
 */
export async function addSummary(app: App, settings: PersonalContextSettings) {
	if (!settings.common.geminiApiKey) {
		new Notice("Gemini API key is not set in the plugin settings.");
		return;
	}

	const activeFile = app.workspace.getActiveFile();
	if (!activeFile) {
		new Notice("No active file is open.");
		return;
	}

	const notice = new Notice("AI is generating a summary...", 0);

	try {
		// 1. ノートの内容を取得
		const fileContent = await app.vault.read(activeFile);
		const split = splitMd(fileContent);

		// 2. プロンプトを構築
		const prompt = buildSummaryPrompt(activeFile.basename, split.content);

		// 3. APIを呼び出し
		const responseText = await callGeminiApi(prompt, settings);

		// 4. レスポンスをパース
		let result: { summary: string };
		try {
			result = JSON.parse(responseText);
		} catch (e) {
			console.error(
				"Failed to parse JSON from API response:",
				responseText
			);
			throw new Error("Invalid JSON response from API.");
		}

		if (result.summary) {
			// 5. フロントマターを更新
			await app.fileManager.processFrontMatter(activeFile, (fm) => {
				fm.summary = result.summary;
			});
			notice.hide();
			new Notice(`Summary added to the frontmatter.`);
		} else {
			throw new Error("Could not get a summary from AI.");
		}
	} catch (error) {
		notice.hide();
		console.error("Error adding summary:", error);
		new Notice(
			"Failed to add summary. Check developer console for details."
		);
	}
}
