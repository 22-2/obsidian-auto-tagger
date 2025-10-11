/**
 * AutoTagger E2E Tests - User Journey Based
 *
 * このファイルは、e2e-test-plan.mdで定義されたユーザージャーニーシナリオに基づいた
 * エンドツーエンドテストを実装しています。
 *
 * テストシナリオ:
 * 1. 初回利用フロー (TC-E2E-001)
 * 2. 日常的な使用フロー (TC-E2E-002)
 * 3. 大量ノート処理フロー (TC-E2E-003)
 * 4. エラーリカバリーフロー (TC-E2E-004)
 * 5. カスタマイズフロー (TC-E2E-005)
 * 6. マルチセッションフロー (TC-E2E-006)
 */

import type { Page } from "playwright";
import { expect, test } from "../base";
import { DIST_DIR, PLUGIN_ID } from "../constants";
import { AutoTaggerPageObject } from "../helpers/AutoTaggerPageObject";
import "../setup/logger-setup";

// Gemini APIのモックを設定する関数
async function setupGeminiMock(page: Page, pluginId: string): Promise<void> {
  await page.evaluate(async (pid) => {
    const plugin = (window as any).app.plugins.getPlugin(pid);
    if (!plugin) {
      throw new Error(`Plugin with id ${pid} not found`);
    }

    // モックAPIキーを設定
    plugin.settings.common.geminiApiKey = "mock-api-key-for-testing";
    await plugin.saveSettings();

    // AutoTaggerのapiCallFnをオーバーライドするヘルパー関数をプラグインに追加
    plugin._mockGeminiApi = async (prompt: string): Promise<string> => {
      console.log("🔹 Mock Gemini API called");
      
      // プロンプトから処理するノートのパスを抽出して動的にレスポンスを生成
      const suggestions: { path: string; suggestedTags: string[] }[] = [];
      
      try {
        // プロンプトから "path" フィールドを探してノート情報を抽出
        const noteMatches = prompt.matchAll(/"path":\s*"([^"]+)"/g);
        for (const match of noteMatches) {
          const notePath = match[1];
          suggestions.push({
            path: notePath,
            suggestedTags: ["typescript", "testing", "automation"]
          });
        }
      } catch (error) {
        console.error("Failed to parse prompt:", error);
      }
      
      // レスポンスが空の場合はフォールバック
      if (suggestions.length === 0) {
        suggestions.push({
          path: "fallback.md",
          suggestedTags: ["default-tag"]
        });
      }
      
      return JSON.stringify({
        suggestions: suggestions
      });
    };
    
    // 元のcreateAutoTaggerをラップ
    const originalCreateAutoTagger = plugin.createAutoTagger.bind(plugin);
    plugin.createAutoTagger = function() {
      const autoTagger = originalCreateAutoTagger();
      // API呼び出し関数をモックに置き換え
      autoTagger.apiCallFn = plugin._mockGeminiApi;
      return autoTagger;
    };

    console.log("✅ Gemini API mock setup complete");
    return true;
  }, pluginId);
}

// テスト用の設定を初期化
async function setupTestEnvironment(page: Page, pluginId: string): Promise<void> {
  // Gemini APIのモックを設定
  await setupGeminiMock(page, pluginId);

  // テスト用の設定を適用
  await page.evaluate(async (pid) => {
    const plugin = (window as any).app.plugins.getPlugin(pid);
    if (!plugin) return;

    // テスト用の設定を適用
    plugin.settings.common.geminiModel = "gemini-1.5-pro";
    plugin.settings.autoTagger.batchSize = 2;
    plugin.settings.autoTagger.maxSuggestions = 3;
    
    // E2E環境ではログを無効化（ファイル書き込みの問題を回避）
    plugin.settings.autoTagger.enableLogging = false;

    await plugin.saveSettings();
  }, pluginId);
}

test.describe("AutoTagger E2E - User Journeys", () => {
	/**
	 * TC-E2E-001: 完全な初回セットアップフロー
	 *
	 * ペルソナ: 田中さん（新規ユーザー）
	 * シナリオ: 初めてAuto Taggerを使用し、200件のノートにタグを付ける
	 */
	test("TC-E2E-001: Initial setup and first-time usage flow", async ({
		vault,
	}) => {
		const atPage = new AutoTaggerPageObject(
			vault.window,
			vault.pluginHandleMap,
		);

		// Step 1: プラグインが有効化されていることを確認
		const isEnabled = await atPage.isPluginEnabled(PLUGIN_ID);
		expect(isEnabled).toBe(true);

		// Step 1.5: テスト環境をセットアップ（APIモック含む）
		await setupTestEnvironment(vault.window, PLUGIN_ID);

		// Step 1.6: Vaultに既存のタグを追加（AIが提案できるように）
		await atPage.writeFile(
			"_tag-reference.md",
			`---
tags:
  - project-management
  - agile
  - productivity
  - machine-learning
  - ai
  - deep-learning
  - programming
  - web-development
  - javascript
  - react
  - typescript
  - data-science
---

# Tag Reference

This note exists to populate the vault with tags for testing.
`,
		);

		console.log("✅ Created tag reference note with existing tags");

		// Step 2: テスト用のノートを作成（10件で代用）
		const testNotes = Array.from({ length: 10 }, (_, i) => ({
			path: `initial-setup/note-${i + 1}.md`,
			content: `# Note ${i + 1}\n\nThis is a test note about ${
				i % 3 === 0
					? "project management and agile methodologies"
					: i % 3 === 1
						? "machine learning and artificial intelligence"
						: "web development and programming"
			}.`,
		}));

		// ノートを作成
		for (const note of testNotes) {
			await atPage.writeFile(note.path, note.content);
		}

		// Step 3: AutoTaggerを実行
		const result = await vault.window.evaluate(async (pluginId: string) => {
			const plugin = (window as any).app.plugins.getPlugin(
				pluginId,
			) as any;
			const autoTagger = plugin.createAutoTagger();

			const files = (window as any).app.vault.getMarkdownFiles();
			const targetNotes = files.filter((f: any) =>
				f.path.startsWith("initial-setup/"),
			);

			const progressUpdates: any[] = [];
			const batchCompletions: any[] = [];

			await autoTagger.start(
				targetNotes,
				(state: any) => {
					progressUpdates.push({
						processed: state.processedNotes,
						total: state.totalNotes,
						batch: state.currentBatch,
					});
				},
				(results: any) => {
					batchCompletions.push({
						batchSize: results.length,
						successCount: results.filter((r: any) => r.success)
							.length,
					});
				},
			);

			const summary = autoTagger.getSummary();

			return {
				progressUpdates,
				batchCompletions,
				summary,
			};
		}, PLUGIN_ID);

		// Step 4: 結果を検証
		console.log("📊 Test Results:");
		console.log("  Total Notes:", result.summary.totalNotes);
		console.log("  Success Count:", result.summary.successCount);
		console.log("  Error Count:", result.summary.errorCount);
		console.log("  Progress Updates:", result.progressUpdates.length);
		console.log("  Batch Completions:", result.batchCompletions.length);

		expect(result.summary.totalNotes).toBe(10);

		// API呼び出しが成功したか確認
		if (result.summary.successCount === 0) {
			console.error("❌ No notes were successfully tagged");
			console.error("Summary:", JSON.stringify(result.summary, null, 2));
			console.error(
				"Batch Completions:",
				JSON.stringify(result.batchCompletions, null, 2),
			);
			console.error(
				"This might indicate an API key issue or network problem",
			);
		}

		expect(result.summary.successCount).toBeGreaterThan(0);
		expect(result.progressUpdates.length).toBeGreaterThan(0);
		expect(result.batchCompletions.length).toBeGreaterThan(0);

		// Step 5: ノートにタグが追加されたことを確認
		// 少し待ってからファイルを読み込む（ファイルシステムの同期を待つ）
		await vault.window.waitForTimeout(1000);

		// 複数のノートを確認
		let notesWithTags = 0;
		const noteContents: string[] = [];

		for (let i = 1; i <= 10; i++) {
			const notePath = `initial-setup/note-${i}.md`;
			const noteContent = await atPage.readFile(notePath);
			noteContents.push(`Note ${i}: ${noteContent.substring(0, 100)}`);

			if (noteContent.includes("tags:")) {
				notesWithTags++;
			}
		}

		console.log(`📝 Notes with tags: ${notesWithTags}/10`);

		if (notesWithTags === 0) {
			console.error("❌ No notes have tags!");
			console.error("Sample note contents:");
			noteContents
				.slice(0, 3)
				.forEach((content) => console.error(content));
			console.error(
				"Tags were not added. Check if API key is valid and API calls succeeded.",
			);
		}

		// 少なくとも半分以上のノートにタグが追加されていることを確認
		expect(notesWithTags).toBeGreaterThanOrEqual(5);

		// クリーンアップ
		for (const note of testNotes) {
			await atPage.deleteFile(note.path);
		}
		await atPage.deleteFile("_tag-reference.md");
	});

	/**
	 * TC-E2E-002: 日常的な使用フロー（週次タグ付け）
	 *
	 * ペルソナ: 佐藤さん（既存ユーザー）
	 * シナリオ: 毎週末、新しく作成したノートにタグを付ける
	 */
	test("TC-E2E-002: Weekly tagging routine for new notes", async ({
		vault,
	}) => {
		const atPage = new AutoTaggerPageObject(
			vault.window,
			vault.pluginHandleMap,
		);

		// Setup: テスト環境をセットアップ（APIモック含む）
		await setupTestEnvironment(vault.window, PLUGIN_ID);

		// Step 1: 既存のノート（processed タグ付き）を作成
		const existingNotes = [
			{
				path: "weekly/existing-1.md",
				content: `---\ntags:\n  - processed\n---\n\n# Existing Note 1\n\nOld content.`,
			},
			{
				path: "weekly/existing-2.md",
				content: `---\ntags:\n  - processed\n---\n\n# Existing Note 2\n\nOld content.`,
			},
		];

		for (const note of existingNotes) {
			await atPage.writeFile(note.path, note.content);
		}

		// Step 2: 今週の新しいノートを作成
		const newNotes = Array.from({ length: 5 }, (_, i) => ({
			path: `weekly/new-${i + 1}.md`,
			content: `# New Note ${i + 1}\n\nThis week's content about productivity and time management.`,
		}));

		for (const note of newNotes) {
			await atPage.writeFile(note.path, note.content);
		}

		// Step 3: AutoTaggerを実行（processed タグで除外）
		const result = await vault.window.evaluate(async (pluginId: string) => {
			const plugin = (window as any).app.plugins.getPlugin(
				pluginId,
			) as any;
			const appInstance = plugin.app;

			// 手動でノートをフィルタリング
			const allFiles = appInstance.vault.getMarkdownFiles();
			const weeklyFiles = allFiles.filter((f: any) =>
				f.path.startsWith("weekly/"),
			);

			// processed タグを持つノートを除外
			const targetNotes: any[] = [];
			for (const file of weeklyFiles) {
				const cache = appInstance.metadataCache.getFileCache(file);
				const hasProcesedTag =
					cache?.frontmatter?.tags?.includes("processed") ||
					cache?.tags?.some((t: any) => t.tag === "#processed");

				if (!hasProcesedTag) {
					targetNotes.push(file);
				}
			}

			const autoTagger = plugin.createAutoTagger();

			await autoTagger.start(
				targetNotes,
				() => {},
				() => {},
			);

			const summary = autoTagger.getSummary();

			return {
				targetCount: targetNotes.length,
				summary,
			};
		}, PLUGIN_ID);

		// Step 4: 検証
		expect(result.targetCount).toBe(5); // 新しいノートのみ
		expect(result.summary.totalNotes).toBe(5);

		// Step 5: 既存のノートが変更されていないことを確認
		const existingNote = await atPage.readFile("weekly/existing-1.md");
		expect(existingNote).toContain("processed");
		expect(existingNote).toContain("Old content");

		// クリーンアップ
		for (const note of [...existingNotes, ...newNotes]) {
			await atPage.deleteFile(note.path);
		}
	});

	/**
	 * TC-E2E-003: 大規模プロジェクトの一括タグ付け
	 *
	 * ペルソナ: 山田さん（パワーユーザー）
	 * シナリオ: 150件のノートを一括処理（テストでは30件で代用）
	 */
	test("TC-E2E-003: Bulk tagging for large project", async ({ vault }) => {
		const atPage = new AutoTaggerPageObject(
			vault.window,
			vault.pluginHandleMap,
		);

		// Setup: テスト環境をセットアップ（APIモック含む）
		await setupTestEnvironment(vault.window, PLUGIN_ID);

		// プラグインの設定を更新
		await atPage.updatePluginSettings(PLUGIN_ID, {
			targetDirectory: "large-project",
			excludeNoteTag: "",
			excludeSuggestionTags: [],
			systemInstruction: "技術的なタグを提案してください。"
		});

		// Step 1: 大量のノートを作成（30件）
		const largeDataset = Array.from({ length: 30 }, (_, i) => ({
			path: `large-project/note-${i + 1}.md`,
			content: `# Project Note ${i + 1}\n\nContent about ${
				i % 5 === 0
					? "data science and analytics"
					: i % 5 === 1
						? "cloud computing and AWS"
						: i % 5 === 2
							? "DevOps and CI/CD"
							: i % 5 === 3
								? "security and encryption"
								: "database design and SQL"
			}.`,
		}));

		for (const note of largeDataset) {
			await atPage.writeFile(note.path, note.content);
		}

		// Step 2: 処理時間を計測しながら実行
		const startTime = Date.now();

		const result = await vault.window.evaluate(async (pluginId: string) => {
			const plugin = (window as any).app.plugins.getPlugin(
				pluginId,
			) as any;
			const autoTagger = plugin.createAutoTagger();

			const files = (window as any).app.vault.getMarkdownFiles();
			const targetNotes = files.filter((f: any) =>
				f.path.startsWith("large-project/"),
			);

			let batchCount = 0;
			const batchSizes: number[] = [];

			await autoTagger.start(
				targetNotes,
				() => {},
				(results: any) => {
					batchCount++;
					batchSizes.push(results.length);
				},
			);

			const summary = autoTagger.getSummary();

			return {
				batchCount,
				batchSizes,
				summary,
			};
		}, PLUGIN_ID);

		const processingTime = Date.now() - startTime;

		// Step 3: 検証
		expect(result.summary.totalNotes).toBe(30);
		expect(result.batchCount).toBe(6); // 30件 ÷ 5件/バッチ = 6バッチ
		expect(result.batchSizes).toEqual([5, 5, 5, 5, 5, 5]);

		// パフォーマンス検証（30件で60秒以内）
		expect(processingTime).toBeLessThan(60000);

		// Step 4: ランダムにノートを確認
		const randomIndices = [1, 10, 20, 30];
		for (const index of randomIndices) {
			const note = await atPage.readFile(
				`large-project/note-${index}.md`,
			);
			expect(note).toContain("tags:");
		}

		// クリーンアップ
		for (const note of largeDataset) {
			await atPage.deleteFile(note.path);
		}
	});

	/**
	 * TC-E2E-004: エラー発生時のリカバリーフロー
	 *
	 * ペルソナ: 鈴木さん（中級ユーザー）
	 * シナリオ: エラーが発生しても適切に対処して処理を完了
	 */
	test("TC-E2E-004: Error recovery and retry flow", async ({ vault }) => {
		const atPage = new AutoTaggerPageObject(
			vault.window,
			vault.pluginHandleMap,
		);

		// Setup: テスト環境をセットアップ（APIモック含む）
		await setupTestEnvironment(vault.window, PLUGIN_ID);

		// プラグインの設定を更新
		await atPage.updatePluginSettings(PLUGIN_ID, {
			targetDirectory: "error-recovery",
			excludeNoteTag: "",
			excludeSuggestionTags: [],
			systemInstruction: "エラーテスト用の設定"
		});

		// Step 1: テストノートを作成
		const testNotes = Array.from({ length: 5 }, (_, i) => ({
			path: `error-recovery/note-${i + 1}.md`,
			content: `# Test Note ${i + 1}\n\nContent for testing error recovery.`,
		}));

		for (const note of testNotes) {
			await atPage.writeFile(note.path, note.content);
		}

		// Step 2: エラーを発生させるためにモックを一時的に無効化
		const errorResult = await vault.window.evaluate(
			async (pluginId: string) => {
				const plugin = (window as any).app.plugins.getPlugin(pluginId);

				// モックを一時的に無効化してエラーを発生
				const originalApi = plugin.api.callGeminiApi;
				plugin.api.callGeminiApi = async () => {
					throw new Error("Simulated API error for testing");
				};

				try {
					// エラーが発生するはずの処理を実行
					await plugin.api.processNotes(["error-recovery/note-1.md"]);
					return { success: true };
				} catch (error) {
					return {
						success: false,
						error: (error as Error).message
					};
				} finally {
					// 元の実装に戻す
					plugin.api.callGeminiApi = originalApi;
				}
			},
			PLUGIN_ID,
		);

		// エラーが発生したことを確認
		expect(errorResult.success).toBe(false);
		expect(errorResult.error).toContain("Simulated API error for testing");

		// Step 3: リトライ処理をテスト
		const retryResult = await vault.window.evaluate(
			async (pluginId: string) => {
				const plugin = (window as any).app.plugins.getPlugin(pluginId);

				try {
					// モックが正しく復旧していることを確認するために再度実行
					const result = await plugin.api.processNotes(["error-recovery/note-1.md"]);
					return { success: true, result };
				} catch (error) {
					return {
						success: false,
						error: (error as Error).message
					};
				}
			},
			PLUGIN_ID,
		);

		// リトライが成功したことを確認
		expect(retryResult.success).toBe(true);

		// クリーンアップ
		for (const note of testNotes) {
			await atPage.deleteFile(note.path);
		}
	});

	/**
	 * TC-E2E-005: カスタマイズと最適化フロー
	 *
	 * ペルソナ: 高橋さん（上級ユーザー）
	 * シナリオ: System Instructionをカスタマイズして技術的なタグを優先
	 */
	test("TC-E2E-005: Customization and optimization flow", async ({
		vault,
	}) => {
		const atPage = new AutoTaggerPageObject(
			vault.window,
			vault.pluginHandleMap,
		);

		// Setup: テスト環境をセットアップ（APIモック含む）
		await setupTestEnvironment(vault.window, PLUGIN_ID);

		// Step 1: テストノートを作成
		const testNotes = [
			{
				path: "customization/tech-note-1.md",
				content: `# TypeScript Guide\n\nA comprehensive guide to TypeScript.`,
			},
			{
				path: "customization/tech-note-2.md",
				content: `# React Hooks\n\nUnderstanding React hooks.`,
			},
			{
				path: "customization/tech-note-3.md",
				content: `# Vue.js Components\n\nBuilding components in Vue.`,
			},
		];

		for (const note of testNotes) {
			await atPage.writeFile(note.path, note.content);
		}

		// Step 2: デフォルト設定で実行
		const defaultResult = await vault.window.evaluate(
			async (pluginId: string) => {
				const plugin = (window as any).app.plugins.getPlugin(
					pluginId,
				) as any;
				const autoTagger = plugin.createAutoTagger();

				const files = (window as any).app.vault.getMarkdownFiles();
				const targetNotes = files.filter((f: any) =>
					f.path.startsWith("customization/"),
				);

				const appliedTags: string[][] = [];

				await autoTagger.start(
					targetNotes,
					() => {},
					(results: any) => {
						results.forEach((r: any) => {
							if (r.success) {
								appliedTags.push(r.suggestedTags);
							}
						});
					},
				);

				return { appliedTags };
			},
			PLUGIN_ID,
		);

		// Step 3: カスタムSystem Instructionを設定
		await vault.window.evaluate(async (pluginId: string) => {
			const plugin = (window as any).app.plugins.getPlugin(
				pluginId,
			) as any;

			plugin.settings.autoTagger.systemInstruction = `あなたは技術ブログの専門家です。
プログラミング言語、フレームワーク、技術概念に関連するタグを優先的に提案してください。
一般的なタグ（例: 'note', 'draft', 'general'）は避けてください。
具体的で技術的なタグを提案してください。`;

			plugin.settings.autoTagger.excludeSuggestionTags = [
				"general",
				"misc",
				"note",
				"draft",
			];

			await plugin.saveSettings();
		}, PLUGIN_ID);

		// Step 4: タグをクリアして再実行
		for (const note of testNotes) {
			const content = await atPage.readFile(note.path);
			const contentWithoutFrontmatter = content.replace(
				/^---\n[\s\S]*?\n---\n\n/,
				"",
			);
			await atPage.writeFile(note.path, contentWithoutFrontmatter);
		}

		const customResult = await vault.window.evaluate(
			async (pluginId: string) => {
				const plugin = (window as any).app.plugins.getPlugin(
					pluginId,
				) as any;
				const autoTagger = plugin.createAutoTagger();

				const files = (window as any).app.vault.getMarkdownFiles();
				const targetNotes = files.filter((f: any) =>
					f.path.startsWith("customization/"),
				);

				const appliedTags: string[][] = [];

				await autoTagger.start(
					targetNotes,
					() => {},
					(results: any) => {
						results.forEach((r: any) => {
							if (r.success) {
								appliedTags.push(r.suggestedTags);
							}
						});
					},
				);

				return { appliedTags };
			},
			PLUGIN_ID,
		);

		// Step 5: カスタマイズの効果を検証
		expect(customResult.appliedTags.length).toBeGreaterThan(0);

		// 除外タグが含まれていないことを確認
		const allCustomTags = customResult.appliedTags.flat();
		expect(allCustomTags).not.toContain("general");
		expect(allCustomTags).not.toContain("note");
		expect(allCustomTags).not.toContain("draft");

		// クリーンアップ
		for (const note of testNotes) {
			await atPage.deleteFile(note.path);
		}

		// 設定を元に戻す
		await vault.window.evaluate(async (pluginId: string) => {
			const plugin = (window as any).app.plugins.getPlugin(
				pluginId,
			) as any;
			plugin.settings.autoTagger.systemInstruction =
				"あなたは知識管理の専門家です。ノートの内容を分析し、最も適切なタグを提案してください。";
			plugin.settings.autoTagger.excludeSuggestionTags = [];
			await plugin.saveSettings();
		}, PLUGIN_ID);
	});

	/**
	 * TC-E2E-006: マルチセッションフロー
	 *
	 * ペルソナ: 伊藤さん（モバイルユーザー）
	 * シナリオ: 複数回に分けて段階的にノートを処理
	 */
	test("TC-E2E-006: Multi-session progressive tagging flow", async ({
		vault,
	}) => {
		const atPage = new AutoTaggerPageObject(
			vault.window,
			vault.pluginHandleMap,
		);

		// Setup: テスト環境をセットアップ（APIモック含む）
		await setupTestEnvironment(vault.window, PLUGIN_ID);

		// Step 1: 3つのフォルダに分けてノートを作成
		const session1Notes = Array.from({ length: 5 }, (_, i) => ({
			path: `multi-session/session1/note-${i + 1}.md`,
			content: `# Session 1 Note ${i + 1}\n\nContent for first session.`,
		}));

		const session2Notes = Array.from({ length: 5 }, (_, i) => ({
			path: `multi-session/session2/note-${i + 1}.md`,
			content: `# Session 2 Note ${i + 1}\n\nContent for second session.`,
		}));

		const session3Notes = Array.from({ length: 5 }, (_, i) => ({
			path: `multi-session/session3/note-${i + 1}.md`,
			content: `# Session 3 Note ${i + 1}\n\nContent for third session.`,
		}));

		// 全ノートを作成
		for (const note of [
			...session1Notes,
			...session2Notes,
			...session3Notes,
		]) {
			await atPage.writeFile(note.path, note.content);
		}

		// Step 2: セッション1 - session1フォルダを処理
		const result1 = await vault.window.evaluate(
			async (pluginId: string) => {
				const plugin = (window as any).app.plugins.getPlugin(
					pluginId,
				) as any;

				const allFiles = (window as any).app.vault.getMarkdownFiles();
				const targetNotes = allFiles.filter((f: any) =>
					f.path.startsWith("multi-session/session1/"),
				);

				const autoTagger = plugin.createAutoTagger();
				await autoTagger.start(
					targetNotes,
					() => {},
					() => {},
				);

				const summary = autoTagger.getSummary();
				return { processedCount: summary.totalNotes };
			},
			PLUGIN_ID,
		);

		expect(result1.processedCount).toBe(5);

		// Step 3: 処理済みノートにマーキング
		for (const note of session1Notes) {
			const content = await atPage.readFile(note.path);
			const updatedContent = content.replace(
				/^(---\ntags:\n(?:  - .*\n)*)/,
				"$1  - processed\n",
			);
			await atPage.writeFile(note.path, updatedContent);
		}

		// Step 4: セッション2 - session2フォルダを処理
		const result2 = await vault.window.evaluate(
			async (pluginId: string) => {
				const plugin = (window as any).app.plugins.getPlugin(
					pluginId,
				) as any;

				const allFiles = (window as any).app.vault.getMarkdownFiles();
				const targetNotes = allFiles.filter((f: any) =>
					f.path.startsWith("multi-session/session2/"),
				);

				const autoTagger = plugin.createAutoTagger();
				await autoTagger.start(
					targetNotes,
					() => {},
					() => {},
				);

				const summary = autoTagger.getSummary();
				return { processedCount: summary.totalNotes };
			},
			PLUGIN_ID,
		);

		expect(result2.processedCount).toBe(5);

		// Step 5: セッション3 - 残りを処理
		const result3 = await vault.window.evaluate(
			async (pluginId: string) => {
				const plugin = (window as any).app.plugins.getPlugin(
					pluginId,
				) as any;

				const allFiles = (window as any).app.vault.getMarkdownFiles();
				const targetNotes = allFiles.filter((f: any) =>
					f.path.startsWith("multi-session/session3/"),
				);

				const autoTagger = plugin.createAutoTagger();
				await autoTagger.start(
					targetNotes,
					() => {},
					() => {},
				);

				const summary = autoTagger.getSummary();
				return { processedCount: summary.totalNotes };
			},
			PLUGIN_ID,
		);

		expect(result3.processedCount).toBe(5);

		// Step 6: 全体の確認
		const totalProcessed =
			result1.processedCount +
			result2.processedCount +
			result3.processedCount;
		expect(totalProcessed).toBe(15);

		// クリーンアップ
		for (const note of [
			...session1Notes,
			...session2Notes,
			...session3Notes,
		]) {
			await atPage.deleteFile(note.path);
		}
	});

	/**
	 * 追加テスト: 停止機能の詳細検証
	 */
	test("Stop functionality during batch processing", async ({ vault }) => {
		const atPage = new AutoTaggerPageObject(
			vault.window,
			vault.pluginHandleMap,
		);

		// Setup: テスト環境をセットアップ（APIモック含む）
		await setupTestEnvironment(vault.window, PLUGIN_ID);

		// 15件のノートを作成（3バッチ分）
		const testNotes = Array.from({ length: 15 }, (_, i) => ({
			path: `stop-test/note-${i + 1}.md`,
			content: `# Note ${i + 1}\n\nTest content.`,
		}));

		for (const note of testNotes) {
			await atPage.writeFile(note.path, note.content);
		}

		// 2バッチ目で停止
		const result = await vault.window.evaluate(async (pluginId: string) => {
			const plugin = (window as any).app.plugins.getPlugin(
				pluginId,
			) as any;
			const autoTagger = plugin.createAutoTagger();

			const files = (window as any).app.vault.getMarkdownFiles();
			const targetNotes = files.filter((f: any) =>
				f.path.startsWith("stop-test/"),
			);

			let batchCount = 0;

			const startPromise = autoTagger.start(
				targetNotes,
				() => {},
				() => {
					batchCount++;
					if (batchCount === 2) {
						autoTagger.stop();
					}
				},
			);

			await startPromise;

			const summary = autoTagger.getSummary();
			const finalState = autoTagger.getState();

			return {
				batchCount,
				processedNotes: finalState.processedNotes,
				shouldStop: finalState.shouldStop,
				summary,
			};
		}, PLUGIN_ID);

		// 検証
		expect(result.batchCount).toBe(2);
		expect(result.processedNotes).toBe(10); // 2バッチ × 5件
		expect(result.shouldStop).toBe(true);
		expect(result.summary.totalNotes).toBe(15);

		// クリーンアップ
		for (const note of testNotes) {
			await atPage.deleteFile(note.path);
		}
	});

	/**
	 * 追加テスト: ログファイルの検証
	 */
	test("Log file creation and content verification", async ({ vault }) => {
		const atPage = new AutoTaggerPageObject(
			vault.window,
			vault.pluginHandleMap,
		);

		// Setup: テスト環境をセットアップ（APIモック含む）
		await setupTestEnvironment(vault.window, PLUGIN_ID);

		// テストノートを作成
		const testNotes = Array.from({ length: 3 }, (_, i) => ({
			path: `log-test/note-${i + 1}.md`,
			content: `# Log Test Note ${i + 1}\n\nContent for log testing.`,
		}));

		for (const note of testNotes) {
			await atPage.writeFile(note.path, note.content);
		}

		// AutoTaggerを実行
		await vault.window.evaluate(async (pluginId: string) => {
			const plugin = (window as any).app.plugins.getPlugin(
				pluginId,
			) as any;
			const autoTagger = plugin.createAutoTagger();

			const files = (window as any).app.vault.getMarkdownFiles();
			const targetNotes = files.filter((f: any) =>
				f.path.startsWith("log-test/"),
			);

			await autoTagger.start(
				targetNotes,
				() => {},
				() => {},
			);
		}, PLUGIN_ID);

		// ログファイルの存在を確認
		const logPath = ".obsidian/plugins/auto-tagger/logs/auto-tag.log";
		const logExists = await atPage.fileExists(logPath);
		expect(logExists).toBe(true);

		// ログファイルの内容を確認
		const logContent = await atPage.readFile(logPath);
		expect(logContent).toContain("Auto-Tagging Session Started");
		expect(logContent).toContain("Session Summary");

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
