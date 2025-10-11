import { requestUrl } from "obsidian";
import type { AutoTaggerSettings } from "src/settings";
import type { AutoTagBatchNote } from "src/utils/types";

/**
 * Gemini APIを呼び出して、関連ノートのリストを取得します。
 * @param prompt APIに送信するプロンプト
 * @param settings プラグインの設定
 * @returns APIからのレスポンス(JSON文字列)
 */
export async function callGeminiApi(
	prompt: string,
	settings: AutoTaggerSettings
): Promise<string> {
	const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${settings.common.geminiModel}:generateContent?key=${settings.common.geminiApiKey}`;

	const isThinkingModel = settings.common.geminiModel.includes("2.5");

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const requestBody: any = {
		contents: [{ parts: [{ text: prompt }] }],
		generationConfig: {
			response_mime_type: "application/json",
		},
	};

	if (isThinkingModel) {
		if (
			settings.common.enableThinkingMode ||
			settings.common.geminiModel.includes("2.5-pro")
		) {
			requestBody.generationConfig.thinkingConfig = {
				thinkingBudget: -1,
			};
		} else {
			requestBody.generationConfig.thinkingConfig = {
				thinkingBudget: 0,
			};
		}
	}

	const response = await requestUrl({
		url: apiUrl,
		method: "POST",
		contentType: "application/json",
		body: JSON.stringify(requestBody),
		throw: false, // 4xx/5xxエラーで例外をスローさせない
	});

	if (response.status !== 200) {
		console.error("Gemini API Error:", response.text);
		throw new Error(
			`API request failed with status ${response.status}. Full response: ${response.text}`
		);
	}

	if (!response.json.candidates?.[0]?.content?.parts?.[0]?.text) {
		console.error("Unexpected API response structure:", response.json);
		throw new Error("Failed to parse the response from Gemini API.");
	}

	return response.json.candidates[0].content.parts[0].text;
}

/**
 * 自動タグ付けバッチ処理用のプロンプトを構築します。
 * @param notes 処理対象のノート情報の配列（最大5件）
 * @param availableTags Vault内に存在する全タグのリスト（除外タグでフィルタリング済み）
 * @param systemInstruction カスタムsystem instruction
 * @returns 生成されたプロンプト文字列
 */
export function buildAutoTaggingPrompt(
	notes: AutoTagBatchNote[],
	availableTags: string[],
	systemInstruction: string
): string {
	// 各ノートから既存タグを除外したタグリストを作成
	const notesWithFilteredTags = notes.map((note) => {
		const tagsToSuggestFrom = availableTags.filter(
			(tag) => !note.existingTags.includes(tag)
		);
		return {
			path: note.path,
			title: note.title,
			content: note.content.substring(0, 2000), // 最初の2000文字のみ
			existingTags: note.existingTags,
			availableTagsForThisNote: tagsToSuggestFrom,
		};
	});

	return `
${systemInstruction}

## Task
Your task is to analyze a batch of notes and suggest relevant tags for each one from the available tags in the vault.

## Instructions
1.  For each note provided in the "Notes to Process" section, analyze its title, existing tags, and content.
2.  **Suggest Tags**:
    -   Identify up to 5 relevant tags for each note.
    -   **You MUST only suggest tags from the "Available Tags for This Note" list provided for each note.**
    -   Do not suggest tags that already exist in the note's existing tags.
    -   If no suitable tags are available, return an empty array for that note.
3.  **Output Format**:
    -   Your response MUST be a single, valid JSON object and nothing else.
    -   The JSON object must have a single key "suggestions".
    -   The value of "suggestions" must be an array of objects, where each object represents a note.
    -   Each note object must have two keys: "path" (string) and "suggestedTags" (array of strings).
    -   The order of notes in the output must match the order in the input.

## Notes to Process
${JSON.stringify(notesWithFilteredTags, null, 2)}

## Example Output
{
  "suggestions": [
    {
      "path": "path/to/note1.md",
      "suggestedTags": ["project-management", "productivity", "ai"]
    },
    {
      "path": "path/to/note2.md",
      "suggestedTags": ["machine-learning", "deep-learning"]
    },
    {
      "path": "path/to/note3.md",
      "suggestedTags": []
    }
  ]
}
`;
}
