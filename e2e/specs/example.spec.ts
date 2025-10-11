// E:\Desktop\coding\pub\obsidian-sandbox-note\e2e\specs\setup\example.spec.ts
import { VIEW_TYPE_AUTO_TAGGER } from "src/utils/constants";
import "../setup/logger-setup";
// ===================================================================
// Example Test (example.test.mts)
// ===================================================================

import { expect, test } from "../base";
import {
	CMD_ID_OPEN_PLUGIN_VIEW,
	DIST_DIR,
	PLUGIN_ID,
	SANDBOX_VAULT_NAME,
} from "../constants";
import { AutoTaggerPageObject } from "../helpers/AutoTaggerPageObject"; // Import AutoTaggerPageObject

test("sandbox test: plugin activation and view creation via command", async ({
	vault,
}) => {
	// Instantiate ObsidianPageObject
	const atPage = new AutoTaggerPageObject(vault.window, vault.pluginHandleMap);

	// 1. Initial setup verification
	// Verify Vault name
	const vaultName = await vault.window.evaluate(() => app.vault.getName());
	expect(vaultName).toBe(SANDBOX_VAULT_NAME);

	// Verify plugin activation
	expect(
		await vault.window.evaluate(
			(pluginId) => app.plugins.getPlugin(pluginId),
			PLUGIN_ID,
		),
	).toBeTruthy();

	// 2. Create a new sandbox view (via command)
	// Use ObsidianPageObject method
	await atPage.runCommand(CMD_ID_OPEN_PLUGIN_VIEW);

	// 3. Verify the view opened correctly
	await atPage.expectViewCount(VIEW_TYPE_AUTO_TAGGER, 1);
	await atPage.expectActiveTabType(VIEW_TYPE_AUTO_TAGGER);
});

// Custom settings are maintained
test.use({
	vaultOptions: {
		useSandbox: true,
		plugins: [
			{
				path: DIST_DIR,
				pluginId: PLUGIN_ID,
			},
		],
	},
});
