import { vi } from "vitest";

// Manual mock for Obsidian module

export const requestUrl = vi.fn();

export class App {
	constructor() {}
}

export class ItemView {
	constructor() {}
}

export class WorkspaceLeaf {
	constructor() {}
}

export class PluginSettingTab {
	constructor() {}
}

export class Setting {
	constructor() {}
}

export interface RequestUrlParam {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string;
	contentType?: string;
}
