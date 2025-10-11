import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		include: ["src/**/*.{test,spec}.ts"],
		setupFiles: ["src/__tests__/setup.ts"],
		onConsoleLog: (log) => {
			// 長文のログだけ抑制（500文字以上）
			if (log.length > 500) {
				return false;
			}
			return true;
		},
	},
	resolve: {
		alias: {
			obsidian: new URL("src/__mocks__/obsidian.ts", import.meta.url).pathname,
			"src/": new URL("src/", import.meta.url).pathname,
		},
	},
});
