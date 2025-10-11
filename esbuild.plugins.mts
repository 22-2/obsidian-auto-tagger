import type { Plugin } from "esbuild";
import fs from "fs/promises";
import { readFileSync } from "node:fs";
import path from "path";

// 型定義
interface ExcludeVendorOptions {
	filter: RegExp;
}

interface CopyPluginOptions {
	opts: Array<{
		src: string[];
		dest: string;
	}>;
}

// 定数
const EMPTY_SOURCE_MAP =
	"data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIiJdLCJtYXBwaW5ncyI6IkEifQ==";

const PLUGIN_NAMES = {
	EXCLUDE_VENDOR: "excludeVendorFromSourceMap",
	PREACT_COMPAT: "preact-compat-resolver",
	COPY: "copy-plugin",
	RENAME: "rename-plugin",
} as const;

// ユーティリティ関数
const fileExists = async (filePath: string): Promise<boolean> => {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
};

const logPlugin = (
	pluginName: string,
	message: string,
	isError = false
): void => {
	const prefix = `[${pluginName}]`;
	if (isError) {
		console.error(prefix, message);
	} else {
		console.log(prefix, message);
	}
};

// プラグイン実装
export const excludeVendorFromSourceMapPlugin = ({
	filter,
}: ExcludeVendorOptions): Plugin => ({
	name: PLUGIN_NAMES.EXCLUDE_VENDOR,
	setup(build) {
		build.onLoad({ filter }, async (args) => {
			if (!args.path.endsWith(".js")) {
				return undefined;
			}

			const contents = readFileSync(args.path, "utf8");
			return {
				contents: `${contents}\n//# sourceMappingURL=${EMPTY_SOURCE_MAP}`,
				loader: "default",
			};
		});
	},
});


export const copyPlugin = ({ opts }: CopyPluginOptions): Plugin => ({
	name: PLUGIN_NAMES.COPY,
	setup(build) {
		build.onEnd(async (result) => {
			if (result.errors.length > 0) {
				logPlugin(
					PLUGIN_NAMES.COPY,
					"Build failed. Skipping file copy."
				);
				return;
			}

			logPlugin(PLUGIN_NAMES.COPY, "Starting file copy process...");

			for (const { src, dest } of opts) {
				if (!dest) {
					logPlugin(
						PLUGIN_NAMES.COPY,
						"Destination path is required.",
						true
					);
					continue;
				}

				try {
					await fs.mkdir(dest, { recursive: true });
					await copyFiles(src, dest);
				} catch (error) {
					logPlugin(
						PLUGIN_NAMES.COPY,
						`Failed processing destination group for '${dest}': ${error}`,
						true
					);
				}
			}

			logPlugin(PLUGIN_NAMES.COPY, "File copy process finished.");
		});
	},
});

const copyFiles = async (srcPaths: string[], dest: string): Promise<void> => {
	for (const srcPath of srcPaths) {
		const fileName = path.basename(srcPath);
		const destPath = path.join(dest, fileName);

		try {
			const exists = await fileExists(srcPath);
			if (!exists) {
				logPlugin(
					PLUGIN_NAMES.COPY,
					`Source file not found: ${srcPath}. Skipping.`
				);
				continue;
			}

			await fs.copyFile(srcPath, destPath);
			logPlugin(PLUGIN_NAMES.COPY, `Copied: ${srcPath} -> ${destPath}`);
		} catch (error) {
			logPlugin(
				PLUGIN_NAMES.COPY,
				`Failed to copy ${srcPath}: ${error}`,
				true
			);
		}
	}
};

export const renamePlugin = (): Plugin => ({
	name: PLUGIN_NAMES.RENAME,
	setup(build) {
		build.onEnd(async () => {
			const oldPath = "./main.css";
			const newPath = "./styles.css";

			try {
				const exists = await fileExists(oldPath);
				if (exists) {
					await fs.rename(oldPath, newPath);
					logPlugin(
						PLUGIN_NAMES.RENAME,
						`Renamed: ${oldPath} -> ${newPath}`
					);
				}
			} catch (error) {
				logPlugin(
					PLUGIN_NAMES.RENAME,
					`Failed to rename file: ${error}`,
					true
				);
			}
		});
	},
});

// 型のエクスポート
export type { CopyPluginOptions, ExcludeVendorOptions };
