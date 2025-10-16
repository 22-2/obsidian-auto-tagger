import { expect, test } from "../base";
import { DIST_DIR, PLUGIN_ID } from "../constants";
import { AutoTaggerPageObject } from "../helpers/AutoTaggerPageObject";
import "../setup/logger-setup";

/**
 * AutoTagger Service E2E Tests
 * Task 5のAutoTaggerサービスの動作を検証
 *
 * Note: このファイルではvault.window.evaluate内でanyを使用していますが、
 * ブラウザコンテキストでは型情報が利用できないため、これは意図的な設計です。
 */

test.describe("AutoTagger Service", () => {
	// 各テストの前にGemini APIをモック
	test.beforeEach(async ({ vault }) => {
		await vault.window.evaluate((pluginId: string) => {
			const plugin = (window as any).app.plugins.getPlugin(pluginId) as any;

			// AutoTaggerサービスのapiCallFnをオーバーライド
			const originalCreateAutoTagger = plugin.createAutoTagger.bind(plugin);
			plugin.createAutoTagger = function() {
				const autoTagger = originalCreateAutoTagger();

				// モックAPI関数を設定
				autoTagger.apiCallFn = async (prompt: string) => {
					// プロンプトからノート情報を抽出
					const notesMatch = prompt.match(/"path"\s*:\s*"([^"]+)"/g);
					if (!notesMatch) {
						return JSON.stringify({ suggestions: [] });
					}

					// 各ノートに対してモックタグを生成
					const suggestions = notesMatch.map((match: string) => {
						const pathMatch = match.match(/"path"\s*:\s*"([^"]+)"/);
						if (!pathMatch) return null;

						const path = pathMatch[1];
						const filename = path.toLowerCase();

						// ファイル名に基づいてモックタグを返す
						let suggestedTags: string[] = [];
						if (filename.includes('ai') || filename.includes('machine')) {
							suggestedTags = ['ai', 'machine-learning', 'technology'];
						} else if (filename.includes('project') || filename.includes('management')) {
							suggestedTags = ['project-management', 'productivity'];
						} else if (filename.includes('note-1')) {
							suggestedTags = ['ai', 'machine-learning'];
						} else if (filename.includes('note-2')) {
							suggestedTags = ['project-management', 'productivity'];
						} else if (filename.includes('note-3')) {
							suggestedTags = ['productivity', 'tools'];
						} else {
							suggestedTags = ['general'];
						}

						return { path, suggestedTags };
					}).filter((s: any) => s !== null);

					return JSON.stringify({ suggestions });
				};

				return autoTagger;
			};
		}, PLUGIN_ID);
	});

	test("should process notes in batches and apply tags", async ({
		vault,
	}) => {
		const atPage = new AutoTaggerPageObject(
			vault.window,
			vault.pluginHandleMap,
		);

		// テスト用のノートを作成
		const testNotes = [
			{
				path: "test-note-1.md",
				content:
					"# AI and Machine Learning\n\nThis note discusses artificial intelligence and machine learning concepts.",
			},
			{
				path: "test-note-2.md",
				content:
					"# Project Management\n\nThis note covers project management methodologies and best practices.",
			},
			{
				path: "test-note-3.md",
				content:
					"# Web Development\n\nThis note is about web development technologies like React and TypeScript.",
			},
		];

		// ノートを作成
		for (const note of testNotes) {
			await atPage.writeFile(note.path, note.content);
		}

		// ファイルが作成されたことを確認
		for (const note of testNotes) {
			await atPage.expectFileExists(note.path);
		}

		// AutoTaggerサービスを取得してテスト
		const result = await vault.window.evaluate(async (pluginId: string) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;
			if (!plugin) {
				throw new Error(`Plugin not found: ${pluginId}`);
			}
			if (!plugin.createAutoTagger) {
				throw new Error(
					`Plugin does not have createAutoTagger method. Available methods: ${Object.keys(plugin).join(", ")}`,
				);
			}

			// プラグインからAutoTaggerインスタンスを作成
			const autoTagger = plugin.createAutoTagger();

			// 処理対象のノートを取得
			const files = app.vault.getMarkdownFiles();
			const targetNotes = files.filter((f: any) =>
				["test-note-1.md", "test-note-2.md", "test-note-3.md"].includes(
					f.path,
				),
			);

			// 進捗とバッチ完了を記録
			const progressStates: any[] = [];
			const batchResults: any[] = [];

			// AutoTaggerを実行
			await autoTagger.start(
				targetNotes,
				(state: any) => {
					progressStates.push({ ...state });
				},
				(results: any) => {
					batchResults.push(results);
				},
			);

			// サマリーを取得
			const summary = autoTagger.getSummary();

			return {
				progressStates,
				batchResults,
				summary,
				finalState: autoTagger.getState(),
			};
		}, PLUGIN_ID);

		// 検証: 進捗が記録されていること
		expect(result.progressStates.length).toBeGreaterThan(0);

		// 検証: 最終状態が正しいこと
		expect(result.finalState.isRunning).toBe(false);
		expect(result.finalState.totalNotes).toBe(3);
		expect(result.finalState.processedNotes).toBe(3);

		// 検証: サマリーが正しいこと
		expect(result.summary.totalNotes).toBe(3);
		expect(result.summary.startTime).toBeTruthy();
		expect(result.summary.endTime).toBeTruthy();

		// クリーンアップ
		for (const note of testNotes) {
			await atPage.deleteFile(note.path);
		}
	});

	test("should handle stop request gracefully", async ({ vault }) => {
		const atPage = new AutoTaggerPageObject(
			vault.window,
			vault.pluginHandleMap,
		);

		// 複数のテスト用ノートを作成
		const testNotes = Array.from({ length: 10 }, (_, i) => ({
			path: `test-stop-${i + 1}.md`,
			content: `# Test Note ${i + 1}\n\nThis is test content for note ${i + 1}.`,
		}));

		// ノートを作成
		for (const note of testNotes) {
			await atPage.writeFile(note.path, note.content);
		}

		// AutoTaggerを実行して途中で停止
		const result = await vault.window.evaluate(async (pluginId: string) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;
			const autoTagger = plugin.createAutoTagger();

			const files = app.vault.getMarkdownFiles();
			const targetNotes = files.filter((f: any) =>
				f.path.startsWith("test-stop-"),
			);

			let batchCount = 0;

			// 最初のバッチ完了後に停止
			const startPromise = autoTagger.start(
				targetNotes,
				() => {},
				() => {
					batchCount++;
					if (batchCount === 1) {
						autoTagger.stop();
					}
				},
			);

			await startPromise;

			return {
				finalState: autoTagger.getState(),
				batchCount,
			};
		}, PLUGIN_ID);

		// 検証: 停止が正しく動作したこと
		expect(result.finalState.isRunning).toBe(false);
		expect(result.finalState.shouldStop).toBe(true);
		expect(result.finalState.processedNotes).toBeLessThan(10);

		// クリーンアップ
		for (const note of testNotes) {
			await atPage.deleteFile(note.path);
		}
	});

	test("should handle errors gracefully", async ({ vault }) => {
		// エラーをシミュレートするテスト
		const result = await vault.window.evaluate(async (pluginId: string) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;

			// エラーを投げるモックでcreateAutoTaggerを上書き
			const originalCreateAutoTagger = plugin.createAutoTagger.bind(plugin);
			plugin.createAutoTagger = function() {
				const autoTagger = originalCreateAutoTagger();

				// エラーを投げるモックAPI関数を設定
				autoTagger.apiCallFn = async () => {
					throw new Error('API request failed with status 400. Full response: {"error": {"code": 400, "message": "API key not valid. Please pass a valid API key.", "status": "INVALID_ARGUMENT"}}');
				};

				return autoTagger;
			};

			// エラーモックを使ってAutoTaggerを作成
			const autoTagger = plugin.createAutoTagger();

			// テストノートを作成
			await app.vault.create(
				"test-error.md",
				"# Test\n\nThis is a test note.",
			);

			const files = app.vault.getMarkdownFiles();
			const targetNotes = files.filter(
				(f: any) => f.path === "test-error.md",
			);

			let errorOccurred = false;

			await autoTagger.start(
				targetNotes,
				() => {},
				(results: any) => {
					if (results.some((r: any) => !r.success)) {
						errorOccurred = true;
					}
				},
			);

			const summary = autoTagger.getSummary();

			// クリーンアップ
			const file = app.vault.getAbstractFileByPath("test-error.md");
			if (file) {
				await app.vault.delete(file);
			}

			return {
				errorOccurred,
				errorCount: summary.errorCount,
			};
		}, PLUGIN_ID);

		// 検証: エラーが適切に処理されたこと
		expect(result.errorOccurred).toBe(true);
		expect(result.errorCount).toBeGreaterThan(0);
	});

	test("should apply tags to note frontmatter correctly", async ({
		vault,
	}) => {
		const atPage = new AutoTaggerPageObject(
			vault.window,
			vault.pluginHandleMap,
		);

		// 既存のタグを持つノートを作成
		const noteContent = `---
tags:
  - existing-tag
---

# Test Note

This is a test note with existing tags.`;

		await atPage.writeFile("test-tags.md", noteContent);

		// タグを適用
		const result = await vault.window.evaluate(async (pluginId: string) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;
			const autoTagger = plugin.createAutoTagger();

			const file = app.vault.getAbstractFileByPath("test-tags.md");
			if (!file) {
				throw new Error("File not found");
			}

			// タグを適用（privateメソッドなので、型アサーションを使用）
			await (autoTagger as any).applyTagsToNote(file, [
				"new-tag-1",
				"new-tag-2",
			]);

			// frontmatterを確認
			const frontmatter = await new Promise((resolve) => {
				app.fileManager.processFrontMatter(file as any, (fm: any) =>
					resolve(fm),
				);
			});

			return frontmatter;
		}, PLUGIN_ID);

		// 検証: 既存のタグが保持され、新しいタグが追加されたこと
		expect(result).toHaveProperty("tags");
		expect((result as any).tags).toContain("existing-tag");
		expect((result as any).tags).toContain("new-tag-1");
		expect((result as any).tags).toContain("new-tag-2");

		// クリーンアップ
		await atPage.deleteFile("test-tags.md");
	});

	test("should not add duplicate tags", async ({ vault }) => {
		const atPage = new AutoTaggerPageObject(
			vault.window,
			vault.pluginHandleMap,
		);

		// 既存のタグを持つノートを作成
		const noteContent = `---
tags:
  - duplicate-tag
  - other-tag
---

# Test Note

This is a test note.`;

		await atPage.writeFile("test-duplicates.md", noteContent);

		// 重複するタグを含めて適用
		const result = await vault.window.evaluate(async (pluginId: string) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;
			const autoTagger = plugin.createAutoTagger();

			const file = app.vault.getAbstractFileByPath("test-duplicates.md");
			if (!file) {
				throw new Error("File not found");
			}

			// 重複するタグを含めて適用
			await (autoTagger as any).applyTagsToNote(file, [
				"duplicate-tag",
				"new-unique-tag",
			]);

			// frontmatterを確認
			const frontmatter = await new Promise((resolve) => {
				app.fileManager.processFrontMatter(file as any, (fm: any) =>
					resolve(fm),
				);
			});

			return frontmatter;
		}, PLUGIN_ID);

		// 検証: タグが重複していないこと
		const tags = (result as any).tags;
		expect(tags).toContain("duplicate-tag");
		expect(tags).toContain("other-tag");
		expect(tags).toContain("new-unique-tag");

		// 重複がないことを確認
		const uniqueTags = [...new Set(tags)];
		expect(tags.length).toBe(uniqueTags.length);

		// クリーンアップ
		await atPage.deleteFile("test-duplicates.md");
	});

	test("should track state correctly during processing", async ({
		vault,
	}) => {
		const atPage = new AutoTaggerPageObject(
			vault.window,
			vault.pluginHandleMap,
		);

		// テスト用のノートを作成
		const testNotes = Array.from({ length: 7 }, (_, i) => ({
			path: `test-state-${i + 1}.md`,
			content: `# Test Note ${i + 1}\n\nContent for note ${i + 1}.`,
		}));

		for (const note of testNotes) {
			await atPage.writeFile(note.path, note.content);
		}

		// 状態の変化を追跡
		const result = await vault.window.evaluate(async (pluginId: string) => {
			const plugin = app.plugins.getPlugin(pluginId) as any;
			const autoTagger = plugin.createAutoTagger();

			const files = app.vault.getMarkdownFiles();
			const targetNotes = files.filter((f: any) =>
				f.path.startsWith("test-state-"),
			);

			const stateSnapshots: any[] = [];

			await autoTagger.start(
				targetNotes,
				(state: any) => {
					stateSnapshots.push({
						currentBatch: state.currentBatch,
						processedNotes: state.processedNotes,
						totalNotes: state.totalNotes,
						isRunning: state.isRunning,
					});
				},
				() => {},
			);

			return {
				stateSnapshots,
				finalState: autoTagger.getState(),
			};
		}, PLUGIN_ID);

		// 検証: 状態が正しく更新されていること
		expect(result.stateSnapshots.length).toBeGreaterThan(0);

		// 最初の状態
		const firstState = result.stateSnapshots[0];
		expect(firstState.totalNotes).toBe(7);
		expect(firstState.isRunning).toBe(true);

		// 最終状態
		expect(result.finalState.isRunning).toBe(false);
		expect(result.finalState.processedNotes).toBe(7);
		expect(result.finalState.totalNotes).toBe(7);

		// クリーンアップ
		for (const note of testNotes) {
			await atPage.deleteFile(note.path);
		}
	});
});

// カスタム設定を使用
test.use({
	vaultOptions: {
		useSandbox: true,
		showLoggerOnNode: true,
		plugins: [
			{
				path: DIST_DIR,
				pluginId: PLUGIN_ID,
			},
		],
	},
});
