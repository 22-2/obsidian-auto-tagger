// E:\Desktop\coding\my-projects-02\obsidian-auto-tagger\e2e\helpers\managers\VaultManager.ts
// ===================================================================
// vault-manager.mts - Vault操作の管理
// ===================================================================

import chalk from "chalk";
import type { WebContents } from "electron";
import { existsSync, rmSync } from "fs";
import fs from "fs/promises";
import log from "loglevel";
import os from "os";
import path from "path";
import type { ElectronApplication, Page } from "playwright";
import { SANDBOX_VAULT_NAME } from "../../constants";
import { IPCBridge } from "../IPCBridge";
import type { TestPlugin, VaultOptions } from "../types";
import { PageManager } from "./PageManager";
import { PluginManager } from "./PluginManager";

const logger = log.getLogger("VaultManager");

export class VaultManager {
	private ipc: IPCBridge;
	private pluginManager: PluginManager;

	constructor(
		private app: ElectronApplication,
		private pageManager: PageManager,
	) {
		this.ipc = new IPCBridge(this.pageManager);
		this.pluginManager = new PluginManager();
	}

	/**
	 * 指定されたオプションに基づいてVaultを開き、ページとVaultのパスを返します。
	 * このメソッドはプラグインのセットアップを行いません。
	 * @param options Vaultを開く際のオプション
	 * @returns 操作可能になったVaultのページと、そのVaultのファイルシステムパス
	 */
	async openVault(
		options: VaultOptions = {},
	): Promise<{page: Page, vaultPath: string}> {
		logger.debug("Opening vault with options:", options);

		// ステップ 1: Vaultのパスを決定する
		const vaultPath = await this._determineVaultPath(options);

		// ステップ 2: Vaultウィンドウを開く
		const page = await this._openVaultWindow(vaultPath, options);

		logger.debug(chalk.green(`Vault window is open for: ${vaultPath}`));
		return {page, vaultPath};
	}

	/**
	 * 指定されたVaultにプラグインをインストールし、有効化し、Vaultをリロードします。
	 * @param page プラグインをセットアップする対象のページ
	 * @param vaultPath プラグインをインストールするVaultのパス
	 * @param plugins インストールするプラグインのリスト
	 */
	public async setupPlugins(
		page: Page,
		vaultPath: string,
		plugins: TestPlugin[] = [],
	): Promise<void> {
		if (plugins.length === 0) {
			logger.debug("No plugins specified to set up.");
			return;
		}

		logger.debug("Setting up plugins...");
		await this.pluginManager.installPlugins(vaultPath, plugins);

		await this.pluginManager.enablePlugins(
			this.app,
			page,
			plugins.map((p) => p.pluginId),
		);

		logger.debug(chalk.blue("Reloading vault to apply plugin changes..."));
		await page.reload();
		await this.pageManager.waitForPage(page);
		logger.debug(chalk.blue("Vault reloaded successfully."));
	}

	/**
	 * Vaultのパスを決定します。サンドボックス、指定パス、名前付き、一時的Vaultの順で解決します。
	 */
	private async _determineVaultPath(options: VaultOptions): Promise<string> {
		const shouldUseSandbox = !!options.useSandbox && !process.env.CI;
		if (shouldUseSandbox) {
			return this.ipc.getSandboxPath();
		}
		if (options.vaultPath) {
			return options.vaultPath;
		}
		if (options.name) {
			return this.getVaultPath(options.name);
		}
		const tempPath = await fs.mkdtemp(path.join(os.tmpdir(), "obsidian-e2e-"));
		logger.debug("Created temporary vault at:", tempPath);
		return tempPath;
	}

	/**
	 * 実際にVaultを開くアクションを実行し、新しいページを返します。
	 */
	private async _openVaultWindow(
		vaultPath: string,
		options: VaultOptions,
	): Promise<Page> {
		const shouldUseSandbox = !!options.useSandbox && !process.env.CI;
		const action = shouldUseSandbox
			? () => this.ipc.openSandbox()
			: () => this.ipc.openVault(vaultPath, options.forceNewVault);

		if (options.forceNewVault && existsSync(vaultPath)) {
			logger.debug(`Forcing new vault, removing existing at: ${vaultPath}`);
			rmSync(vaultPath, { recursive: true, force: true });
		}

		logger.debug(`Executing action to open vault at: ${vaultPath}`);
		return this.pageManager.executeActionAndWaitForNewWindow(
			action as any,
			(page) => this.pageManager.waitForPage(page),
		);
	}

	/**
	 * Obsidianのユーザーデータをクリアします。テスト間のクリーンアップに使用します。
	 */
	static async clearData(
		electronApp: ElectronApplication,
		page?: Page,
	): Promise<void> {
		const userDataDir = await electronApp.evaluate(({ app }) =>
			app.getPath("userData"),
		);
		[
			path.join(userDataDir, "obsidian.json"),
			path.join(userDataDir, SANDBOX_VAULT_NAME),
		].forEach((p) => {
			logger.debug("Deleting path:", p);
			rmSync(p, { force: true, recursive: true });
		});

		const win = page ?? electronApp.windows()[0];
		if (win) {
			logger.log(chalk.magenta("Clearing browser storage..."));
			const success = await win.evaluate(async () => {
				const webContents = (window as any).electron.remote.BrowserWindow.getFocusedWindow()?.webContents as WebContents;
				if (!webContents) return false;

				webContents.session.flushStorageData();
				await webContents.session.clearStorageData({
					storages: ["indexdb", "localstorage", "websql"],
				});
				await webContents.session.clearCache();
				return true;
			});
			logger.log(
				success
					? chalk.magenta("Browser storage cleared.")
					: chalk.red("Failed to clear browser storage."),
			);
		} else {
			logger.log(chalk.red("Window not found for storage clearing."));
		}
	}

	/**
	 * Obsidianのスターター（ランチャー）画面を開きます。
	 */
	async openStarter(): Promise<Page> {
		logger.debug("Opening starter window...");
		return this.pageManager.executeActionAndWaitForNewWindow(
			() => this.ipc.openStarter(),
			(page) => this.pageManager.waitForPage(page),
		);
	}

	private async getUserDataPath(): Promise<string> {
		const page = await this.pageManager.ensureSingleWindow();
		return page.evaluate(() => (window as any).app.getPath("userData"));
	}

	private async getVaultPath(name: string): Promise<string> {
		const userDataDir = await this.getUserDataPath();
		// ObsidianのVaultは通常、ユーザーデータディレクトリの親ディレクトリに保存される
		const vaultsDir = path.dirname(userDataDir);
		return path.join(vaultsDir, name);
	}
}
