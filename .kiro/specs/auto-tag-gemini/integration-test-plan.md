# Integration Test Plan for Auto Tagger

## Overview
This document outlines the integration testing strategy for the Auto Tagger feature. The tests are designed to verify the complete end-to-end functionality of the system.

## Test Environment Setup

### Prerequisites
1. Obsidian vault with test data
2. Valid Gemini API key configured
3. Test directory structure:
   ```
   test-notes/
   ├── note1.md (no tags)
   ├── note2.md (no tags)
   ├── note3.md (no tags)
   ├── note4.md (no tags)
   ├── note5.md (no tags)
   ├── note6.md (with "processed" tag)
   ├── note7.md (no tags)
   └── note8.md (no tags)
   ```

### Test Data Preparation
Create 8 test notes with varying content to test different scenarios:
- Notes 1-5: Clean notes without tags (first batch)
- Note 6: Note with "processed" tag (should be excluded)
- Notes 7-8: Additional notes for second batch

## Test Scenarios

### 1. Small Dataset Test (5-10 notes)
**Objective**: Verify basic functionality with a small dataset

**Steps**:
1. Configure Auto Tagger settings:
   - Target directory: `test-notes/`
   - Exclude note tag: `processed`
   - Exclude suggestion tags: `meta, system`
   - System instruction: Default
2. Open Auto Tagger view
3. Click "開始" (Start) button
4. Observe processing

**Expected Results**:
- ✓ System identifies 7 target notes (excluding note6 with "processed" tag)
- ✓ Progress bar shows 0/7 → 7/7
- ✓ First batch processes 5 notes
- ✓ Second batch processes remaining 2 notes
- ✓ Tags are applied to notes' frontmatter
- ✓ Success count shows 7
- ✓ Error count shows 0
- ✓ Summary is displayed at completion

**Verification**:
- Check each note's frontmatter for new tags
- Verify tags are from vault's existing tags
- Confirm no duplicate tags were added

---

### 2. Batch Processing Verification
**Objective**: Verify that notes are processed in batches of 5

**Steps**:
1. Use the same 8-note test dataset
2. Start auto-tagging
3. Monitor the log output

**Expected Results**:
- ✓ Batch 1 processes exactly 5 notes
- ✓ Batch 2 processes exactly 2 notes (remaining)
- ✓ Current batch counter increments: 1 → 2
- ✓ Each batch completion triggers a log entry
- ✓ Progress updates after each batch

**Verification**:
- Check log entries show batch boundaries
- Verify API is called twice (once per batch)
- Confirm all 7 notes are processed

---

### 3. Stop Functionality Test
**Objective**: Verify that stop button works correctly

**Steps**:
1. Use a larger dataset (10+ notes)
2. Start auto-tagging
3. Click "停止" (Stop) button during first batch
4. Wait for current batch to complete

**Expected Results**:
- ✓ Stop button becomes enabled when processing starts
- ✓ System completes current batch before stopping
- ✓ Processing stops after current batch
- ✓ Partial summary is displayed
- ✓ Log shows "処理が中断されました" message
- ✓ Processed notes have tags applied
- ✓ Unprocessed notes remain unchanged

**Verification**:
- Check that exactly 5 notes were processed (first batch)
- Verify remaining notes have no new tags
- Confirm summary shows correct counts

---

### 4. Log File Output Verification
**Objective**: Verify log file is created and contains correct information

**Steps**:
1. Configure log file path: `.obsidian/plugins/personal-context/logs/auto-tag.log`
2. Run auto-tagging on test dataset
3. Check log file after completion

**Expected Results**:
- ✓ Log file is created at specified path
- ✓ Session start header is present with timestamp
- ✓ Target directory is logged
- ✓ Exclude tags are logged
- ✓ Each successful tag application is logged with:
  - Timestamp
  - Note path
  - Applied tags
- ✓ Session summary is logged with:
  - Total notes
  - Success count
  - Error count
  - Total tags applied
  - Duration

**Verification**:
- Open log file and verify format matches design
- Check timestamps are in ISO format
- Confirm all processed notes are listed

---

### 5. Error Case Testing

#### 5.1 Empty Directory Error
**Steps**:
1. Set target directory to empty folder
2. Start auto-tagging

**Expected Results**:
- ✓ Error message: "対象ノートがありません"
- ✓ Processing does not start
- ✓ Error is displayed in UI

#### 5.2 Non-existent Directory Error
**Steps**:
1. Set target directory to non-existent path
2. Start auto-tagging

**Expected Results**:
- ✓ Error message: "ディレクトリが存在しません: [path]"
- ✓ Processing does not start
- ✓ Error is displayed in UI

#### 5.3 Missing API Key Error
**Steps**:
1. Clear Gemini API key in settings
2. Start auto-tagging

**Expected Results**:
- ✓ Error message: "Gemini API keyが設定されていません"
- ✓ Processing does not start
- ✓ Error is displayed in UI with 5-second duration

#### 5.4 API Call Failure
**Steps**:
1. Use invalid API key or simulate network error
2. Start auto-tagging

**Expected Results**:
- ✓ Error is logged for the batch
- ✓ Error message shows in UI
- ✓ All notes in batch are marked as failed
- ✓ Error count increments
- ✓ Processing continues (doesn't crash)

#### 5.5 File Read Error
**Steps**:
1. Create a note with read permissions issue (if possible)
2. Start auto-tagging

**Expected Results**:
- ✓ Error is logged for that specific note
- ✓ Other notes in batch continue processing
- ✓ Error count increments by 1
- ✓ Processing continues

#### 5.6 File Write Error
**Steps**:
1. Lock a note file (make it read-only)
2. Start auto-tagging

**Expected Results**:
- ✓ Error is logged: "タグ適用エラー"
- ✓ Error count increments
- ✓ Other notes continue processing
- ✓ Notice is shown to user

#### 5.7 Log File Write Error
**Steps**:
1. Set log file path to invalid location
2. Start auto-tagging

**Expected Results**:
- ✓ Error notice: "ログファイルへの書き込みに失敗しました"
- ✓ Processing continues despite log error
- ✓ Tags are still applied to notes

#### 5.8 System Instruction Length Warning
**Steps**:
1. Enter system instruction > 5000 characters
2. Start auto-tagging

**Expected Results**:
- ✓ Warning message displayed
- ✓ Processing continues
- ✓ Warning logged

---

### 6. Edge Cases

#### 6.1 All Notes Excluded
**Steps**:
1. Tag all notes with exclude tag
2. Start auto-tagging

**Expected Results**:
- ✓ Error: "対象ノートがありません"
- ✓ Processing does not start

#### 6.2 Exactly 5 Notes
**Steps**:
1. Use dataset with exactly 5 notes
2. Start auto-tagging

**Expected Results**:
- ✓ Single batch processes all 5 notes
- ✓ Processing completes after one batch
- ✓ Summary shows correct counts

#### 6.3 Less Than 5 Notes
**Steps**:
1. Use dataset with 3 notes
2. Start auto-tagging

**Expected Results**:
- ✓ Single batch processes all 3 notes
- ✓ Processing completes after one batch
- ✓ Summary shows correct counts

#### 6.4 Notes with Existing Tags
**Steps**:
1. Create notes with existing tags
2. Start auto-tagging

**Expected Results**:
- ✓ Existing tags are preserved
- ✓ New tags are added
- ✓ No duplicate tags are created

#### 6.5 Empty Available Tags
**Steps**:
1. Use vault with no existing tags
2. Start auto-tagging

**Expected Results**:
- ✓ Processing completes
- ✓ No tags are suggested (empty arrays)
- ✓ No errors occur

---

## Test Execution Checklist

### Pre-Test Setup
- [ ] Create test vault with test-notes directory
- [ ] Create 8 test notes with appropriate content
- [ ] Configure valid Gemini API key
- [ ] Clear any existing log files
- [ ] Add some existing tags to vault for suggestions

### Test Execution
- [ ] Test 1: Small Dataset Test
- [ ] Test 2: Batch Processing Verification
- [ ] Test 3: Stop Functionality Test
- [ ] Test 4: Log File Output Verification
- [ ] Test 5.1: Empty Directory Error
- [ ] Test 5.2: Non-existent Directory Error
- [ ] Test 5.3: Missing API Key Error
- [ ] Test 5.4: API Call Failure
- [ ] Test 5.5: File Read Error
- [ ] Test 5.6: File Write Error
- [ ] Test 5.7: Log File Write Error
- [ ] Test 5.8: System Instruction Length Warning
- [ ] Test 6.1: All Notes Excluded
- [ ] Test 6.2: Exactly 5 Notes
- [ ] Test 6.3: Less Than 5 Notes
- [ ] Test 6.4: Notes with Existing Tags
- [ ] Test 6.5: Empty Available Tags

### Post-Test Verification
- [ ] Review all log files
- [ ] Verify no data corruption in notes
- [ ] Check for memory leaks (if applicable)
- [ ] Verify UI state is correct after all tests
- [ ] Confirm no console errors

---

## Success Criteria

All tests must pass with the following criteria:
1. ✓ No crashes or unhandled exceptions
2. ✓ All error cases are handled gracefully
3. ✓ Log files are created and formatted correctly
4. ✓ Tags are applied correctly to notes
5. ✓ Batch processing works as designed
6. ✓ Stop functionality works correctly
7. ✓ UI updates reflect actual state
8. ✓ Summary displays accurate information
9. ✓ All requirements are satisfied

---

## Known Limitations

1. Cannot test actual Gemini API responses without real API calls
2. File permission testing may be platform-dependent
3. Network error simulation requires manual intervention
4. Performance testing with large datasets (100+ notes) is manual

---

## Test Report Template

```markdown
# Auto Tagger Integration Test Report

**Date**: [Date]
**Tester**: [Name]
**Environment**: [OS, Obsidian version]

## Test Results Summary
- Total Tests: 20
- Passed: [X]
- Failed: [X]
- Skipped: [X]

## Detailed Results

### Test 1: Small Dataset Test
- Status: [PASS/FAIL]
- Notes: [Any observations]

[Continue for all tests...]

## Issues Found
1. [Issue description]
2. [Issue description]

## Recommendations
1. [Recommendation]
2. [Recommendation]
```
