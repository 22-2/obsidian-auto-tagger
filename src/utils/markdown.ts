import { App, TFile } from "obsidian";
import { getFrontmatterAsync } from "./obsidian";

export function splitMd(markdownText: string): {
	content: string;
	frontmatter: string;
} {
	const frontmatterPattern = /^---\n(.*?)\n---\n(.*)/s;
	const match = markdownText.match(frontmatterPattern);
	if (!match) {
		return { content: markdownText, frontmatter: "" };
	}
	const [, frontmatter, content] = match as unknown as [null, string, string];

	return {
		content,
		frontmatter,
	};
}

export interface MarkdownParseResult {
	frontmatter: Record<string, any>;
	content: string;
}
