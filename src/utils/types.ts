import { App, TFile } from "obsidian";

export interface BasesDataItem {
	app: App;
	ctx: any;
	file: TFile;
	formula: any;
	formulaResults: any;
	frontmatter: Record<string, any>;
	implicit: any;
	note: any;
}

export interface AISuggestion {
	path: string;
	suggestedTags: string[];
	suggestedKeywords: string[];
}

export interface BatchNoteData {
	path: string;
	content: string;
	frontmatter: Record<string, any>;
}

export interface AutoTagBatchNote {
	path: string;
	title: string;
	content: string;
	existingTags: string[];
}
