import { App, CachedMetadata, TFile } from "obsidian";
import { uniqBy } from ".";

/**
 * 現在のファイルからすべての外部リンク（outgoing links）を取得する関数
 * @param app ObsidianのAppオブジェクト
 * @param file 現在のファイル (TFileオブジェクト)
 * @returns リンク情報の配列。各要素は以下のプロパティを持つオブジェクト:
 *   - link: リンク文字列 ([[リンク先]] の形式)
 *   - file: リンク先のファイル (TFileオブジェクト、存在しない場合はnull)
 *   - displayText: リンクの表示テキスト (存在する場合)
 *   - lineNumber: リンクが出現する行番号 (0始まり)
 *   - position: リンクの位置情報 (Obsidianの`EditorPosition`オブジェクト)
 */
export async function getAllOutgoingLinks(
	app: App,
	file: TFile
): Promise<
	{
		link: string;
		file: TFile | null;
		displayText: string | null;
		lineNumber: number;
		position: any; // EditorPosition
	}[]
> {
	const links: {
		link: string;
		file: TFile | null;
		displayText: string | null;
		lineNumber: number;
		position: any;
	}[] = [];

	const fileContent = await app.vault.read(file);
	const lines = fileContent.split("\n");

	// 正規表現で内部リンクを抽出
	const linkRegex = /\[\[([^\]]+)\]\]|\[([^\]]+)\]\(([^\)]+)\)/g;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		let match;

		while ((match = linkRegex.exec(line)) !== null) {
			let linkText: string;
			let displayText: string | null = null;

			if (match[1]) {
				// [[リンク]] 形式
				linkText = match[1];
			} else {
				// [表示テキスト](リンク) 形式
				linkText = match[3];
				displayText = match[2];
			}

			const [link, anchor] = linkText.split("#"); // アンカーを分離
			const linkedFile = app.metadataCache.getFirstLinkpathDest(
				link,
				file.path
			); //リンク先のファイル

			links.push({
				link: linkText,
				file: linkedFile,
				displayText: displayText,
				lineNumber: i,
				position: {
					line: i,
					ch: match.index,
				},
			});
		}
	}

	// metadataCacheからリンク情報を取得
	const metadata: CachedMetadata | null =
		app.metadataCache.getFileCache(file);
	if (metadata && metadata.links) {
		for (const linkInfo of metadata.links) {
			const linkedFile = app.metadataCache.getFirstLinkpathDest(
				linkInfo.link,
				file.path
			);
			links.push({
				link: linkInfo.link,
				file: linkedFile,
				displayText: linkInfo.displayText ?? null, //nullish coalescing operator
				lineNumber: linkInfo.position.start.line,
				position: linkInfo.position,
			});
		}
	}

	// 未解決リンクの処理 CachedMetadataからは位置が取得できない
	const unresolvedLinks = app.metadataCache.unresolvedLinks[file.path] || {};
	for (const unresolvedLink in unresolvedLinks) {
		// 未解決リンクについては、ファイルオブジェクトはnull、位置情報は不明とする
		// より詳細な情報を取得するには、ファイルの内容を再度スキャンする必要がある
		links.push({
			link: unresolvedLink,
			file: null, // 未解決リンク
			displayText: null,
			lineNumber: NaN, // 不明な場合はNaN
			position: null, // 不明
		});
	}
	return uniqBy(links, (link) => link.link);
}

export function processFrontmatter(
	app: App,
	file: TFile,
	fn: (frontmatter: any) => void
) {
	return app.fileManager.processFrontMatter(file, fn);
}

export function getAllVaultTags(app: App) {
	return Object.keys(app.metadataCache.getTags()).map((tag) =>
		tag.substring(1)
	);
}

export function getFrontmatterAsync(app: App, file: TFile): Promise<any> {
	return new Promise((resolve) => {
		return app.fileManager.processFrontMatter(file, (frontmatter) =>
			resolve(frontmatter)
		);
	});
}
export { parseYaml, stringifyYaml } from "obsidian";

