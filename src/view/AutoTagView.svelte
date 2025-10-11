<script lang="ts">
	import type { TFile } from "obsidian";
	import type MyPlugin from "../main";
	import type { AutoTaggerState, BatchResult } from "../services/autoTagger";
	import { NoteSelector } from "../services/noteSelector";

	export let plugin: MyPlugin;

	// Helper function to show notices
	function showNotice(message: string, duration = 3000) {
		// @ts-ignore - Notice is available globally in Obsidian
		new Notice(message, duration);
	}

	// State
	let isRunning = false;
	let state: AutoTaggerState | null = null;
	let logs: string[] = [];
	let summary: {
		totalNotes: number;
		successCount: number;
		errorCount: number;
		totalTagsApplied: number;
		startTime: string;
		endTime: string;
	} | null = null;

	// Settings (editable)
	let targetDirectory = plugin.settings.autoTagger.targetDirectory;
	let excludeNoteTag = plugin.settings.autoTagger.excludeNoteTag;
	let excludeSuggestionTags = plugin.settings.autoTagger.excludeSuggestionTags.join(", ");
	let systemInstruction = plugin.settings.autoTagger.systemInstruction;

	// Current processing note
	let currentNoteName = "";

	// Target notes
	let targetNotes: TFile[] = [];

	// AutoTagger instance
	let autoTagger: ReturnType<typeof plugin.createAutoTagger> | null = null;

	async function startAutoTagging() {
		// Reset state
		logs = [];
		summary = null;
		currentNoteName = "";

		// Validate API key (Requirement 1.3)
		if (!plugin.settings.common.geminiApiKey || plugin.settings.common.geminiApiKey.trim() === "") {
			const errorMsg = "Gemini API keyが設定されていません。設定画面でAPI keyを入力してください。";
			addLog(`エラー: ${errorMsg}`);
			showNotice(errorMsg, 5000);
			return;
		}

		// Validate system instruction length (Requirement 3.5)
		if (systemInstruction.length > 5000) {
			const warningMsg = "System instructionが5000文字を超えています。処理を続行しますが、API呼び出しに失敗する可能性があります。";
			addLog(`警告: ${warningMsg}`);
			showNotice(warningMsg, 5000);
		}

		// Update settings
		plugin.settings.autoTagger.targetDirectory = targetDirectory.trim();
		plugin.settings.autoTagger.excludeNoteTag = excludeNoteTag.trim();
		plugin.settings.autoTagger.excludeSuggestionTags = excludeSuggestionTags
			.split(",")
			.map((tag) => tag.trim())
			.filter((tag) => tag.length > 0);
		plugin.settings.autoTagger.systemInstruction = systemInstruction;
		await plugin.saveSettings();

		// Get target notes (Requirement 1.3, 1.5)
		try {
			const noteSelector = new NoteSelector(plugin.app);
			targetNotes = await noteSelector.getTargetNotes({
				targetDirectory: plugin.settings.autoTagger.targetDirectory,
				excludeTag: plugin.settings.autoTagger.excludeNoteTag,
			});

			addLog(`対象ノート数: ${targetNotes.length}`);
			showNotice(`自動タグ付けを開始します（対象: ${targetNotes.length}件）`);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			addLog(`エラー: ${errorMsg}`);
			showNotice(`エラー: ${errorMsg}`, 5000);
			return;
		}

		// Create AutoTagger instance
		autoTagger = plugin.createAutoTagger();

		// Start processing
		isRunning = true;
		addLog("自動タグ付け処理を開始しました");

		try {
			await autoTagger.start(
				targetNotes,
				(newState: AutoTaggerState) => {
					state = newState;
					if (!newState.isRunning) {
						isRunning = false;
						if (autoTagger) {
							summary = autoTagger.getSummary();
						}
						if (newState.shouldStop) {
							addLog("処理が中断されました");
							showNotice("自動タグ付け処理が中断されました");
						} else {
							addLog("処理が完了しました");
							showNotice(`自動タグ付け処理が完了しました（成功: ${newState.successCount}件、失敗: ${newState.errorCount}件）`);
						}
					}
				},
				(results: BatchResult[]) => {
					for (const result of results) {
						if (result.success && result.suggestedTags.length > 0) {
							currentNoteName = result.path;
							addLog(`✓ ${result.path}: ${result.suggestedTags.join(", ")}`);
						} else if (!result.success) {
							addLog(`✗ ${result.path}: ${result.error || "エラー"}`);
						}
					}
				}
			);
		} catch (error) {
			// Unexpected error during processing (Requirement 4.6)
			const errorMsg = error instanceof Error ? error.message : String(error);
			addLog(`予期しないエラーが発生しました: ${errorMsg}`);
			showNotice(`予期しないエラーが発生しました: ${errorMsg}`, 5000);
			isRunning = false;
		}
	}

	function stopAutoTagging() {
		if (autoTagger && state) {
			autoTagger.stop();
			addLog("停止リクエストを送信しました（現在のバッチ完了後に停止します）");
		}
	}

	function addLog(message: string) {
		const timestamp = new Date().toLocaleTimeString();
		logs = [...logs, `[${timestamp}] ${message}`];
	}
</script>

<main>
	<h2>Auto Tagger</h2>

	<div class="settings-section">
		<h3>設定</h3>

		<div class="setting-item">
			<label for="target-directory">対象ディレクトリ</label>
			<input
				id="target-directory"
				type="text"
				bind:value={targetDirectory}
				placeholder="notes/"
				disabled={isRunning}
			/>
		</div>

		<div class="setting-item">
			<label for="exclude-note-tag">ノート除外タグ</label>
			<input
				id="exclude-note-tag"
				type="text"
				bind:value={excludeNoteTag}
				placeholder="processed"
				disabled={isRunning}
			/>
		</div>

		<div class="setting-item">
			<label for="exclude-suggestion-tags">提案除外タグ（カンマ区切り）</label>
			<input
				id="exclude-suggestion-tags"
				type="text"
				bind:value={excludeSuggestionTags}
				placeholder="meta, system"
				disabled={isRunning}
			/>
		</div>

		<div class="setting-item">
			<label for="system-instruction">System Instruction</label>
			<textarea
				id="system-instruction"
				bind:value={systemInstruction}
				rows="4"
				disabled={isRunning}
			/>
		</div>
	</div>

	<div class="controls">
		<button on:click={startAutoTagging} disabled={isRunning}>
			開始
		</button>
		<button on:click={stopAutoTagging} disabled={!isRunning}>
			停止
		</button>
	</div>

	{#if state}
		<div class="progress-section">
			<h3>進捗状況</h3>
			<div class="progress-info">
				<div class="progress-text">
					処理済み: {state.processedNotes} / {state.totalNotes}
					({Math.round((state.processedNotes / state.totalNotes) * 100)}%)
				</div>
				<div class="progress-bar-container">
					<div
						class="progress-bar"
						style="width: {(state.processedNotes / state.totalNotes) * 100}%"
					/>
				</div>
				<div class="progress-stats">
					<span class="stat-success">成功: {state.successCount}</span>
					<span class="stat-error">失敗: {state.errorCount}</span>
					<span>バッチ: {state.currentBatch}</span>
				</div>
			</div>
			{#if currentNoteName}
				<div class="current-note">
					現在処理中: <strong>{currentNoteName}</strong>
				</div>
			{/if}
		</div>
	{/if}

	{#if summary}
		<div class="summary-section">
			<h3>処理サマリー</h3>
			<div class="summary-container">
				<div class="summary-row">
					<span class="summary-label">総ノート数:</span>
					<span class="summary-value">{summary.totalNotes}</span>
				</div>
				<div class="summary-row">
					<span class="summary-label">成功:</span>
					<span class="summary-value stat-success">{summary.successCount}</span>
				</div>
				<div class="summary-row">
					<span class="summary-label">失敗:</span>
					<span class="summary-value stat-error">{summary.errorCount}</span>
				</div>
				<div class="summary-row">
					<span class="summary-label">適用タグ総数:</span>
					<span class="summary-value">{summary.totalTagsApplied}</span>
				</div>
				<div class="summary-row">
					<span class="summary-label">開始時刻:</span>
					<span class="summary-value">{new Date(summary.startTime).toLocaleString()}</span>
				</div>
				<div class="summary-row">
					<span class="summary-label">終了時刻:</span>
					<span class="summary-value">{new Date(summary.endTime).toLocaleString()}</span>
				</div>
			</div>
		</div>
	{/if}

	{#if logs.length > 0}
		<div class="log-section">
			<h3>ログ</h3>
			<div class="log-container">
				{#each logs as log}
					<div class="log-entry">{log}</div>
				{/each}
			</div>
		</div>
	{/if}
</main>

<style>
	main {
		padding: 1rem;
		color: var(--text-normal);
	}

	h2 {
		margin-top: 0;
		color: var(--text-normal);
	}

	h3 {
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
		color: var(--text-normal);
		font-size: 1.1em;
	}

	.settings-section {
		margin-bottom: 1.5rem;
	}

	.setting-item {
		margin-bottom: 1rem;
	}

	.setting-item label {
		display: block;
		margin-bottom: 0.25rem;
		font-weight: 500;
		color: var(--text-normal);
	}

	.setting-item input,
	.setting-item textarea {
		width: 100%;
		padding: 0.5rem;
		background-color: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		color: var(--text-normal);
		font-family: inherit;
	}

	.setting-item input:disabled,
	.setting-item textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.controls {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}

	button {
		padding: 0.5rem 1rem;
		background-color: var(--interactive-accent);
		color: var(--text-on-accent);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
	}

	button:hover:not(:disabled) {
		background-color: var(--interactive-accent-hover);
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.progress-section {
		margin-bottom: 1.5rem;
	}

	.progress-info {
		background-color: var(--background-secondary);
		padding: 1rem;
		border-radius: 4px;
	}

	.progress-text {
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: var(--text-normal);
	}

	.progress-bar-container {
		width: 100%;
		height: 20px;
		background-color: var(--background-primary);
		border-radius: 10px;
		overflow: hidden;
		margin-bottom: 0.5rem;
	}

	.progress-bar {
		height: 100%;
		background-color: var(--interactive-accent);
		transition: width 0.3s ease;
	}

	.progress-stats {
		display: flex;
		gap: 1rem;
		font-size: 0.9em;
		color: var(--text-muted);
	}

	.stat-success {
		color: var(--text-success);
	}

	.stat-error {
		color: var(--text-error);
	}

	.current-note {
		margin-top: 0.75rem;
		padding: 0.5rem;
		background-color: var(--background-primary);
		border-left: 3px solid var(--interactive-accent);
		border-radius: 2px;
		font-size: 0.9em;
	}

	.log-section {
		margin-top: 1.5rem;
	}

	.log-container {
		max-height: 300px;
		overflow-y: auto;
		background-color: var(--background-secondary);
		padding: 1rem;
		border-radius: 4px;
		font-family: var(--font-monospace);
		font-size: 0.85em;
	}

	.log-entry {
		padding: 0.25rem 0;
		color: var(--text-muted);
		word-wrap: break-word;
	}

	.log-entry:not(:last-child) {
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.summary-section {
		margin-bottom: 1.5rem;
		padding: 1rem;
		background-color: var(--background-secondary);
		border-radius: 4px;
		border: 2px solid var(--interactive-accent);
	}

	.summary-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.summary-row {
		display: flex;
		justify-content: space-between;
		padding: 0.25rem 0;
	}

	.summary-label {
		font-weight: 500;
		color: var(--text-normal);
	}

	.summary-value {
		color: var(--text-muted);
		font-family: var(--font-monospace);
	}
</style>
