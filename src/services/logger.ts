import { type App, TFile } from "obsidian";

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
	) {}

	/**
	 * ログエントリを記録
	 * @param entry - ログエントリ
	 */
	async log(entry: LogEntry): Promise<void> {
		try {
			// ログファイルのサイズをチェックし、必要に応じてローテーション
			await this.checkAndRotateIfNeeded();

			// ログメッセージを構築
			const logMessage = this.formatLogEntry(entry);

			// ログファイルに追記
			await this.appendToLogFile(logMessage);
		} catch (error) {
			// ログ書き込みに失敗してもエラーを投げない（要件7.7）
			console.error("Failed to write to log file:", error);
		}
	}

	/**
	 * サマリーをログに記録
	 * @param summary - 処理サマリー
	 */
	async logSummary(summary: AutoTaggerSummary): Promise<void> {
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
			console.error("Failed to write summary to log file:", error);
		}
	}

	/**
	 * セッション開始をログに記録
	 * @param targetDirectory - 対象ディレクトリ
	 * @param excludeNoteTag - 除外ノートタグ
	 * @param excludeSuggestionTags - 除外提案タグ
	 */
	async logSessionStart(
		targetDirectory: string,
		excludeNoteTag: string,
		excludeSuggestionTags: string[],
	): Promise<void> {
		try {
			const startMessage = `
=== Auto-Tagging Session Started ===
Timestamp: ${new Date().toISOString()}
Target Directory: ${targetDirectory || "(vault root)"}
Exclude Note Tag: ${excludeNoteTag || "(none)"}
Exclude Suggestion Tags: ${excludeSuggestionTags.length > 0 ? excludeSuggestionTags.join(", ") : "(none)"}

`;

			await this.appendToLogFile(startMessage);
		} catch (error) {
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
	 */
	private async appendToLogFile(content: string): Promise<void> {
		const vault = this.app.vault;

		// ログファイルが存在するか確認
		const file = vault.getAbstractFileByPath(this.logFilePath);

		if (file instanceof TFile) {
			// 既存ファイルに追記
			const existingContent = await vault.read(file);
			await vault.modify(file, existingContent + content);
		} else {
			// 新規ファイルを作成
			// ディレクトリが存在しない場合は作成
			await this.ensureDirectoryExists();
			await vault.create(this.logFilePath, content);
		}
	}

	/**
	 * ログファイルのディレクトリが存在することを確認
	 */
	private async ensureDirectoryExists(): Promise<void> {
		const dirPath = this.logFilePath.substring(
			0,
			this.logFilePath.lastIndexOf("/"),
		);

		if (dirPath) {
			const dir = this.app.vault.getAbstractFileByPath(dirPath);
			if (!dir) {
				// ディレクトリを再帰的に作成
				await this.createDirectoryRecursively(dirPath);
			}
		}
	}

	/**
	 * ディレクトリを再帰的に作成
	 * @param path - ディレクトリパス
	 */
	private async createDirectoryRecursively(path: string): Promise<void> {
		const parts = path.split("/");
		let currentPath = "";

		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const exists = this.app.vault.getAbstractFileByPath(currentPath);

			if (!exists) {
				await this.app.vault.createFolder(currentPath);
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
