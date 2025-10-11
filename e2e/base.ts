// E:\Desktop\coding\my-projects-02\obsidian-auto-tagger\e2e\base.ts
import { test as base, type Page } from "@playwright/test";
import log from "loglevel";
import { toggleLoggerBy } from "src/utils/logger";
import type { VaultOptions, VaultPageTextContext } from "./helpers/types";
import { ObsidianTestSetup } from "./setup/ObsidianTestSetup";

const logger = log.getLogger("obsidianSetup");

// 定数定義
const CONSTANTS = {
	MAX_LOG_LENGTH: 500,
	TRUNCATED_LOG_LENGTH: 200,
	SEPARATOR_LENGTH: 53,
} as const;

const LOG_PREFIXES = {
	BROWSER: "🖥️ BROWSER",
	PAGE_ERROR: "💥 BROWSER PAGE ERROR",
	REQUEST_FAILED: "📉 BROWSER REQUEST FAILED",
	HTTP_ERROR: "⚠️ BROWSER HTTP ERROR",
} as const;

/**
 * ブラウザコンソールログをNode.jsコンソールに転送するクラス
 */
class BrowserLogForwarder {
	constructor(private readonly page: Page) {}

	/**
	 * すべてのログ転送リスナーを設定
	 */
	setup(): void {
		logger.debug("Setting up browser console log forwarding...");
		this.setupConsoleForwarding();
		this.setupErrorForwarding();
		this.setupRequestFailureForwarding();
		this.setupResponseErrorForwarding();
	}

	private setupConsoleForwarding(): void {
		this.page.on("console", (msg) => {
			const type = msg.type().toUpperCase();
			const text = msg.text();
			const formattedLog = this.formatConsoleLog(type, text);
			console.log(formattedLog);
		});
	}

	private setupErrorForwarding(): void {
		this.page.on("pageerror", (error) => {
			console.error(`${LOG_PREFIXES.PAGE_ERROR}: ${error.message}`);
			if (error.stack) {
				console.error(`   Stack: ${error.stack}`);
			}
		});
	}

	private setupRequestFailureForwarding(): void {
		this.page.on("requestfailed", (request) => {
			const method = request.method();
			const url = request.url();
			console.error(`${LOG_PREFIXES.REQUEST_FAILED}: ${method} ${url}`);

			const failure = request.failure();
			if (failure) {
				console.error(`   Reason: ${failure.errorText}`);
			}
		});
	}

	private setupResponseErrorForwarding(): void {
		this.page.on("response", (response) => {
			if (!response.ok()) {
				const status = response.status();
				const statusText = response.statusText();
				const url = response.url();
				console.warn(
					`${LOG_PREFIXES.HTTP_ERROR}: ${status} ${statusText} for ${url}`
				);
			}
		});
	}

	private formatConsoleLog(type: string, text: string): string {
		const prefix = `${LOG_PREFIXES.BROWSER} [${type}]`;

		if (text.length <= CONSTANTS.MAX_LOG_LENGTH) {
			return `${prefix}: ${text}`;
		}

		const truncated = text.substring(0, CONSTANTS.TRUNCATED_LOG_LENGTH);
		return `${prefix}: [Message too long, truncated] ${truncated}...`;
	}
}

/**
 * テスト失敗時の詳細情報を出力
 */
class TestFailureReporter {
	private static readonly SEPARATOR = "=".repeat(20);

	static report(testInfo: any): void {
		logger.error(
			`Test '${testInfo.title}' finished with status: ${testInfo.status}.`
		);

		if (!testInfo.error) return;

		console.error(`\n${this.SEPARATOR} TEST FAILED ${this.SEPARATOR}`);
		console.error(testInfo.error.message);

		if (testInfo.error.stack) {
			const stackWithoutMessage = this.extractStackTrace(testInfo.error.stack);
			console.error(stackWithoutMessage);
		}

		console.error(`${"=".repeat(CONSTANTS.SEPARATOR_LENGTH)}\n`);
	}

	private static extractStackTrace(stack: string): string {
		const firstNewlineIndex = stack.indexOf("\n");
		return firstNewlineIndex >= 0 ? stack.substring(firstNewlineIndex + 1) : stack;
	}
}

/**
 * Vaultの初期化処理を管理
 */
class VaultInitializer {
	constructor(
		private readonly obsidianSetup: ObsidianTestSetup,
		private readonly vaultOptions: VaultOptions
	) {}

	async initialize(): Promise<VaultPageTextContext> {
		logger.debug("Opening vault window...");
		const { page, vaultPath } = await this.obsidianSetup.openVault(
			this.vaultOptions
		);

		await this.setupPluginsIfNeeded(page, vaultPath);
		await this.setupLoggingIfNeeded(page);
		await this.clearInitialNotices(page);

		const context: VaultPageTextContext = {
			electronApp: this.obsidianSetup.electronApp!,
			window: page,
			vaultName: this.vaultOptions.name,
			pluginHandleMap: await this.obsidianSetup.getPluginHandles(page, this.vaultOptions.plugins),
		};

		logger.debug("Vault is ready, entering test body.");
		return context;
	}

	private async setupPluginsIfNeeded(page: Page, vaultPath: string): Promise<void> {
		const { plugins } = this.vaultOptions;

		if (!plugins || plugins.length === 0) return logger.debug("no plugins");

		logger.debug("Setting up plugins in the vault fixture...");
		await this.obsidianSetup.setupPlugins(page, vaultPath, plugins);
	}

	private async setupLoggingIfNeeded(page: Page): Promise<void> {
		if (!this.vaultOptions.showLoggerOnNode) return;

		const logForwarder = new BrowserLogForwarder(page);
		logForwarder.setup();
	}

	private async clearInitialNotices(page: Page): Promise<void> {
		const notices = await page.locator(".notice-container .notice").all();

		if (notices.length === 0) return;

		logger.debug(`Clearing ${notices.length} initial notice(s).`);
		await Promise.all(notices.map((notice) => notice.click()));
	}
}

// Fixtureの型定義
type TestFixtures = {
	obsidianSetup: ObsidianTestSetup;
	vault: VaultPageTextContext;
	vaultOptions: VaultOptions;
};

// テストのセットアップ
export const test = base.extend<TestFixtures>({
	vaultOptions: {
		useSandbox: false,
		showLoggerOnNode: true,
		plugins: [],
	},

	obsidianSetup: async ({}, use, testInfo) => {
		toggleLoggerBy("DEBUG");
		const setup = new ObsidianTestSetup();

		try {
			logger.debug("Launching Obsidian for test:", testInfo.title);
			await setup.launch();
			await use(setup);

			await handleTestCompletion(testInfo, setup);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			logger.error(`Error during fixture setup: ${errorMessage}`, err);
			throw err;
		} finally {
			await cleanupObsidian(setup);
		}
	},

	vault: async ({ obsidianSetup, vaultOptions }, use) => {
		const initializer = new VaultInitializer(obsidianSetup, vaultOptions);
		const context = await initializer.initialize();
		await use(context);
		logger.debug("Test body finished.");
	},
});

/**
 * テスト完了時の処理
 */
async function handleTestCompletion(
	testInfo: any,
	setup: ObsidianTestSetup
): Promise<void> {
	const { status, title } = testInfo;

	if (status === "passed" || status === "skipped") {
		logger.debug(`Test '${title}' finished with status: ${status}.`);
		return;
	}

	TestFailureReporter.report(testInfo);

	if (!process.env.CI) {
		logger.info("Test failed. You can inspect the page in the browser.");
		// デバッグ用にブラウザを一時停止したい場合は以下のコメントを外す
		// await setup.getCurrentPage()?.pause();
	}
}

/**
 * Obsidianインスタンスのクリーンアップ
 */
async function cleanupObsidian(setup: ObsidianTestSetup): Promise<void> {
	logger.debug("Cleaning up Obsidian instance...");
	await setup.cleanup();
	logger.debug("Cleanup complete.");
}

export { expect } from "@playwright/test";

