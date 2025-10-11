import { type App, Notice, TFile } from "obsidian";

export interface LogEntry {
	timestamp: string;
	notePath: string;
	appliedTags: string[];
	success: boolean;
	error?: string;
}

export interface AutoTaggerSummary {
	totalNotes: number;
	successCount: number;
	errorCount: number;
	totalTagsApplied: number;
	startTime: string;
	endTime: string;
}

export class LoggerService {
	constructor(
		private app: App,
		private logFilePath: string,
		private maxFileSize: number,
		private enabled: boolean = true,
	) {}

	/**
	 * ログエントリを記録
	 * @param entry - ログエントリ
	 */
	async log(entry: LogEntry): Promise<void> {
		// ログが無効な場合は何もしない
		if (!this.enabled) {
			return;
		}
		
		try {
			// ログファイルのサイズをチェックし、必要に応じてローテーション
			await this.checkAndRotateIfNeeded();

			// ログメッセージを構築
			const logMessage = this.formatLogEntry(entry);

			// ログファイルに追記
			await this.appendToLogFile(logMessage);
		} catch (error) {
			// ログ書き込みに失敗してもエラーを投げない（要件7.7）
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error("Failed to write to log file:", error);
			// E2E環境やテスト環境ではNoticeを表示しない
			// Noticeの表示がエラーを引き起こす可能性があるため、コンソールログのみにする
		}
	}

	/**
	 * サマリーをログに記録
	 * @param summary - 処理サマリー
	 */
	async logSummary(summary: AutoTaggerSummary): Promise<void> {
		// ログが無効な場合は何もしない
		if (!this.enabled) {
			return;
		}
		
		try {
			const duration = this.calculateDuration(
				summary.startTime,
				summary.endTime,
			);

			const summaryMessage = `
=== Session Summary ===
Total Notes: ${summary.totalNotes}
Success: ${summary.successCount}
Errors: ${summary.errorCount}
Total Tags Applied: ${summary.totalTagsApplied}
Duration: ${duration}
End Time: ${summary.endTime}

`;

			await this.appendToLogFile(summaryMessage);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error("Failed to write summary to log file:", error);
		}
	}

	/**
	 * セッション開始をログに記録
	 * @param targetDirectory - 対象ディレクトリ
	 * @param excludeNoteTags - 除外ノートタグ
	 * @param excludeSuggestionTags - 除外提案タグ
	 */
	async logSessionStart(
		targetDirectory: string,
		excludeNoteTags: string[],
		excludeSuggestionTags: string[],
	): Promise<void> {
		// ログが無効な場合は何もしない
		if (!this.enabled) {
			return;
		}
		
		try {
			const startMessage = `
=== Auto-Tagging Session Started ===
Timestamp: ${new Date().toISOString()}
Target Directory: ${targetDirectory || "(vault root)"}
Exclude Note Tags: ${excludeNoteTags.length > 0 ? excludeNoteTags.join(", ") : "(none)"}
Exclude Suggestion Tags: ${excludeSuggestionTags.length > 0 ? excludeSuggestionTags.join(", ") : "(none)"}

`;

			await this.appendToLogFile(startMessage);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error("Failed to write session start to log file:", error);
		}
	}

	/**
	 * ログエントリをフォーマット
	 * @param entry - ログエントリ
	 * @returns フォーマットされたログメッセージ
	 */
	private formatLogEntry(entry: LogEntry): string {
		const status = entry.success ? "SUCCESS" : "ERROR";
		let message = `[${entry.timestamp}] ${status}: ${entry.notePath}\n`;

		if (entry.success && entry.appliedTags.length > 0) {
			message += `  Applied Tags: ${entry.appliedTags.join(", ")}\n`;
		} else if (!entry.success && entry.error) {
			message += `  Error: ${entry.error}\n`;
		}

		return message + "\n";
	}

	/**
	 * ログファイルに追記
	 * @param content - 追記する内容
	 * @throws ファイル操作に失敗した場合
	 */
	private async appendToLogFile(content: string): Promise<void> {
		const vault = this.app.vault;

		// ディレクトリが存在することを確認
		try {
			await this.ensureDirectoryExists();
		} catch (dirError) {
			console.error("Failed to ensure directory exists:", dirError);
			// ディレクトリ作成に失敗した場合は処理を中断
			throw dirError;
		}

		// リトライ処理
		const maxRetries = 5;
		let lastError: Error | null = null;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				// ファイルの存在を確認
				const file = vault.getAbstractFileByPath(this.logFilePath);

				if (file instanceof TFile) {
					// 既存ファイルに追記
					const existingContent = await vault.read(file);
					await vault.modify(file, existingContent + content);
					return; // 成功したら終了
				} else if (file === null) {
					// 新規ファイルを作成
					try {
						await vault.create(this.logFilePath, content);
						// 作成成功 - ファイルには既にcontentが書き込まれている
						return;
					} catch (createError) {
						const errorMsg = createError instanceof Error ? createError.message : String(createError);
						
						// 別のプロセスが既にファイルを作成した場合
						if (errorMsg.includes("File already exists") || errorMsg.includes("already exists")) {
							// 少し待ってから再度ファイルを取得して追記を試みる
							await new Promise(resolve => setTimeout(resolve, 150));
							
							// ファイルが利用可能になるまで少し待つ
							const retryFile = vault.getAbstractFileByPath(this.logFilePath);
							if (retryFile instanceof TFile) {
								const existingContent = await vault.read(retryFile);
								await vault.modify(retryFile, existingContent + content);
								return;
							}
							// まだファイルが取得できない場合は次のループへ
							lastError = new Error("File exists but cannot be retrieved");
						} else {
							// その他のエラー
							lastError = createError instanceof Error ? createError : new Error(String(createError));
						}
					}
				} else {
					// ファイルではなくフォルダが存在する場合
					throw new Error(`Log path is a directory, not a file: ${this.logFilePath}`);
				}
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				console.error(`Retry ${attempt + 1}/${maxRetries} - Error:`, lastError.message);
			}
			
			// 次のリトライ前に待機
			if (attempt < maxRetries - 1) {
				await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)));
			}
		}

		// リトライ回数を超えた場合はエラーをスロー
		const errorDetails = lastError ? lastError.message : '不明なエラー';
		throw new Error(`ログファイルの書き込みに失敗しました (${maxRetries}回リトライ): ${errorDetails}`);
	}

	/**
	 * ログファイルのディレクトリが存在することを確認
	 * @throws ディレクトリ作成に失敗した場合
	 */
	private async ensureDirectoryExists(): Promise<void> {
		const dirPath = this.logFilePath.substring(
			0,
			this.logFilePath.lastIndexOf("/"),
		);

		if (dirPath) {
			const dir = this.app.vault.getAbstractFileByPath(dirPath);
			if (!dir) {
				try {
					// ディレクトリを再帰的に作成
					await this.createDirectoryRecursively(dirPath);
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					throw new Error(`ログディレクトリ作成エラー: ${errorMsg}`);
				}
			}
		}
	}

	/**
	 * ディレクトリを再帰的に作成
	 * @param path - ディレクトリパス
	 * @throws ディレクトリ作成に失敗した場合
	 */
	private async createDirectoryRecursively(path: string): Promise<void> {
		const parts = path.split("/");
		let currentPath = "";

		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const exists = this.app.vault.getAbstractFileByPath(currentPath);

			if (!exists) {
				try {
					await this.app.vault.createFolder(currentPath);
				} catch (error) {
					// "Folder already exists" エラーは無視
					const errorMsg = error instanceof Error ? error.message : String(error);
					if (!errorMsg.includes("Folder already exists")) {
						throw new Error(`フォルダ作成エラー (${currentPath}): ${errorMsg}`);
					}
				}
			}
		}
	}

	/**
	 * ログファイルのサイズをチェックし、必要に応じてローテーション
	 */
	private async checkAndRotateIfNeeded(): Promise<void> {
		const fileSize = await this.checkFileSize();
		const maxSizeBytes = this.maxFileSize * 1024 * 1024; // MBをバイトに変換

		if (fileSize >= maxSizeBytes) {
			await this.rotateLogFile();
		}
	}

	/**
	 * ログファイルのサイズをチェック
	 * @returns ファイルサイズ（バイト）
	 */
	private async checkFileSize(): Promise<number> {
		const file = this.app.vault.getAbstractFileByPath(this.logFilePath);

		if (!(file instanceof TFile)) {
			return 0;
		}

		try {
			const content = await this.app.vault.read(file);
			// 文字列のバイトサイズを計算（UTF-8エンコーディング）
			return new Blob([content]).size;
		} catch (error) {
			console.error("Failed to check file size:", error);
			return 0;
		}
	}

	/**
	 * ログファイルのローテーション
	 */
	private async rotateLogFile(): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(this.logFilePath);

		if (!(file instanceof TFile)) {
			return;
		}

		try {
			// タイムスタンプ付きの新しいファイル名を生成
			const timestamp = new Date()
				.toISOString()
				.replace(/[:.]/g, "-")
				.replace("T", "_")
				.split("Z")[0];
			const extension = this.logFilePath.substring(
				this.logFilePath.lastIndexOf("."),
			);
			const basePath = this.logFilePath.substring(
				0,
				this.logFilePath.lastIndexOf("."),
			);
			const newPath = `${basePath}_${timestamp}${extension}`;

			// ファイルをリネーム
			await this.app.vault.rename(file, newPath);

			// 新しいログファイルは次回の書き込み時に自動作成される
		} catch (error) {
			console.error("Failed to rotate log file:", error);
		}
	}

	/**
	 * 処理時間を計算
	 * @param startTime - 開始時刻（ISO文字列）
	 * @param endTime - 終了時刻（ISO文字列）
	 * @returns フォーマットされた処理時間
	 */
	private calculateDuration(startTime: string, endTime: string): string {
		const start = new Date(startTime).getTime();
		const end = new Date(endTime).getTime();
		const durationMs = end - start;

		const seconds = Math.floor(durationMs / 1000);
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;

		if (minutes > 0) {
			return `${minutes}m ${remainingSeconds}s`;
		} else {
			return `${seconds}s`;
		}
	}
}
