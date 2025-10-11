import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const e2eDir = path.join(__dirname, "./e2e");

export default defineConfig({
	timeout: 3000 * 10,
	testDir: "./e2e",
	outputDir: path.join(e2eDir, "./test-results"),
	reporter: [
		["html", { outputFolder: path.join(e2eDir, "./playwright-report") }],
	],
	fullyParallel: true,
	workers: process.env.CI ? 2 : 1,
	use: {
		trace: "on-first-retry",
		video: "on",
		screenshot: "only-on-failure",
		// Block external requests by default to prevent CORS errors
		bypassCSP: true,
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
