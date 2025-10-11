import { requestUrl } from "obsidian";
import type { PersonalContextSettings } from "src/settings";
import type { AutoTagBatchNote, BatchNoteData } from "src/utils/types";

/**
 * Gemini APIを呼び出して、関連ノートのリストを取得します。
 * @param prompt APIに送信するプロンプト
 * @param settings プラグインの設定
 * @returns APIからのレスポンス(JSON文字列)
 */
export async function callGeminiApi(
	prompt: string,
	settings: PersonalContextSettings
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
 * Gemini APIに送信するための「ひとこと要約」プロンプトを構築します。
 * @param noteTitle 現在のノートのタイトル
 * @param noteContent 現在のノートの内容
 * @returns 生成されたプロンプト文字列
 */
export function buildSummaryPrompt(
	noteTitle: string,
	noteContent: string
): string {
	return `
You are an expert copywriter and a meticulous editor, specializing in creating insightful and comprehensive summaries for knowledge management.

## Task
Your goal is to analyze the provided note and generate a single, unified "summary" for it. This summary will be stored in the note's frontmatter.

## Note to Analyze
- Title: "${noteTitle}"
- Content:
---
${noteContent}
---

## Instructions
1.  **Deep Analysis**: Read the title and content to fully grasp the note's core message, arguments, and purpose.
2.  **Synthesize a Summary**: Create a comprehensive summary in Japanese. The summary should:
    *   Start with a single, catchy, and concise sentence that captures the absolute essence of the note.
    *   Follow that sentence with a newline, and then add 2-3 sentences of further explanation, elaborating on the main theme and key takeaways.
3.  **Output Format**:
    *   Your response MUST be a valid JSON object and nothing else.
    *   The JSON object must have a single key: \`"summary"\`.
    *   The value of this key must be the complete summary string you crafted (catchy sentence + newline + explanation).

## Example Output
{
  "summary": "AIが思考を拡張する第二の脳になる。\\nこのノートは、AIを知識労働者の思考パートナーと位置づけ、その具体的な活用法を探るものです。中心的なアイデアである「思考の拡張」を「第二の脳」という比喩で表現しました。"
}
`;
}

/**
 * Gemini APIに送信するためのプロンプトを構築します。
 * @param sourcePath 現在のノートのパス
 * @param sourceContent 現在のノートの内容
 * @param noteList Vault内の全ノートのメタデータリスト
 * @param includeNoteContent コンテキストにノートの内容を含めるかどうか
 * @returns 生成されたプロンプト文字列
 */
export function buildPrompt(
	sourcePath: string,
	sourceContent: string,
	noteList: object[],
	includeNoteContent: boolean
): string {
	const availableNotesDescription = includeNoteContent
		? "Path, metadata, and the first 500 characters of content"
		: "Path and metadata";

	return `
You are an expert knowledge management assistant integrated into Obsidian.
Your task is to find notes that are conceptually related to a source note from a list of all available notes.

## Source Note
- Path: "${sourcePath}"
- Content (first 2000 characters):
---
${sourceContent.substring(0, 2000)}
---

## Available Notes in Vault (${availableNotesDescription})
${JSON.stringify(noteList, null, 2)}

## Instructions
1. Analyze the content and metadata of the "Source Note".
2. From the "Available Notes" list, identify up to 10 notes that are most related.
3. Determine relatedness based on shared concepts, themes, or topics. Do not simply match tags. If 'content' is provided for available notes, prioritize it for conceptual analysis.
4. Your response MUST be a valid JSON object and nothing else.
5. The JSON object must have a single key "relatedNotes", which is an array of strings. Each string is a file path.
6. Order the file paths from most relevant to least relevant. If no notes are related, return an empty array.

Example output:
{
  "relatedNotes": [
    "path/to/highly_related_note.md",
    "path/to/another_related_note.md"
  ]
}
`;
}

/**
 * Gemini APIに送信するためのタグ提案プロンプトを構築します。
 * @param noteTitle 現在のノートのタイトル
 * @param noteContent 現在のノートの内容
 * @param allTags Vault内に存在する全タグのリスト
 * @param existingTags ノートに既に存在するタグのリスト
 * @returns 生成されたプロンプト文字列
 */
export function buildTagSuggestionPrompt(
	noteTitle: string,
	noteContent: string,
	allTags: string[],
	existingTags: string[]
): string {
	const tagsToSuggestFrom = allTags.filter(
		(tag) => !existingTags.includes(tag)
	);

	return `
You are an expert content analyst specializing in tagging and categorization within a personal knowledge management system.
Your task is to analyze the provided note and suggest relevant tags from a pre-existing list of tags in the vault.

## Note to Analyze
- Title: "${noteTitle}"
- Content (first 2000 characters):
---
${noteContent.substring(0, 2000)}
---

## Available Tags in Vault
Here is a list of all available tags. You must choose from this list.
${JSON.stringify(tagsToSuggestFrom, null, 2)}

## Instructions
1.  Deeply analyze the title and content of the "Note to Analyze".
2.  Identify the core concepts, topics, and themes of the note.
3.  From the "Available Tags in Vault" list, select up to 5 tags that best represent the note's content.
4.  Do NOT suggest tags that are already present on the note. The "Available Tags in Vault" list has already been filtered for you.
5.  If no tags from the list are relevant, return an empty array.
6.  Your response MUST be a valid JSON object and nothing else.
7.  The JSON object must have a single key "suggestedTags", which is an array of strings. Each string is a tag name (without the '#').

Example output:
{
  "suggestedTags": [
    "productivity",
    "project-management",
    "ai"
  ]
}
`;
}

/**
 * 複数のノートに対してタグとキーワードを提案するためのプロンプトを構築します。
 * @param notesData 処理対象のノート情報の配列
 * @param allVaultTags Vault内に存在する全タグのリスト
 * @param allBasesKeywords Basesビュー内に存在する全キーワードのリスト
 * @returns 生成されたプロンプト文字列
 */
export function buildBatchTaggingPrompt(
	notesData: BatchNoteData[],
	allVaultTags: string[],
	allBasesKeywords: string[]
): string {
	return `
You are an expert knowledge management assistant. Your task is to analyze a batch of notes and suggest relevant tags and keywords for each one.

## Instructions
1.  For each note provided in the "Notes to Process" section, analyze its path, existing frontmatter, and content.
2.  **Suggest Tags**:
    -   Identify up to 5 relevant tags for each note.
    -   **Strongly prioritize suggesting tags from the "Available Tags in Vault" list.**
    -   You may suggest a new tag only if it's highly relevant and a suitable one is not on the list.
    -   Do not suggest tags that already exist in the note's frontmatter.
3.  **Suggest Keywords**:
    -   Identify 3 to 5 keywords or short phrases that summarize the core topics of the note.
    -   **Strongly prioritize suggesting keywords from the "Available Keywords in Bases" list.**
    -   Keywords should be concise and useful for search and discovery.
4.  **Output Format**:
    -   Your response MUST be a single, valid JSON object and nothing else.
    -   The JSON object must have a single key "suggestions".
    -   The value of "suggestions" must be an array of objects, where each object represents a note.
    -   Each note object must have three keys: "path" (string), "suggestedTags" (array of strings), and "suggestedKeywords" (array of strings).

## Available Tags in Vault
${JSON.stringify(allVaultTags, null, 2)}

## Available Keywords in Bases
${JSON.stringify(allBasesKeywords, null, 2)}

## Notes to Process
${JSON.stringify(notesData, null, 2)}

## Example Output
{
  "suggestions": [
    {
      "path": "path/to/note1.md",
      "suggestedTags": ["project-management", "productivity", "new-tag"],
      "suggestedKeywords": ["agile methodology", "sprint planning", "team collaboration"]
    },
    {
      "path": "path/to/note2.md",
      "suggestedTags": ["ai", "machine-learning"],
      "suggestedKeywords": ["large language models", "transformer architecture", "AI ethics"]
    }
  ]
}
`;
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
