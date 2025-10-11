// E:\Desktop\coding\my-projects-02\obsidian-auto-tagger\e2e\helpers\managers\PageManager.ts
// ===================================================================
// page-manager.mts - ページ遷移の管理
// ===================================================================

import chalk from "chalk";
import log from "loglevel";
import type { ElectronApplication, Page } from "playwright";
import invariant from "tiny-invariant";

const logger = log.getLogger("PageManager");

export class PageManager {
	constructor(private app: ElectronApplication) {}

	/**
	 * 現在開かれているウィンドウを確認し、単一のウィンドウのみが開いている状態を保証します。
	 * @returns 操作対象となる単一のページ
	 */
	async ensureSingleWindow(): Promise<Page> {
		logger.debug("Ensuring a single window is open...");
		const windows = this.app.windows();
		logger.debug(`${windows.length} window(s) currently open.`);

		if (windows.length === 0) {
			logger.debug("No windows open, waiting for the first one.");
			const page = await this.app.firstWindow();
			await this.waitForPage(page);
			return page;
		}

		// 新しいウィンドウは配列の最後に追加されるため、最後のウィンドウを操作対象とする
		const mainPage = windows.at(-1)!;
		invariant(mainPage, "Failed to get the main page.");

		logger.debug(`Main window identified: ${mainPage.url()}`);
		await this.waitForPage(mainPage);

		await this.closeAllExcept(mainPage);
		logger.debug(`Closed all other windows except '${await mainPage.title()}'.`);
		return mainPage;
	}

	/**
	 * アクションを実行し、その結果として開かれる新しいウィンドウを待機します。
	 * 完了後、元々開いていた古いウィンドウはすべて閉じられます。
	 * @param action 新しいウィンドウを開くための非同期アクション
	 * @param wait 新しいページが準備完了になるまで待機する関数 (デフォルト: this.waitForPage)
	 * @returns 準備が完了した新しいページ
	 */
	async executeActionAndWaitForNewWindow(
		action: () => Promise<void>,
		wait: (page: Page) => Promise<void> = (page) => this.waitForPage(page),
	): Promise<Page> {
		const currentWindows = this.app.windows();

		// 1. 新しいウィンドウが開くのを待つPromiseを準備
		const windowPromise = this.app.waitForEvent("window", { timeout: 10000 });

		// 2. 新しいウィンドウを開くアクションを実行
		await action();

		// 3. 実際に新しいウィンドウが開くまで待つ
		const newPage = await windowPromise;

		// 4. 新しいページが完全に準備できるのを待つ (VaultやStarter画面の読み込み完了など)
		await wait(newPage);

		// 5. 元々開いていた古いウィンドウを閉じる
		for (const window of currentWindows) {
			if (window !== newPage && !window.isClosed()) {
				logger.debug(
					chalk.yellow(`Closing old window: ${await window.title()}`),
				);
				await window.close();
			}
		}

		logger.debug(chalk.green("New window is ready:", newPage.url()));
		return newPage;
	}

	/**
	 * 指定されたページが完全に読み込まれるのを待ちます。
	 * スターターページかVaultページかを自動で判別します。
	 * @param page 待機対象のページ
	 */
	async waitForPage(page: Page): Promise<void> {
		if (this.isStarterPage(page)) {
			await this.waitForStarterReady(page);
		} else {
			await this.waitForVaultReady(page);
		}
	}

	/**
	 * 指定されたページがスターターページかどうかを判定します。
	 * @param page 判定対象のページ
	 */
	isStarterPage(page: Page): boolean {
		return page.url().includes("starter");
	}

	private async closeAllExcept(keepPage: Page): Promise<void> {
		for (const window of this.app.windows()) {
			if (window !== keepPage && !window.isClosed()) {
				logger.debug(chalk.red(`Closing window: ${window.url()}`));
				await window.close();
			}
		}
	}

	/**
	 * Vaultページが操作可能になるまで待機します。
	 * (Obsidianの`workspace.onLayoutReady`イベントを待ちます)
	 */
	private async waitForVaultReady(page: Page): Promise<void> {
		await page.waitForLoadState("domcontentloaded");
		await page.waitForFunction(
			() => {
				const app = (window as any).app;
				// `app.workspace.onLayoutReady` を使用して、UIの準備が整うのを待つ
				if (app?.workspace?.onLayoutReady) {
					return new Promise<boolean>((resolve) => {
						app.workspace.onLayoutReady(() => resolve(true));
					});
				}
				return false;
			},
			{ timeout: 15000 }, // CI環境など遅い場合を考慮して少し長めに
		);
		logger.debug("Vault layout is ready.");
	}

	/**
	 * スターターページが操作可能になるまで待機します。
	 * (言語変更ボタンが表示されることを確認します)
	 */
	private async waitForStarterReady(page: Page): Promise<void> {
		await page.waitForSelector(".mod-change-language", {
			state: "visible",
			timeout: 10000,
		});
		logger.debug("Starter page is ready.");
	}
}
