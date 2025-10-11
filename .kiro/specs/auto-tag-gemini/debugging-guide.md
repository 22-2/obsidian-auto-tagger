# Debugging Guide for Auto Tagger

## Overview
This guide provides troubleshooting steps and debugging techniques for the Auto Tagger feature.

---

## Common Issues and Solutions

### Issue 1: Auto Tagger View Not Opening

**Symptoms**:
- Clicking ribbon icon does nothing
- Command palette command doesn't work
- No error messages appear

**Debugging Steps**:
1. Open Developer Console (Ctrl+Shift+I or Cmd+Option+I)
2. Check for JavaScript errors
3. Verify plugin is enabled in settings
4. Check if view is registered:
   ```javascript
   // In console
   app.workspace.getLeavesOfType('auto-tag-view')
   ```

**Solutions**:
- Reload Obsidian
- Disable and re-enable plugin
- Check for plugin conflicts
- Verify plugin files are not corrupted

---

### Issue 2: "対象ノートがありません" Error

**Symptoms**:
- Error appears immediately when starting
- No notes are processed

**Debugging Steps**:
1. Verify target directory exists
2. Check directory path format (no leading/trailing slashes)
3. Verify directory contains markdown files
4. Check if all notes have exclude tag

**Solutions**:
- Correct directory path
- Remove exclude tag from some notes
- Verify markdown files have `.md` extension
- Check file permissions

---

### Issue 3: API Key Not Working

**Symptoms**:
- "API request failed" error
- Status 401 or 403 errors
- "API key not set" error

**Debugging Steps**:
1. Verify API key is entered correctly (no spaces)
2. Check API key is valid in Google AI Studio
3. Enable debug logging in settings
4. Check console for detailed error messages
5. Test API key with curl:
   ```bash
   curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=YOUR_API_KEY" \
     -H 'Content-Type: application/json' \
     -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
   ```

**Solutions**:
- Generate new API key
- Check API quota limits
- Verify API is enabled in Google Cloud Console
- Check network connectivity

---

### Issue 4: Tags Not Being Applied

**Symptoms**:
- Processing completes successfully
- No tags appear in notes
- Success count is > 0 but notes unchanged

**Debugging Steps**:
1. Open a processed note
2. Check frontmatter format
3. Enable debug logging
4. Check console for file write errors
5. Verify file is not read-only
6. Check if tags are empty arrays in response

**Solutions**:
- Check file permissions
- Verify frontmatter syntax
- Check if AI is returning empty tag arrays
- Review system instruction
- Verify available tags exist in vault

---

### Issue 5: Processing Hangs or Freezes

**Symptoms**:
- Progress bar stops updating
- UI becomes unresponsive
- No error messages

**Debugging Steps**:
1. Check console for errors
2. Monitor network requests in DevTools
3. Check if API call is pending
4. Verify batch size is reasonable
5. Check for infinite loops in code

**Solutions**:
- Reload Obsidian
- Reduce batch size
- Check network connectivity
- Verify API is responding
- Check for rate limiting

---

### Issue 6: Log File Not Created

**Symptoms**:
- Processing completes but no log file
- Log file path error in console

**Debugging Steps**:
1. Verify log file path is valid
2. Check directory permissions
3. Check if parent directories exist
4. Enable debug logging
5. Check console for file write errors

**Solutions**:
- Create parent directories manually
- Use default log path
- Check vault permissions
- Verify path format (forward slashes)

---

### Issue 7: Incorrect Tag Suggestions

**Symptoms**:
- Tags don't match note content
- Irrelevant tags are suggested
- Same tags for all notes

**Debugging Steps**:
1. Review system instruction
2. Check available tags in vault
3. Verify exclude tags are working
4. Check note content is being sent
5. Review API response in console

**Solutions**:
- Improve system instruction
- Add more relevant tags to vault
- Adjust exclude tags list
- Verify note content is readable
- Test with different Gemini model

---

### Issue 8: Batch Processing Not Working

**Symptoms**:
- All notes processed at once
- Batch counter doesn't increment
- Only one API call made

**Debugging Steps**:
1. Check batch size setting
2. Verify loop logic in autoTagger.ts
3. Check console for batch logs
4. Monitor API calls in Network tab

**Solutions**:
- Verify batch size is set to 5
- Check for code modifications
- Review processBatch implementation
- Check if notes array is being sliced correctly

---

## Debugging Tools

### 1. Developer Console

**Opening Console**:
- Windows/Linux: `Ctrl + Shift + I`
- Mac: `Cmd + Option + I`

**Useful Console Commands**:
```javascript
// Get plugin instance
const plugin = app.plugins.plugins['personal-context'];

// Check settings
console.log(plugin.settings);

// Get Auto Tagger view
const view = app.workspace.getLeavesOfType('auto-tag-view')[0]?.view;

// Check current state
console.log(view?.component?.props?.plugin);

// Get all vault tags
app.metadataCache.getTags();

// Get files in directory
app.vault.getMarkdownFiles().filter(f => f.path.startsWith('test-notes/'));
```

### 2. Enable Debug Logging

1. Go to Settings → Personal Context
2. Scroll to "Advanced" section
3. Enable "Enable debug logging"
4. Check console for detailed logs

### 3. Network Monitoring

1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "generativelanguage.googleapis.com"
4. Monitor API requests and responses
5. Check request payload and response data

### 4. Breakpoint Debugging

For developers:
1. Open DevTools Sources tab
2. Find plugin files in filesystem
3. Set breakpoints in key functions:
   - `autoTagger.start()`
   - `processBatch()`
   - `applyTagsToNote()`
4. Step through code execution

---

## Logging and Diagnostics

### Check Log File

**Location**: `.obsidian/plugins/personal-context/logs/auto-tag.log`

**What to Look For**:
- Session start timestamp
- Configuration values
- Each note processing result
- Error messages
- Session summary

**Example Log Analysis**:
```
=== Auto-Tagging Session Started ===
Timestamp: 2025-10-11T10:30:00.000Z
Target Directory: test-notes/
Exclude Note Tag: processed
Exclude Suggestion Tags: meta, system

[2025-10-11T10:30:05.123Z] SUCCESS: test-notes/note1.md
  Applied Tags: productivity, project-management

[2025-10-11T10:30:08.456Z] ERROR: test-notes/note2.md
  Error: API呼び出しエラー: Rate limit exceeded

=== Session Summary ===
Total Notes: 5
Success: 4
Errors: 1
Total Tags Applied: 12
Duration: 30s
```

### Console Error Patterns

**API Errors**:
```
Gemini API Error: {"error": {"code": 401, "message": "API key not valid"}}
```
→ Check API key configuration

**File Errors**:
```
Failed to apply tags to test-notes/note1.md: Error: Permission denied
```
→ Check file permissions

**Parse Errors**:
```
Failed to parse API response: SyntaxError: Unexpected token
```
→ Check API response format

---

## Performance Profiling

### Memory Usage

**Check Memory**:
1. Open DevTools → Memory tab
2. Take heap snapshot before processing
3. Run auto-tagging
4. Take heap snapshot after processing
5. Compare snapshots for leaks

**Expected Memory Usage**:
- Small dataset (5-10 notes): < 50 MB
- Medium dataset (20-30 notes): < 100 MB
- Large dataset (50+ notes): < 200 MB

### Processing Time

**Expected Times** (approximate):
- 5 notes: 10-30 seconds
- 10 notes: 20-60 seconds
- 20 notes: 40-120 seconds

**Factors Affecting Speed**:
- API response time
- Network latency
- Note content length
- Number of available tags

---

## Testing Specific Components

### Test NoteSelector

```javascript
// In console
const { NoteSelector } = require('./src/services/noteSelector');
const selector = new NoteSelector(app);

// Test getting notes
const notes = await selector.getTargetNotes({
  targetDirectory: 'test-notes',
  excludeTag: 'processed'
});
console.log('Found notes:', notes.length);
```

### Test Logger

```javascript
// In console
const { LoggerService } = require('./src/services/logger');
const logger = new LoggerService(
  app,
  '.obsidian/plugins/personal-context/logs/test.log',
  10
);

// Test logging
await logger.log({
  timestamp: new Date().toISOString(),
  notePath: 'test.md',
  appliedTags: ['test-tag'],
  success: true
});
```

### Test AutoTagger

```javascript
// In console
const plugin = app.plugins.plugins['personal-context'];
const autoTagger = plugin.createAutoTagger();

// Check state
console.log(autoTagger.getState());
```

---

## Troubleshooting Checklist

When encountering issues, go through this checklist:

- [ ] Plugin is enabled
- [ ] Obsidian is up to date
- [ ] API key is configured
- [ ] Target directory exists
- [ ] Target directory contains markdown files
- [ ] At least one note doesn't have exclude tag
- [ ] Vault has existing tags
- [ ] Network connection is working
- [ ] No console errors
- [ ] Debug logging is enabled
- [ ] Log file directory is writable
- [ ] No file permission issues
- [ ] Settings are saved correctly

---

## Getting Help

### Information to Provide

When reporting issues, include:

1. **Environment**:
   - OS and version
   - Obsidian version
   - Plugin version

2. **Configuration**:
   - Auto Tagger settings (redact API key)
   - Number of notes in target directory
   - Number of existing tags in vault

3. **Error Details**:
   - Console errors (full stack trace)
   - Log file content
   - Steps to reproduce
   - Expected vs actual behavior

4. **Screenshots**:
   - Error messages
   - UI state
   - Settings screen

### Debug Information Export

```javascript
// Run in console to export debug info
const debugInfo = {
  obsidianVersion: app.appVersion,
  pluginVersion: app.plugins.plugins['personal-context'].manifest.version,
  settings: {
    ...app.plugins.plugins['personal-context'].settings,
    common: {
      ...app.plugins.plugins['personal-context'].settings.common,
      geminiApiKey: '[REDACTED]'
    }
  },
  vaultStats: {
    totalFiles: app.vault.getMarkdownFiles().length,
    totalTags: Object.keys(app.metadataCache.getTags()).length
  }
};
console.log(JSON.stringify(debugInfo, null, 2));
```

---

## Known Issues and Workarounds

### Issue: Rate Limiting

**Problem**: API returns 429 error after multiple requests

**Workaround**:
- Wait a few minutes between sessions
- Use smaller batch sizes
- Upgrade API quota

### Issue: Large Notes Timeout

**Problem**: Very large notes cause API timeout

**Workaround**:
- Content is already limited to 2000 characters
- If still timing out, reduce note content further

### Issue: Unicode Characters in Tags

**Problem**: Tags with special characters not applied correctly

**Workaround**:
- Use ASCII-compatible tag names
- Avoid special characters in tags

---

## Validation Tests

### Quick Validation Test

Run this quick test to verify basic functionality:

1. Create 3 test notes in `test-notes/` directory
2. Configure Auto Tagger with default settings
3. Start auto-tagging
4. Verify:
   - [ ] Processing completes
   - [ ] Tags are applied
   - [ ] Log file is created
   - [ ] Summary is displayed
   - [ ] No console errors

### Component Tests

Test each component individually:

1. **NoteSelector**: Verify note filtering works
2. **AutoTagger**: Verify batch processing works
3. **Logger**: Verify log file creation works
4. **UI**: Verify all buttons and inputs work

---

## Conclusion

This debugging guide should help you identify and resolve most issues with the Auto Tagger feature. If you encounter issues not covered here, enable debug logging and check the console for detailed error messages.
