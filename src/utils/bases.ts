import { sampleSize, uniq } from "es-toolkit";
import { App } from "obsidian";
import { BasesView } from "obsidian-typings";
import { BasesDataItem } from "./types";

export function getActiveBasesView(app: App) {
	return app.workspace.getLeavesOfType("bases")[0]
		.view as unknown /* .view */ as BasesView;
}

export function getBasesDataRows(view: BasesView): BasesDataItem[] {
	// @ts-expect-error
	return view.controller.view.data.data;
}

export function getAllKeywordsFromActiveBasesView(app: App) {
	const view = getActiveBasesView(app);
	const rows = getBasesDataRows(view);
	return uniq(rows.flatMap((row) => row.frontmatter.keywords || []));
}
