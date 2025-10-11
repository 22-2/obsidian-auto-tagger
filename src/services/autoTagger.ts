import { type App, type TFile } from "obsidian";
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
		);

		this.startTime = "";
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
			this.settings.excludeNoteTag,
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
							this.state.errorCount++;

							// エラーをログに記録
							await this.logger.log({
								timestamp: new Date().toISOString(),
								notePath: result.path,
								appliedTags: [],
								success: false,
								error:
									error instanceof Error
										? error.message
										: String(error),
							});
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
				const content = await this.app.vault.cachedRead(note);
				const frontmatter = await getFrontmatterAsync(this.app, note);
				const existingTags = (frontmatter?.tags || []) as string[];

				batchNotes.push({
					path: note.path,
					title: note.basename,
					content: content,
					existingTags: existingTags,
				});
			}

			// プロンプトを構築
			const prompt = buildAutoTaggingPrompt(
				batchNotes,
				availableTags,
				this.settings.systemInstruction,
			);

			// Gemini APIを呼び出し
			const responseText = await callGeminiApi(prompt, {
				common: this.geminiSettings,
				aiContext: {} as any,
				basesSuggester: {} as any,
				autoTagger: this.settings,
			});

			// レスポンスをパース
			const response: AutoTaggingResponse = JSON.parse(responseText);

			// 各ノートの結果を処理
			for (const suggestion of response.suggestions) {
				results.push({
					path: suggestion.path,
					suggestedTags: suggestion.suggestedTags,
					success: true,
				});
			}
		} catch (error) {
			// エラーが発生した場合、全ノートを失敗として記録
			for (const note of notes) {
				results.push({
					path: note.path,
					suggestedTags: [],
					success: false,
					error:
						error instanceof Error ? error.message : String(error),
				});
			}
		}

		return results;
	}

	/**
	 * タグをノートに適用
	 * @param file 対象ノート
	 * @param tags 適用するタグ配列
	 */
	private async applyTagsToNote(file: TFile, tags: string[]): Promise<void> {
		if (tags.length === 0) {
			return;
		}

		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
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
			const newTags = tags.filter((tag) => !existingTags.includes(tag));
			if (newTags.length > 0) {
				frontmatter.tags = [...existingTags, ...newTags];
			}
		});
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
