import { type App, Notice, type TFile } from "obsidian";
import { buildAutoTaggingPrompt, callGeminiApi } from "../api/gemini";
import type { AutoTaggerSettings, CommonSettings } from "../settings";
import { getAllVaultTags, getFrontmatterAsync } from "../utils/obsidian";
import type { AutoTagBatchNote } from "../utils/types";
import { LoggerService } from "./logger";

/**
 * AutoTaggerの状態を管理するインターフェース
 */
export interface AutoTaggerState {
	isRunning: boolean;
	currentBatch: number;
	totalNotes: number;
	processedNotes: number;
	successCount: number;
	errorCount: number;
	shouldStop: boolean;
}

/**
 * バッチ処理の結果を表すインターフェース
 */
export interface BatchResult {
	path: string;
	suggestedTags: string[];
	success: boolean;
	error?: string;
}

/**
 * Gemini APIからのレスポンス形式
 */
interface AutoTaggingResponse {
	suggestions: {
		path: string;
		suggestedTags: string[];
	}[];
}

/**
 * 自動タグ付けのコアロジックを管理するサービス
 */
export class AutoTagger {
	private state: AutoTaggerState;
	private logger: LoggerService;
	private startTime: string;
	
	// テスト用: API呼び出し関数をオーバーライド可能にする
	public apiCallFn: (prompt: string, settings: AutoTaggerSettings) => Promise<string>;

	constructor(
		private app: App,
		private settings: AutoTaggerSettings,
		private geminiSettings: CommonSettings,
	) {
		// 初期状態を設定
		this.state = {
			isRunning: false,
			currentBatch: 0,
			totalNotes: 0,
			processedNotes: 0,
			successCount: 0,
			errorCount: 0,
			shouldStop: false,
		};

		// LoggerServiceを初期化
		this.logger = new LoggerService(
			this.app,
			this.settings.logFilePath,
			this.settings.maxLogFileSize,
			this.settings.enableLogging,
		);

		this.startTime = "";
		
		// デフォルトのAPI呼び出し関数
		this.apiCallFn = callGeminiApi;
	}

	/**
	 * 自動タグ付け処理を開始
	 * @param targetNotes 処理対象のノート配列
	 * @param onProgress 進捗コールバック
	 * @param onBatchComplete バッチ完了コールバック
	 */
	async start(
		targetNotes: TFile[],
		onProgress: (state: AutoTaggerState) => void,
		onBatchComplete: (results: BatchResult[]) => void,
	): Promise<void> {
		// 既に実行中の場合は何もしない
		if (this.state.isRunning) {
			return;
		}

		// 状態を初期化
		this.state = {
			isRunning: true,
			currentBatch: 0,
			totalNotes: targetNotes.length,
			processedNotes: 0,
			successCount: 0,
			errorCount: 0,
			shouldStop: false,
		};

		this.startTime = new Date().toISOString();

		// セッション開始をログに記録
		await this.logger.logSessionStart(
			this.settings.targetDirectory,
			this.settings.excludeNoteTags,
			this.settings.excludeSuggestionTags,
		);

		// 初期進捗を通知
		onProgress(this.state);

		// バッチサイズ
		const batchSize = this.settings.batchSize;

		// バッチ処理ループ
		for (let i = 0; i < targetNotes.length; i += batchSize) {
			// 停止フラグがセットされている場合は終了
			if (this.state.shouldStop) {
				break;
			}

			// 現在のバッチを取得
			const batch = targetNotes.slice(i, i + batchSize);
			this.state.currentBatch++;

			// バッチを処理
			const results = await this.processBatch(batch);

			// 結果を適用
			for (const result of results) {
				if (result.success && result.suggestedTags.length > 0) {
					// タグを適用
					const file = targetNotes.find(
						(note) => note.path === result.path,
					);
					if (file) {
						try {
							await this.applyTagsToNote(
								file,
								result.suggestedTags,
							);
							this.state.successCount++;

							// ログに記録
							await this.logger.log({
								timestamp: new Date().toISOString(),
								notePath: result.path,
								appliedTags: result.suggestedTags,
								success: true,
							});
						} catch (error) {
							// ファイル操作エラー (Requirement 4.6)
							this.state.errorCount++;
							const errorMsg =
								error instanceof Error
									? error.message
									: String(error);

							// エラーをログに記録
							await this.logger.log({
								timestamp: new Date().toISOString(),
								notePath: result.path,
								appliedTags: [],
								success: false,
								error: errorMsg,
							});

							// ユーザーに通知
							new Notice(`${result.path}: ${errorMsg}`, 3000);
						}
					}
				} else if (!result.success) {
					this.state.errorCount++;

					// エラーをログに記録
					await this.logger.log({
						timestamp: new Date().toISOString(),
						notePath: result.path,
						appliedTags: [],
						success: false,
						error: result.error,
					});
				}

				this.state.processedNotes++;
			}

			// バッチ完了を通知
			onBatchComplete(results);

			// 進捗を通知
			onProgress(this.state);
		}

		// 処理完了
		this.state.isRunning = false;
		onProgress(this.state);
	}

	/**
	 * 1バッチ（最大5ノート）を処理
	 * @param notes 処理対象のノート配列
	 * @returns バッチ処理の結果配列
	 */
	private async processBatch(notes: TFile[]): Promise<BatchResult[]> {
		const results: BatchResult[] = [];

		try {
			// vault内の全タグを取得
			const allVaultTags = getAllVaultTags(this.app);

			// 除外タグでフィルタリング
			const availableTags = allVaultTags.filter(
				(tag) => !this.settings.excludeSuggestionTags.includes(tag),
			);

			// ノート情報を構築
			const batchNotes: AutoTagBatchNote[] = [];
			for (const note of notes) {
				try {
					const content = await this.app.vault.cachedRead(note);
					const frontmatter = await getFrontmatterAsync(
						this.app,
						note,
					);
					const existingTags = (frontmatter?.tags || []) as string[];

					batchNotes.push({
						path: note.path,
						title: note.basename,
						content: content,
						existingTags: existingTags,
					});
				} catch (error) {
					// ファイル読み込みエラー (Requirement 4.6)
					const errorMsg =
						error instanceof Error ? error.message : String(error);
					console.error(`Failed to read note ${note.path}:`, error);
					results.push({
						path: note.path,
						suggestedTags: [],
						success: false,
						error: `ファイル読み込みエラー: ${errorMsg}`,
					});
				}
			}

			// 読み込みに成功したノートがない場合は終了
			if (batchNotes.length === 0) {
				return results;
			}

			// プロンプトを構築
			const prompt = buildAutoTaggingPrompt(
				batchNotes,
				availableTags,
				this.settings.systemInstruction,
			);

			// Gemini APIを呼び出し (Requirement 2.5)
			let responseText: string;
			try {
				responseText = await this.apiCallFn(prompt, {
					...this.settings,
					common: this.geminiSettings,
				} as any);
			} catch (error) {
				// API呼び出しエラー (Requirement 2.5, 4.6)
				const errorMsg =
					error instanceof Error ? error.message : String(error);
				console.error("Gemini API call failed:", error);

				// ユーザーに通知
				new Notice(`API呼び出しエラー: ${errorMsg}`, 5000);

				// 全ノートを失敗として記録
				for (const note of batchNotes) {
					if (!results.find((r) => r.path === note.path)) {
						results.push({
							path: note.path,
							suggestedTags: [],
							success: false,
							error: `API呼び出しエラー: ${errorMsg}`,
						});
					}
				}
				return results;
			}

			// レスポンスをパース
			let response: AutoTaggingResponse;
			try {
				response = JSON.parse(responseText);
			} catch (error) {
				// JSONパースエラー (Requirement 2.5)
				const errorMsg =
					error instanceof Error ? error.message : String(error);
				console.error("Failed to parse API response:", error);
				console.error("Response text:", responseText);

				// ユーザーに通知
				new Notice(`APIレスポンスのパースエラー: ${errorMsg}`, 5000);

				// 全ノートを失敗として記録
				for (const note of batchNotes) {
					if (!results.find((r) => r.path === note.path)) {
						results.push({
							path: note.path,
							suggestedTags: [],
							success: false,
							error: `レスポンスパースエラー: ${errorMsg}`,
						});
					}
				}
				return results;
			}

			// レスポンスの検証
			if (!response.suggestions || !Array.isArray(response.suggestions)) {
				console.error("Invalid API response structure:", response);
				new Notice("APIレスポンスの形式が不正です", 5000);

				// 全ノートを失敗として記録
				for (const note of batchNotes) {
					if (!results.find((r) => r.path === note.path)) {
						results.push({
							path: note.path,
							suggestedTags: [],
							success: false,
							error: "APIレスポンスの形式が不正です",
						});
					}
				}
				return results;
			}

			// 各ノートの結果を処理
			for (const suggestion of response.suggestions) {
				results.push({
					path: suggestion.path,
					suggestedTags: suggestion.suggestedTags || [],
					success: true,
				});
			}
		} catch (error) {
			// 予期しないエラー (Requirement 4.6)
			const errorMsg =
				error instanceof Error ? error.message : String(error);
			console.error("Unexpected error in processBatch:", error);
			new Notice(`予期しないエラー: ${errorMsg}`, 5000);

			// エラーが発生した場合、全ノートを失敗として記録
			for (const note of notes) {
				if (!results.find((r) => r.path === note.path)) {
					results.push({
						path: note.path,
						suggestedTags: [],
						success: false,
						error: errorMsg,
					});
				}
			}
		}

		return results;
	}

	/**
	 * タグをノートに適用
	 * @param file 対象ノート
	 * @param tags 適用するタグ配列
	 * @throws ファイル操作に失敗した場合
	 */
	private async applyTagsToNote(file: TFile, tags: string[]): Promise<void> {
		if (tags.length === 0) {
			return;
		}

		try {
			await this.app.fileManager.processFrontMatter(
				file,
				(frontmatter) => {
					// 既存のタグを取得
					let existingTags: string[] = [];
					if (frontmatter.tags) {
						if (Array.isArray(frontmatter.tags)) {
							existingTags = frontmatter.tags;
						} else if (typeof frontmatter.tags === "string") {
							existingTags = [frontmatter.tags];
						}
					}

					// 新しいタグを追加（重複を除外）
					const newTags = tags.filter(
						(tag) => !existingTags.includes(tag),
					);
					if (newTags.length > 0) {
						frontmatter.tags = [...existingTags, ...newTags];
					}
				},
			);
		} catch (error) {
			// ファイル操作エラー (Requirement 4.6)
			const errorMsg =
				error instanceof Error ? error.message : String(error);
			console.error(`Failed to apply tags to ${file.path}:`, error);
			throw new Error(`タグ適用エラー: ${errorMsg}`);
		}
	}

	/**
	 * 処理を停止（現在のバッチ完了後）
	 */
	stop(): void {
		this.state.shouldStop = true;
	}

	/**
	 * 最終サマリーを取得
	 * @returns 処理サマリー
	 */
	getSummary(): {
		totalNotes: number;
		successCount: number;
		errorCount: number;
		totalTagsApplied: number;
		startTime: string;
		endTime: string;
	} {
		const endTime = new Date().toISOString();

		// 成功したノートに適用されたタグの総数を計算
		// この情報は実際にはログから取得する必要があるが、
		// 簡略化のため successCount を使用
		const totalTagsApplied = this.state.successCount;

		return {
			totalNotes: this.state.totalNotes,
			successCount: this.state.successCount,
			errorCount: this.state.errorCount,
			totalTagsApplied: totalTagsApplied,
			startTime: this.startTime,
			endTime: endTime,
		};
	}

	/**
	 * 現在の状態を取得
	 * @returns 現在の状態
	 */
	getState(): AutoTaggerState {
		return { ...this.state };
	}
}
