# Manual Testing Checklist

## Pre-Test Setup

### Environment Preparation
- [ ] Obsidian is installed and running
- [ ] Plugin is built and loaded in Obsidian
- [ ] Test vault is created or selected
- [ ] Gemini API key is configured in settings
- [ ] Test data is set up according to `test-data-setup.md`

### Initial Verification
- [ ] Plugin appears in installed plugins list
- [ ] Settings tab shows Auto Tagger section
- [ ] Ribbon icon for Auto Tagger is visible
- [ ] Command palette shows "Open Auto Tagger" command

---

## Test 1: Small Dataset Test (5-10 notes)

### Setup
- [ ] Navigate to Auto Tagger settings
- [ ] Set target directory: `test-notes/batch1`
- [ ] Set exclude note tag: `processed`
- [ ] Set exclude suggestion tags: `meta, system`
- [ ] Verify system instruction is set

### Execution
- [ ] Open Auto Tagger view (via ribbon or command)
- [ ] Verify settings are displayed correctly
- [ ] Click "開始" (Start) button
- [ ] Observe the UI during processing

### Verification
- [ ] Progress bar appears and updates
- [ ] Progress text shows: "処理済み: X / 5"
- [ ] Current note name is displayed
- [ ] Log entries appear in real-time
- [ ] Success count increments
- [ ] Processing completes automatically
- [ ] Summary section appears
- [ ] Summary shows:
  - [ ] Total notes: 5
  - [ ] Success count: 5 (or appropriate number)
  - [ ] Error count: 0
  - [ ] Total tags applied: > 0
  - [ ] Start and end times are displayed

### Post-Test Verification
- [ ] Open each test note
- [ ] Verify frontmatter has `tags:` field
- [ ] Verify tags are from vault's existing tags
- [ ] Verify no duplicate tags exist
- [ ] Check log file exists at configured path
- [ ] Review log file content for correctness

**Result**: ☐ PASS ☐ FAIL

**Notes**:
```
[Record any observations, issues, or unexpected behavior]
```

---

## Test 2: Batch Processing Verification

### Setup
- [ ] Use test-notes directory with 8 notes
- [ ] Set target directory: `test-notes`
- [ ] Exclude note with "processed" tag

### Execution
- [ ] Start auto-tagging
- [ ] Watch batch counter in progress section
- [ ] Monitor log output

### Verification
- [ ] First batch shows "バッチ: 1"
- [ ] Exactly 5 notes processed in first batch
- [ ] Second batch shows "バッチ: 2"
- [ ] Remaining notes processed in second batch
- [ ] Total processed matches expected count
- [ ] Log shows clear batch boundaries

**Result**: ☐ PASS ☐ FAIL

**Notes**:
```
[Record batch processing observations]
```

---

## Test 3: Stop Functionality Test

### Setup
- [ ] Use dataset with 10+ notes
- [ ] Start auto-tagging

### Execution
- [ ] Click "停止" (Stop) button during first batch
- [ ] Wait for processing to stop

### Verification
- [ ] Stop button is enabled during processing
- [ ] Start button is disabled during processing
- [ ] Current batch completes before stopping
- [ ] Processing stops after current batch
- [ ] Log shows: "停止リクエストを送信しました"
- [ ] Log shows: "処理が中断されました"
- [ ] Partial summary is displayed
- [ ] Summary shows correct counts for processed notes
- [ ] Unprocessed notes remain unchanged

**Result**: ☐ PASS ☐ FAIL

**Notes**:
```
[Record stop functionality observations]
```

---

## Test 4: Log File Output Verification

### Setup
- [ ] Note the log file path from settings
- [ ] Clear any existing log file
- [ ] Run auto-tagging on test dataset

### Execution
- [ ] Complete a full auto-tagging session
- [ ] Navigate to log file location

### Verification
- [ ] Log file exists at specified path
- [ ] File contains session start header
- [ ] Session start includes:
  - [ ] Timestamp in ISO format
  - [ ] Target directory
  - [ ] Exclude note tag
  - [ ] Exclude suggestion tags
- [ ] Each processed note has log entry with:
  - [ ] Timestamp
  - [ ] SUCCESS or ERROR status
  - [ ] Note path
  - [ ] Applied tags (for success)
  - [ ] Error message (for errors)
- [ ] Session summary includes:
  - [ ] Total notes
  - [ ] Success count
  - [ ] Error count
  - [ ] Total tags applied
  - [ ] Duration
  - [ ] End time

**Result**: ☐ PASS ☐ FAIL

**Notes**:
```
[Record log file observations]
```

---

## Test 5: Error Cases

### Test 5.1: Empty Directory Error

#### Execution
- [ ] Set target directory to empty folder
- [ ] Click start

#### Verification
- [ ] Error message: "対象ノートがありません"
- [ ] Processing does not start
- [ ] Error appears in log section

**Result**: ☐ PASS ☐ FAIL

---

### Test 5.2: Non-existent Directory Error

#### Execution
- [ ] Set target directory to `non-existent-folder`
- [ ] Click start

#### Verification
- [ ] Error message contains: "ディレクトリが存在しません"
- [ ] Processing does not start
- [ ] Error appears in log section

**Result**: ☐ PASS ☐ FAIL

---

### Test 5.3: Missing API Key Error

#### Execution
- [ ] Go to settings
- [ ] Clear Gemini API key
- [ ] Save settings
- [ ] Try to start auto-tagging

#### Verification
- [ ] Error message: "Gemini API keyが設定されていません"
- [ ] Notice appears for 5 seconds
- [ ] Processing does not start
- [ ] Error appears in log section

**Result**: ☐ PASS ☐ FAIL

---

### Test 5.4: Invalid API Key Error

#### Execution
- [ ] Set API key to invalid value (e.g., "invalid-key-123")
- [ ] Start auto-tagging

#### Verification
- [ ] API call fails
- [ ] Error message appears in UI
- [ ] Error is logged
- [ ] All notes in batch marked as failed
- [ ] Error count increments
- [ ] Application does not crash

**Result**: ☐ PASS ☐ FAIL

---

### Test 5.5: System Instruction Length Warning

#### Execution
- [ ] Enter system instruction > 5000 characters
- [ ] Click start

#### Verification
- [ ] Warning message appears
- [ ] Warning mentions 5000 character limit
- [ ] Processing continues despite warning
- [ ] Warning is logged

**Result**: ☐ PASS ☐ FAIL

---

## Test 6: Edge Cases

### Test 6.1: All Notes Excluded

#### Execution
- [ ] Tag all notes with exclude tag
- [ ] Start auto-tagging

#### Verification
- [ ] Error: "対象ノートがありません"
- [ ] Processing does not start

**Result**: ☐ PASS ☐ FAIL

---

### Test 6.2: Exactly 5 Notes

#### Execution
- [ ] Use dataset with exactly 5 notes
- [ ] Start auto-tagging

#### Verification
- [ ] Single batch processes all 5 notes
- [ ] Batch counter shows: 1
- [ ] Processing completes after one batch
- [ ] Summary shows correct counts

**Result**: ☐ PASS ☐ FAIL

---

### Test 6.3: Less Than 5 Notes

#### Execution
- [ ] Use dataset with 3 notes
- [ ] Start auto-tagging

#### Verification
- [ ] Single batch processes all 3 notes
- [ ] Batch counter shows: 1
- [ ] Processing completes after one batch
- [ ] Summary shows: Total notes: 3

**Result**: ☐ PASS ☐ FAIL

---

### Test 6.4: Notes with Existing Tags

#### Execution
- [ ] Use note with existing tags in frontmatter
- [ ] Start auto-tagging

#### Verification
- [ ] Existing tags are preserved
- [ ] New tags are added to array
- [ ] No duplicate tags created
- [ ] Frontmatter format is maintained

**Result**: ☐ PASS ☐ FAIL

---

### Test 6.5: Empty Available Tags

#### Execution
- [ ] Use vault with no existing tags
- [ ] Start auto-tagging

#### Verification
- [ ] Processing completes without errors
- [ ] No tags are suggested
- [ ] Success count reflects processed notes
- [ ] No crashes occur

**Result**: ☐ PASS ☐ FAIL

---

## Test 7: UI/UX Verification

### Visual Elements
- [ ] All UI elements are properly styled
- [ ] Text is readable with current theme
- [ ] Buttons are appropriately sized
- [ ] Input fields are functional
- [ ] Progress bar animates smoothly
- [ ] Log section is scrollable
- [ ] Summary section is clearly visible

### Responsiveness
- [ ] UI updates in real-time during processing
- [ ] No UI freezing or lag
- [ ] Buttons respond immediately to clicks
- [ ] Settings can be edited when not running

### Accessibility
- [ ] Labels are clear and descriptive
- [ ] Error messages are informative
- [ ] Success indicators are visible
- [ ] Color coding is meaningful

**Result**: ☐ PASS ☐ FAIL

**Notes**:
```
[Record UI/UX observations]
```

---

## Test 8: Performance Testing

### Small Dataset (5-10 notes)
- [ ] Processing completes in reasonable time
- [ ] No noticeable performance degradation
- [ ] Memory usage is acceptable

### Medium Dataset (20-30 notes)
- [ ] Processing completes successfully
- [ ] UI remains responsive
- [ ] Progress updates are smooth

### Large Dataset (50+ notes) - Optional
- [ ] Processing completes successfully
- [ ] No memory leaks observed
- [ ] Log file size is manageable

**Result**: ☐ PASS ☐ FAIL

**Notes**:
```
[Record performance observations]
```

---

## Test 9: Log File Rotation

### Setup
- [ ] Set max log file size to 1 MB
- [ ] Run multiple auto-tagging sessions

### Verification
- [ ] Log file size is monitored
- [ ] When size exceeds limit, file is rotated
- [ ] Old log file is renamed with timestamp
- [ ] New log file is created
- [ ] No data loss occurs

**Result**: ☐ PASS ☐ FAIL

**Notes**:
```
[Record log rotation observations]
```

---

## Test 10: Integration with Obsidian

### Plugin Integration
- [ ] Plugin loads without errors
- [ ] Settings are persisted across restarts
- [ ] View can be opened/closed multiple times
- [ ] No conflicts with other plugins

### Obsidian Features
- [ ] Frontmatter is properly formatted
- [ ] Tags appear in Obsidian's tag pane
- [ ] File changes trigger cache updates
- [ ] Undo/redo works for tag changes

**Result**: ☐ PASS ☐ FAIL

**Notes**:
```
[Record integration observations]
```

---

## Summary

### Test Results
- Total Tests: ___
- Passed: ___
- Failed: ___
- Skipped: ___

### Critical Issues
```
[List any critical issues that block functionality]
```

### Minor Issues
```
[List any minor issues or improvements]
```

### Overall Assessment
☐ Ready for production
☐ Needs minor fixes
☐ Needs major fixes
☐ Not ready

### Tester Information
- **Name**: _______________
- **Date**: _______________
- **Environment**: _______________
- **Obsidian Version**: _______________
- **Plugin Version**: _______________

### Additional Notes
```
[Any additional observations or recommendations]
```
