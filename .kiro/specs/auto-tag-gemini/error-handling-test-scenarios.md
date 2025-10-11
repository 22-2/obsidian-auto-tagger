# Error Handling Test Scenarios

This document provides test scenarios to verify the error handling implementation.

## Test Scenario 1: Missing API Key

**Steps:**
1. Open Obsidian settings
2. Navigate to Personal Context settings
3. Clear the Gemini API Key field
4. Save settings
5. Open Auto Tagger view
6. Click "開始" (Start) button

**Expected Result:**
- Error message appears in log: "エラー: Gemini API keyが設定されていません。設定画面でAPI keyを入力してください。"
- Notice popup shows: "Gemini API keyが設定されていません。設定画面でAPI keyを入力してください。" (5 seconds)
- Processing does not start
- Start button remains enabled

**Status:** ✅ Implemented

---

## Test Scenario 2: Invalid Target Directory

**Steps:**
1. Open Auto Tagger view
2. Set target directory to a non-existent path (e.g., "nonexistent-folder/")
3. Click "開始" (Start) button

**Expected Result:**
- Error message appears in log: "エラー: ディレクトリが存在しません: nonexistent-folder"
- Notice popup shows: "エラー: ディレクトリが存在しません: nonexistent-folder" (5 seconds)
- Processing does not start
- Start button remains enabled

**Status:** ✅ Implemented

---

## Test Scenario 3: Empty Target Directory

**Steps:**
1. Open Auto Tagger view
2. Leave target directory field empty
3. Click "開始" (Start) button

**Expected Result:**
- Error message appears in log: "エラー: 対象ディレクトリが指定されていません"
- Notice popup shows: "エラー: 対象ディレクトリが指定されていません" (5 seconds)
- Processing does not start
- Start button remains enabled

**Status:** ✅ Implemented

---

## Test Scenario 4: No Notes Match Filter

**Steps:**
1. Open Auto Tagger view
2. Set target directory to a valid folder
3. Set exclude note tag to a tag that all notes in the folder have
4. Click "開始" (Start) button

**Expected Result:**
- Error message appears in log: "エラー: 対象ノートがありません"
- Notice popup shows: "エラー: 対象ノートがありません" (5 seconds)
- Processing does not start
- Start button remains enabled

**Status:** ✅ Implemented

---

## Test Scenario 5: System Instruction Too Long

**Steps:**
1. Open Auto Tagger view
2. Enter more than 5000 characters in the System Instruction field
3. Click "開始" (Start) button

**Expected Result:**
- Warning message appears in log: "警告: System instructionが5000文字を超えています。処理を続行しますが、API呼び出しに失敗する可能性があります。"
- Notice popup shows warning (5 seconds)
- Processing continues (does not stop)

**Status:** ✅ Implemented

---

## Test Scenario 6: API Call Failure

**Steps:**
1. Open Auto Tagger view
2. Set an invalid API key in settings
3. Configure valid target directory with notes
4. Click "開始" (Start) button

**Expected Result:**
- Processing starts successfully
- When API call fails:
  - Error logged to console
  - Notice popup shows: "API呼び出しエラー: {error details}" (5 seconds)
  - All notes in the batch are marked as failed
  - Error logged to log file
  - Processing continues with next batch (if any)
- Summary shows error count

**Status:** ✅ Implemented

---

## Test Scenario 7: Invalid API Response Format

**Steps:**
1. Simulate API returning invalid JSON or unexpected structure
2. (This requires mocking or API returning unexpected data)

**Expected Result:**
- Error logged to console with response text
- Notice popup shows: "APIレスポンスのパースエラー: {error}" or "APIレスポンスの形式が不正です" (5 seconds)
- All notes in the batch are marked as failed
- Processing continues with next batch

**Status:** ✅ Implemented

---

## Test Scenario 8: File Read Error

**Steps:**
1. Create a note file with restricted read permissions (if possible)
2. Include it in the target directory
3. Start auto-tagging

**Expected Result:**
- Error logged to console for that specific note
- That note is marked as failed with error: "ファイル読み込みエラー: {error}"
- Other notes in the same batch are still processed
- Processing continues

**Status:** ✅ Implemented

---

## Test Scenario 9: Tag Application Error

**Steps:**
1. Create a read-only note file
2. Include it in processing
3. Start auto-tagging

**Expected Result:**
- When trying to apply tags to read-only file:
  - Error logged to console
  - Notice popup shows: "{note path}: タグ適用エラー: {error}" (3 seconds)
  - Error logged to log file
  - Processing continues with next note

**Status:** ✅ Implemented

---

## Test Scenario 10: Log File Write Failure

**Steps:**
1. Set log file path to an invalid location (e.g., "Z:/invalid/path/log.txt")
2. Start auto-tagging with valid configuration

**Expected Result:**
- Processing starts and continues normally
- When log write fails:
  - Error logged to console
  - Notice popup shows: "ログファイルへの書き込みに失敗しました: {error}" (3 seconds)
  - **Processing continues** (does not stop)
  - Tags are still applied to notes
  - Summary is still displayed in UI

**Status:** ✅ Implemented

---

## Test Scenario 11: Successful Processing with Some Errors

**Steps:**
1. Configure valid settings
2. Target directory with 10 notes
3. Make 2 notes read-only
4. Start auto-tagging

**Expected Result:**
- Processing starts with notice
- Progress bar updates as notes are processed
- 8 notes succeed (shown with ✓ in log)
- 2 notes fail (shown with ✗ in log)
- Notices shown for the 2 failures
- Processing completes
- Summary shows:
  - Total: 10
  - Success: 8
  - Errors: 2
- Final notice: "自動タグ付け処理が完了しました（成功: 8件、失敗: 2件）"

**Status:** ✅ Implemented

---

## Test Scenario 12: User Interruption

**Steps:**
1. Start auto-tagging with many notes (20+)
2. Click "停止" (Stop) button after a few batches

**Expected Result:**
- Log shows: "停止リクエストを送信しました（現在のバッチ完了後に停止します）"
- Current batch completes processing
- Processing stops after current batch
- Log shows: "処理が中断されました"
- Notice shows: "自動タグ付け処理が中断されました"
- Summary displays with partial results

**Status:** ✅ Implemented (stop functionality was already implemented)

---

## Test Scenario 13: Complete Success

**Steps:**
1. Configure valid settings with valid API key
2. Target directory with 5-10 notes
3. All notes are readable and writable
4. Start auto-tagging

**Expected Result:**
- Notice: "自動タグ付けを開始します（対象: {count}件）"
- Progress bar updates smoothly
- All notes show ✓ in log with suggested tags
- No error messages
- Processing completes
- Summary shows all successes
- Notice: "自動タグ付け処理が完了しました（成功: {count}件、失敗: 0件）"
- Log file contains complete session record

**Status:** ✅ Implemented

---

## Error Recovery Verification

### Batch-Level Recovery
- ✅ If one batch fails completely (API error), next batch is still processed
- ✅ Error count increments appropriately
- ✅ Processing continues until all batches are attempted or user stops

### Note-Level Recovery
- ✅ If one note in a batch fails to read, other notes in batch are still processed
- ✅ If one note fails tag application, other notes still get tags applied
- ✅ Each failure is logged individually

### Graceful Degradation
- ✅ Log file write failures don't stop processing
- ✅ UI continues to update even if logging fails
- ✅ Summary is still generated and displayed

---

## Console Logging Verification

All errors should be logged to console with appropriate detail:
- ✅ File read errors: Full error with file path
- ✅ API errors: Full error with response text
- ✅ Parse errors: Error with response text
- ✅ Tag application errors: Error with file path
- ✅ Log write errors: Error with log file path

---

## User Notification Verification

All critical errors should show Notice popups:
- ✅ Configuration errors (API key, directory)
- ✅ API call failures
- ✅ Parse errors
- ✅ Tag application failures (per note)
- ✅ Log write failures
- ✅ Success/completion messages

---

## Notes for Testers

1. **Console Access**: Open Developer Tools (Ctrl+Shift+I) to view console logs
2. **Log File Location**: Default is `.obsidian/plugins/personal-context/logs/auto-tag.log`
3. **Notice Duration**: Errors show for 5 seconds, info for 3 seconds
4. **UI Log**: All messages also appear in the Auto Tagger view log panel
5. **Processing Continuation**: Most errors should not stop the entire process
