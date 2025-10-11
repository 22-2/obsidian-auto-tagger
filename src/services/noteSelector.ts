import type { App } from "obsidian";
import { TFile, TFolder } from "obsidian";

export interface NoteFilter {
	targetDirectory: string;
	excludeTags: string[];
}

export class NoteSelector {
	constructor(private app: App) {}

	/**
	 * フィルタ条件に基づいて対象ノートを取得
	 * @param filter - フィルタ条件（対象ディレクトリと除外タグ）
	 * @returns 対象となるTFileの配列
	 * @throws ディレクトリが存在しない場合、または対象ノートが見つからない場合
	 */
	async getTargetNotes(filter: NoteFilter): Promise<TFile[]> {
		// ディレクトリパスの検証
		if (!filter.targetDirectory || filter.targetDirectory.trim() === "") {
			throw new Error("対象ディレクトリが指定されていません");
		}

		// ディレクトリ配下の全マークダウンファイルを取得
		const allNotes = await this.getNotesInDirectory(filter.targetDirectory);

		// 除外タグが設定されていない場合は全てのノートを返す
		if (!filter.excludeTags || filter.excludeTags.length === 0) {
			if (allNotes.length === 0) {
				throw new Error("対象ノートがありません");
			}
			return allNotes;
		}

		// 除外タグによるフィルタリング
		const filteredNotes: TFile[] = [];
		
		// 各ノートに対して非同期にタグチェックを並列実行
		const noteChecks = allNotes.map(async (note) => {
			// ノートが除外タグのいずれかを持っているかチェック
			for (const excludeTag of filter.excludeTags) {
				if (await this.hasTag(note, excludeTag)) {
					return null; // 除外タグを持つ場合はnullを返す
				}
			}
			return note; // 除外タグを持たない場合はノートを返す
		});

		// すべてのチェックが完了するのを待つ
		const results = await Promise.all(noteChecks);
		
		// nullでない結果（除外タグを持たないノート）だけをフィルタリング
		results.forEach((note) => {
			if (note !== null) {
				filteredNotes.push(note);
			}
		});

		// フィルタリング後のノートが0件の場合はエラー
		if (filteredNotes.length === 0) {
			throw new Error("対象ノートがありません");
		}

		return filteredNotes;
	}

	/**
	 * ディレクトリ配下の全マークダウンファイルを取得
	 * @param dirPath - ディレクトリパス
	 * @returns マークダウンファイルの配列
	 * @throws ディレクトリが存在しない場合
	 */
	private async getNotesInDirectory(dirPath: string): Promise<TFile[]> {
		// パスの正規化（先頭と末尾のスラッシュを削除）
		const normalizedPath = dirPath.replace(/^\/+|\/+$/g, "");

		// ディレクトリの存在確認
		const abstractFile = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (!abstractFile) {
			throw new Error(`ディレクトリが存在しません: ${normalizedPath}`);
		}

		if (!(abstractFile instanceof TFolder)) {
			throw new Error(
				`指定されたパスはディレクトリではありません: ${normalizedPath}`,
			);
		}

		const folder = abstractFile as TFolder;
		const notes: TFile[] = [];

		// 再帰的にマークダウンファイルを収集
		this.collectMarkdownFiles(folder, notes);

		return notes;
	}

	/**
	 * フォルダ内のマークダウンファイルを再帰的に収集
	 * @param folder - 対象フォルダ
	 * @param notes - 収集したファイルを格納する配列
	 */
	private collectMarkdownFiles(folder: TFolder, notes: TFile[]): void {
		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === "md") {
				notes.push(child);
			} else if (child instanceof TFolder) {
				// 再帰的にサブフォルダを処理
				this.collectMarkdownFiles(child, notes);
			}
		}
	}

	/**
	 * 指定タグを持つかチェック
	 * @param file - チェック対象のファイル
	 * @param tag - チェックするタグ（#なしで指定）
	 * @returns タグを持つ場合true
	 */
	private async hasTag(file: TFile, tag: string): Promise<boolean> {
		// タグの正規化（#を削除）
		const normalizedTag = tag.replace(/^#+/, "");

		// メタデータキャッシュからタグ情報を取得
		const metadata = this.app.metadataCache.getFileCache(file);

		// frontmatterのtagsフィールドをチェック
		if (metadata?.frontmatter?.tags) {
			const frontmatterTags = metadata.frontmatter.tags;

			// 配列の場合
			if (Array.isArray(frontmatterTags)) {
				for (const t of frontmatterTags) {
					const normalizedFmTag = String(t).replace(/^#+/, "");
					if (normalizedFmTag === normalizedTag) {
						return true;
					}
				}
			}
			// 文字列の場合（カンマ区切りまたは単一タグ）
			else if (typeof frontmatterTags === "string") {
				const tags = frontmatterTags.split(",").map((t) => t.trim());
				for (const t of tags) {
					const normalizedFmTag = t.replace(/^#+/, "");
					if (normalizedFmTag === normalizedTag) {
						return true;
					}
				}
			}
		}

		// インラインタグ（#tag形式）をチェック
		if (metadata?.tags) {
			for (const tagCache of metadata.tags) {
				const normalizedInlineTag = tagCache.tag.replace(/^#+/, "");
				if (normalizedInlineTag === normalizedTag) {
					return true;
				}
			}
		}

		return false;
	}
}
