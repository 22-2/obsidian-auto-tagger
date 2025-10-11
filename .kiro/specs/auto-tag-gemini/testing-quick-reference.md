# Auto Tagger Testing Quick Reference

## Quick Start Testing (5 Minutes)

### Minimal Test Setup
1. Create folder: `test-notes/`
2. Create 3 markdown files with simple content
3. Add a few tags to your vault
4. Configure Auto Tagger:
   - Target: `test-notes`
   - Exclude tag: (leave empty)
   - API key: (your key)
5. Open Auto Tagger view
6. Click "開始"
7. Verify tags are added

---

## Essential Test Scenarios

### ✅ Happy Path (Must Pass)
```
Setup: 5 notes, valid API key, existing tags
Action: Start auto-tagging
Expected: All notes tagged successfully
```

### ⚠️ Error Handling (Must Pass)
```
Setup: Empty API key
Action: Start auto-tagging
Expected: Error message, no crash
```

### 🛑 Stop Function (Must Pass)
```
Setup: 10+ notes
Action: Start, then click stop during first batch
Expected: Stops after current batch completes
```

---

## Quick Verification Checklist

After running auto-tagger:
- [ ] Notes have frontmatter with tags
- [ ] Log file exists
- [ ] Summary is displayed
- [ ] No console errors
- [ ] UI returns to ready state

---

## Common Test Commands

### Console Debugging
```javascript
// Get plugin
const plugin = app.plugins.plugins['auto-tagger'];

// Check settings
plugin.settings.autoTagger

// Get all tags
app.metadataCache.getTags()

// Get test notes
app.vault.getMarkdownFiles().filter(f => f.path.startsWith('test-notes/'))
```

---

## Expected Behavior Summary

| Scenario | Expected Result |
|----------|----------------|
| 5 notes | 1 batch, all processed |
| 10 notes | 2 batches (5+5) |
| 3 notes | 1 batch, all processed |
| Empty dir | Error message |
| No API key | Error message |
| Stop clicked | Completes current batch, then stops |

---

## Quick Issue Diagnosis

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| No tags applied | No vault tags exist | Add tags to vault |
| "対象ノートがありません" | Wrong directory path | Check path format |
| API error | Invalid API key | Verify key in settings |
| UI frozen | Network issue | Check connection |
| No log file | Path error | Use default path |

---

## Test Data Templates

### Minimal Note (Copy-Paste Ready)
```markdown
# Test Note 1

This is a test note about project management and productivity.
It discusses agile methodologies and software development practices.
```

### Note with Existing Tags
```markdown
---
tags:
  - existing-tag
---

# Test Note 2

Content about machine learning and AI.
```

---

## Performance Benchmarks

| Notes | Expected Time | Max Time |
|-------|--------------|----------|
| 5 | 10-20s | 30s |
| 10 | 20-40s | 60s |
| 20 | 40-80s | 120s |

If exceeding max time, check:
- Network speed
- API response time
- Note content length

---

## Critical Paths to Test

1. **Basic Flow**: Start → Process → Complete → Summary
2. **Error Flow**: Invalid config → Error message → No crash
3. **Stop Flow**: Start → Stop → Partial complete → Summary
4. **Log Flow**: Start → Process → Check log file

---

## Test Status Quick Check

Run through these in order:

1. ✓ Plugin loads
2. ✓ View opens
3. ✓ Settings work
4. ✓ Start button works
5. ✓ Processing completes
6. ✓ Tags applied
7. ✓ Log created
8. ✓ Summary shown
9. ✓ Stop works
10. ✓ Errors handled

If all ✓, basic functionality is working.

---

## Emergency Debugging

If something is broken:

1. **Check Console** (Ctrl+Shift+I)
   - Look for red errors
   - Note the error message

2. **Check Settings**
   - API key present?
   - Directory exists?
   - Path format correct?

3. **Check Files**
   - Test notes exist?
   - Vault has tags?
   - Log directory writable?

4. **Reload Obsidian**
   - Often fixes transient issues

---

## Test Report One-Liner

After testing, summarize:
```
[Date] - [Pass/Fail] - [X/20 tests] - [Critical issues: X] - [Notes: ...]
```

Example:
```
2025-10-11 - PASS - 18/20 tests - Critical issues: 0 - Minor UI lag on large batches
```

---

## Files to Check After Testing

1. **Test notes**: Verify frontmatter
2. **Log file**: `.obsidian/plugins/auto-tagger/logs/auto-tag.log`
3. **Console**: No errors
4. **Settings**: Values persisted

---

## Regression Test (Quick)

Run this after any code changes:

1. Create 5 test notes
2. Start auto-tagging
3. Verify completion
4. Check one note has tags
5. Check log file exists

Time: ~2 minutes

---

## Test Environment Reset

To start fresh:

1. Delete `test-notes/` directory
2. Delete log file
3. Reset settings to defaults
4. Reload Obsidian
5. Recreate test data

---

## Success Criteria (Minimum)

For release, these MUST work:
- ✅ Basic tagging (5 notes)
- ✅ Batch processing (10 notes)
- ✅ Stop functionality
- ✅ Error handling (no API key)
- ✅ Log file creation

---

## Contact for Issues

If you find bugs during testing:
1. Note the exact steps to reproduce
2. Capture console errors
3. Save log file
4. Take screenshots
5. Document in test report
