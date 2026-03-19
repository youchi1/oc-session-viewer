#!/bin/bash
# Test runner for Session Viewer

URL="http://localhost:8095"
SESSION="session-viewer-test"

echo "🧪 OpenClaw Session Viewer - Automated Test Suite"
echo "=================================================="
echo ""

# Test 1: Initial Load
echo "Test 1: Initial Load"
agent-browser --session $SESSION open "$URL"
sleep 2
agent-browser --session $SESSION snapshot > /tmp/test1-snapshot.txt
if grep -q "OpenClaw" /tmp/test1-snapshot.txt; then
  echo "  ✅ Page loaded"
else
  echo "  ❌ Page failed to load"
fi

# Test 2: Check if sessions are visible
echo ""
echo "Test 2: Session List Visible"
if grep -q "session" /tmp/test1-snapshot.txt || grep -q "ago" /tmp/test1-snapshot.txt; then
  echo "  ✅ Sessions visible"
else
  echo "  ❌ No sessions visible"
fi

# Test 3: Check sorting dropdown
echo ""
echo "Test 3: Check Sorting Options"
if grep -q "Latest First\|Oldest First" /tmp/test1-snapshot.txt; then
  echo "  ✅ Sort dropdown found"
else
  echo "  ❌ Sort dropdown not found"
fi

# Test 4: Try to click first session
echo ""
echo "Test 4: Click First Session"
agent-browser --session $SESSION act click "button" 2>/dev/null
sleep 2
agent-browser --session $SESSION snapshot > /tmp/test4-snapshot.txt
# Check if transcript viewer opened (should contain "Close transcript" or similar)
if grep -q "Close\|transcript\|Type filter" /tmp/test4-snapshot.txt; then
  echo "  ✅ Transcript viewer opened"
else
  echo "  ❌ Transcript viewer did not open (black screen?)"
  echo "  Debug: Checking for errors..."
  agent-browser --session $SESSION console error 2>/dev/null | tail -5
fi

# Test 5: Check URL for session ID
echo ""
echo "Test 5: URL Routing"
CURRENT_URL=$(agent-browser --session $SESSION exec "return window.location.href" 2>/dev/null)
if [[ "$CURRENT_URL" == *"session"* ]] || [[ "$CURRENT_URL" == *"agent"* ]]; then
  echo "  ✅ URL contains session/agent identifier"
else
  echo "  ❌ URL not updated (routing missing)"
  echo "  Current URL: $CURRENT_URL"
fi

# Test 6: Check sorting by changing dropdown
echo ""
echo "Test 6: Test Sorting (Oldest First)"
agent-browser --session $SESSION open "$URL"
sleep 2
agent-browser --session $SESSION act click "Oldest First" 2>/dev/null || echo "  ⚠️ Could not click 'Oldest First'"
sleep 1
agent-browser --session $SESSION snapshot > /tmp/test6-snapshot.txt
echo "  Check snapshot manually for date order"

# Test 7: Browser console errors
echo ""
echo "Test 7: JavaScript Console Errors"
agent-browser --session $SESSION console error 2>/dev/null | tail -10 > /tmp/console-errors.txt
if [ -s /tmp/console-errors.txt ]; then
  echo "  ⚠️ Console errors found:"
  cat /tmp/console-errors.txt
else
  echo "  ✅ No console errors"
fi

echo ""
echo "=================================================="
echo "Test suite complete. Check output above."
echo ""
echo "Manual checks needed:"
echo "1. Open $URL in browser"
echo "2. Verify sorting shows TODAY's sessions first"
echo "3. Click a session and verify transcript loads"
echo "4. Check if URL updates with session ID"
