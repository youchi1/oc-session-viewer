# OpenClaw Session Viewer - Test Plan

## Test Environment
- URL: http://localhost:8095
- Tool: agent-browser CLI
- Date: 2026-03-05

## Test Cases

### 1. Initial Load
- [ ] Page loads without errors
- [ ] Sidebar visible with 14 agents
- [ ] Agent emojis displayed correctly
- [ ] Global stats show correct numbers
- [ ] Session list loads with default filters

### 2. Sidebar Navigation
- [ ] "All Agents" shows all sessions
- [ ] Clicking individual agent filters to that agent
- [ ] Session counts match in sidebar vs. list
- [ ] Sidebar can be collapsed/expanded

### 3. Filtering & Search
- [ ] Status filter: Active (default)
- [ ] Status filter: All
- [ ] Status filter: Deleted
- [ ] Status filter: Reset
- [ ] Search by session ID works
- [ ] Search by message content works

### 4. Sorting (CRITICAL)
- [ ] Latest First (date_desc) - should show TODAY's sessions first
- [ ] Oldest First (date_asc) - should show oldest sessions first
- [ ] Name Z-A
- [ ] Name A-Z
- [ ] Verify actual dates in session list match sort order

### 5. Pagination
- [ ] Page 1 loads correctly
- [ ] Next button works
- [ ] Previous button works
- [ ] Page number displays correctly
- [ ] Can navigate to page 2, 3, etc.

### 6. Session Opening (CRITICAL)
- [ ] Click a session from list
- [ ] Transcript panel opens on right
- [ ] Messages are visible (not black screen)
- [ ] User messages appear (blue, right-aligned)
- [ ] Assistant messages appear (left-aligned)
- [ ] Tool calls are collapsible
- [ ] Thinking blocks are collapsible

### 7. Transcript Viewer
- [ ] Type filters work (All/User/Assistant/Tools/System)
- [ ] Expand All button works
- [ ] Collapse All button works
- [ ] Close button closes transcript
- [ ] Code blocks have syntax highlighting
- [ ] Copy buttons work on code blocks

### 8. URL Routing (CRITICAL - MISSING)
- [ ] Opening session updates URL with session ID
- [ ] Refreshing page with session URL loads that session
- [ ] Back/forward browser buttons work
- [ ] Direct URL access works

### 9. Performance
- [ ] Page loads under 3 seconds
- [ ] Pagination is fast (under 1 second)
- [ ] Transcript loads under 2 seconds
- [ ] No memory leaks on navigation

### 10. Error Handling
- [ ] Invalid agent shows error
- [ ] Invalid session ID shows error
- [ ] Network errors show message
- [ ] Empty results show "No sessions found"

## Priority Issues to Fix
1. ⚠️ CRITICAL: Sorting not working (shows old sessions first)
2. ⚠️ CRITICAL: Opening sessions shows black screen
3. ⚠️ CRITICAL: No URL routing (can't refresh/deep link)
