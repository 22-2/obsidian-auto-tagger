// E:\Desktop\coding\my-projects-02\obsidian-auto-tagger\e2e\helpers\managers\PluginManager.ts
// ===================================================================
// plugin-manager.mts - プラグイン管理
// ===================================================================

import { expect } from "@playwright/test";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	writeFileSync,
} from "fs";
import log from "loglevel";
import path from "path";
import type { ElectronApplication, Page } from "playwright";
import type { TestPlugin } from "../types";

const logger = log.getLogger("PluginManager");

export class PluginManager {
	/**
	 * 指定されたプラグインをVaultにインストールします。
	 * @param vaultPath Vaultのパス
	 * @param plugins インストールするプラグインのリスト
	 */
	async installPlugins(
		vaultPath: string,
		plugins: TestPlugin[],
	): Promise<void> {
		const pluginsDir = path.join(vaultPath, ".obsidian", "plugins");
		logger.debug("Plugins directory:", pluginsDir);
		logger.debug(
			"Plugins to install:",
			plugins.map((p) => p.pluginId),
		);

		mkdirSync(pluginsDir, { recursive: true });

		const installedIds: string[] = [];

		for (const { path: pluginPath, pluginId } of plugins) {
			if (!existsSync(pluginPath) || !existsSync(path.join(pluginPath, "manifest.json"))) {
				logger.warn(`Plugin source not found or invalid: ${pluginPath}`);
				continue;
			}

			const destDir = path.join(pluginsDir, pluginId);
			mkdirSync(destDir, { recursive: true });

			// プラグインファイルをコピー
			for (const file of readdirSync(pluginPath)) {
				copyFileSync(path.join(pluginPath, file), path.join(destDir, file));
			}
			logger.debug(`Copied plugin files for: ${pluginId}`);

			installedIds.push(pluginId);
		}

		// community-plugins.json を書き込み、Obsidianにインストール済みプラグインを認識させる
		const pluginsJsonPath = path.join(
			vaultPath,
			".obsidian",
			"community-plugins.json",
		);
		writeFileSync(pluginsJsonPath, JSON.stringify(installedIds));
		logger.debug(`Wrote community-plugins.json with: ${installedIds.join(", ")}`);
	}

	/**
	 * 指定されたプラグインIDのプラグインを有効化します。
	 * 事前にRestricted Modeを無効化します。
	 * @param app ElectronApplicationインスタンス
	 * @param page 現在のページ
	 * @param pluginIds 有効化するプラグインIDの配列
	 */
	public async enablePlugins(
		app: ElectronApplication,
		page: Page,
		pluginIds: string[],
	): Promise<void> {
		await this.disableRestrictedMode(page);

		const enabledIds = await page.evaluate(async (ids) => {
			const app = (window as any).app;
			const enabled: string[] = [];
			for (const id of ids) {
				await app.plugins.enablePluginAndSave(id);
				enabled.push(id);
			}
			return enabled;
		}, pluginIds);

		logger.debug(`Enabled plugins: ${enabledIds.join(", ")}`);
	}

	/**
	 * Restricted Modeを無効化し、コミュニティプラグインを有効にします。
	 * UI操作を伴うため、不安定にならないよう宣言的な待機処理を使用します。
	 */
	async disableRestrictedMode(page: Page): Promise<void> {
		await page.waitForFunction(() => (window as any).app?.plugins?.isEnabled);

		if (await this.checkIsCommunityPluginEnabled(page)) {
			logger.debug("Community plugins are already enabled.");
			return;
		}

		logger.debug("Attempting to enable community plugins via settings UI...");

		// 1. 設定画面を開き、「Community plugins」タブに移動
		await page.evaluate(() => {
			const app = (window as any).app;
			app.setting.open();
			app.setting.openTabById("community-plugins");
		});

		// 2. 「Turn on community plugins」ボタンを探してクリック
		const settingsContent = page.locator(
			".vertical-tab-content",
		);
		const turnOnButton = settingsContent.locator(".mod-cta", {
			hasText: "Turn on community plugins",
		});

		// ボタンが表示されるまで最大5秒待機
		try {
			await turnOnButton.waitFor({ state: "visible", timeout: 5000 });
			logger.debug("Clicking 'Turn on community plugins' button...");
			await turnOnButton.click();
		} catch (e) {
			await page.pause()
			logger.debug(
				"'Turn on community plugins' button not found, assuming it's already on.",
			);
		}

		// 3. 設定画面を閉じる
		await page.keyboard.press("Escape");
		logger.debug("Closed settings window.");

		// 4. 最終確認：API経由でプラグインが有効になったことを確認
		await expect
			.poll(async () => await this.checkIsCommunityPluginEnabled(page), {
				message: "Failed to enable community plugins.",
				timeout: 10000,
			})
			.toBe(true);
		logger.debug("Successfully enabled community plugins.");
	}

	private async checkIsCommunityPluginEnabled(page: Page): Promise<boolean> {
		return page.evaluate(
			() => (window as any).app?.plugins?.isEnabled?.() ?? false,
		);
	}
}
