// E:\Desktop\coding\my-projects-02\obsidian-auto-tagger\e2e\setup\ObsidianTestSetup.ts
// ===================================================================
// ObsidianTestSetup.ts - メインのセットアップクラス
// ===================================================================

import fs from "fs/promises";
import log from "loglevel";
import os from "os";
import path from "path";
import type { ElectronApplication, Page } from "playwright";
import { _electron as electron } from "playwright";
import invariant from "tiny-invariant";

import { LAUNCH_OPTIONS } from "../constants";
import { PageManager } from "../helpers/managers/PageManager";
import { VaultManager } from "../helpers/managers/VaultManager";
import type { TestContext, TestPlugin, VaultOptions } from "../helpers/types";
import { getPluginHandleMap } from "../helpers/utils";

const logger = log.getLogger("ObsidianTestSetup");

export class ObsidianTestSetup {
	private electronApp?: ElectronApplication;
	private vaultManager?: VaultManager;
	private pageManager?: PageManager;
	private tempUserDataDir?: string;

	/**
	 * Obsidianアプリケーションを起動し、テストの準備を整えます。
	 * 一時的なユーザーデータディレクトリを作成し、アプリケーションをクリーンな状態で起動します。
	 */
	async launch(): Promise<void> {
		this.tempUserDataDir = await fs.mkdtemp(
			path.join(os.tmpdir(), "obsidian-e2e-"),
		);
		logger.debug(`Using temporary user data dir: ${this.tempUserDataDir}`);

		const launchOptions = {
			...LAUNCH_OPTIONS,
			args: [...LAUNCH_OPTIONS.args, `--user-data-dir=${this.tempUserDataDir}`],
			env: {
				...process.env,
				PLAYWRIGHT: "true",
				CI: process.env.CI || "false",
			},
		};

		this.electronApp = await electron.launch(launchOptions);
		const initialPage = await this.electronApp.waitForEvent("window");

		// Playwrightで実行中であることをウィンドウコンテキストに設定
		await initialPage.evaluate(() => ((window as any).playwright = true));

		this.pageManager = new PageManager(this.electronApp);
		this.vaultManager = new VaultManager(this.electronApp, this.pageManager);

		// 起動直後のデータクリアとリロード
		await this.pageManager.waitForPage(initialPage);
		await VaultManager.clearData(this.electronApp, initialPage);
		await initialPage.reload({ waitUntil: "domcontentloaded" });

		const currentPage = await this.pageManager.ensureSingleWindow();
		await this.pageManager.waitForPage(currentPage);
		logger.debug("Initial setup complete. Obsidian starter page is ready.");
	}

	/**
	 * 指定されたオプションでVaultを開きます。
	 * @returns Vaultのページオブジェクトとファイルシステムパス
	 */
	async openVault(
		options: VaultOptions = {},
	): Promise<{ page: Page; vaultPath: string }> {
		invariant(this.vaultManager, "VaultManager not initialized. Call launch() first.");
		return this.vaultManager.openVault(options);
	}

	/**
	 * 指定されたVaultにプラグインをインストールし、有効化します。
	 */
	async setupPlugins(
		page: Page,
		vaultPath: string,
		plugins: TestPlugin[] = [],
	): Promise<void> {
		invariant(this.vaultManager, "VaultManager not initialized. Call launch() first.");
		await this.vaultManager.setupPlugins(page, vaultPath, plugins);
	}

	/**
	 * プラグインIDとプラグインインスタンスのマップ（JSHandle）を取得します。
	 */
	async getPluginHandles(page: Page, plugins: TestPlugin[] = []) {
		return getPluginHandleMap(page, plugins);
	}

	/**
	 * Obsidianのスターター画面を開きます。
	 */
	async openStarter(): Promise<TestContext> {
		invariant(
			this.electronApp && this.vaultManager,
			"Setup not initialized. Call launch() first.",
		);
		const page = await this.vaultManager.openStarter();
		return { electronApp: this.electronApp, window: page };
	}

	/**
	 * アプリケーションを終了し、一時ファイルをクリーンアップします。
	 */
	async cleanup(): Promise<void> {
		if (this.electronApp) {
			await this.electronApp.close().catch((err) => {
				logger.error("Error closing electron app:", err);
			});
		}
		if (this.tempUserDataDir) {
			logger.debug(`Removing temp user data dir: ${this.tempUserDataDir}`);
			await fs.rm(this.tempUserDataDir, { recursive: true, force: true });
		}
		logger.debug("ObsidianTestSetup cleanup complete.");
	}

	getCurrentPage(): Page | undefined {
		return this.electronApp?.windows()[0];
	}
}
