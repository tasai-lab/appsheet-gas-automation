# SSE Parser Bug Diagnosis Report

**Date**: 2025-10-28
**Status**: Investigation in Progress
**Severity**: Critical - Frontend receives data but parses 0 chunks

---

## 🔴 Critical Issue Discovered

### Problem Statement
**Frontend receives 60KB of SSE data from backend, but parses 0 chunks**

**User-reported symptoms:**
```
[API] [DEBUG] Raw buffer received: 60924 bytes
[API] ストリーム完了 {totalChunks: 0}
```

**Backend logs show successful streaming:**
```
18:47:44 - ✅ [DEBUG] Text chunk #12 yielded successfully
18:47:44 - ✅ [DEBUG] Completion event yielded successfully
```

---

## ✅ What's Working

### Backend (Confirmed)
1. **Spreadsheet access**: ✅ Fixed (3,194 records loaded, no 403 errors)
2. **Event generator**: ✅ All 14 debug log points show successful yields
3. **SSE streaming**: ✅ Backend yields all events:
   - Search status
   - Reranking status
   - Generating status
   - Text chunks #1-12
   - Completion event
4. **Anti-buffering headers**: ✅ `X-Accel-Buffering: no`, `Cache-Control: no-cache`

### Timing (18:46-18:47 JST)
- **Total**: 58 seconds
- **Search**: 36 seconds
- **Generation**: 12 seconds

---

## ⚠️ Discovery Engine Reranker Issue (Minor)

**Error**:
```
403 Permission 'discoveryengine.rankingConfigs.rank' denied on resource
'//discoveryengine.googleapis.com/projects/fractal-ecosystem/locations/us-central1/rankingConfigs/default_ranking_config'
```

**Impact**: Low - System gracefully falls back to original document order

**Fix Applied**:
```bash
gcloud projects add-iam-policy-binding fractal-ecosystem \
  --member="serviceAccount:411046620715-compute@developer.gserviceaccount.com" \
  --role="roles/discoveryengine.admin" \
  --condition=None
```

**Status**: ✅ Permission granted

---

## 🔍 Root Cause Hypothesis

### Observation
Frontend logs show:
1. Buffer is growing (11KB → 60KB)
2. First 300 chars always show the same "searching" status
3. `buffer.split("\n\n")` returns only 1 message (which gets popped back)
4. No chunks are yielded

### Possible Causes

#### 1. SSE Message Separator Issue (Most Likely)
**Hypothesis**: SSE messages are not properly terminated with `\n\n`

**Evidence**:
- Buffer accumulates to 60KB
- `split("\n\n")` produces minimal results
- Raw buffer shows correct JSON structure

**Potential Root Cause**:
- EventSourceResponse in sse-starlette may not be sending proper SSE format
- Cloud Run may be stripping line endings
- Unicode encoding issues (`\u60c5\u5831` visible in buffer)

#### 2. Timing/Race Condition (Less Likely)
**Hypothesis**: Frontend parser runs before all data is buffered

**Evidence**:
- Multiple buffer dumps all show same content
- Parser may be processing incomplete messages

#### 3. Line Ending Mismatch (Possible)
**Hypothesis**: \r\n vs \n inconsistency

**Evidence**:
- SSE spec requires `\r\n` or `\n`
- Browser/HTTP layer may normalize differently than expected

---

## 🧪 Enhanced Debugging (Deployed)

### Frontend Changes (api.ts:110-156)

**Added detailed logging**:
```typescript
console.log(`[API] [DEBUG] Split into ${messages.length} messages (before pop)`);
console.log(`[API] [DEBUG] Remaining buffer after pop: ${buffer.length} bytes`);
console.log(`[API] [DEBUG] Processing message #${i} (length: ${message.length})`);
console.log(`[API] [DEBUG] Message content:`, message.substring(0, 200));
console.warn(`[API] [DEBUG] Message #${i} has no data field`);
```

**Expected output (if working)**:
```
[API] [DEBUG] Raw buffer received: 500 bytes
[API] [DEBUG] Split into 3 messages (before pop)
[API] [DEBUG] Remaining buffer after pop: 150 bytes
[API] [DEBUG] Processing message #0 (length: 200)
[API] [DEBUG] Message content: event: message\ndata: {"type":"status",...}
[API] Chunk #1: status searching
```

**Expected output (if broken)**:
```
[API] [DEBUG] Raw buffer received: 60924 bytes
[API] [DEBUG] Split into 1 messages (before pop)
[API] [DEBUG] Remaining buffer after pop: 60924 bytes
```

### Backend Debug Logs (Already Active)
- Lines: backend/app/routers/chat.py:82-230
- All yields logged with emoji markers:
  - 🔵 Event generator started
  - 🟢 About to yield...
  - ✅ Yielded successfully

---

## 📋 Next Steps

### Immediate
1. **User testing required**: Visit https://fractal-ecosystem.web.app and send a chat message
2. **Check browser console**: Look for new `[API] [DEBUG]` logs showing split results
3. **Verify**:
   - How many messages does `split("\n\n")` produce?
   - What does the remaining buffer contain?
   - Are messages properly formatted?

### If split produces 1 message (buffer not splitting):

**Option A**: Check SSE formatting
```python
# Verify sse-starlette output format
# Expected: "event: message\ndata: {...}\n\n"
# Actual: May be missing trailing \n\n
```

**Option B**: Try manual SSE formatting
```python
from fastapi.responses import StreamingResponse

async def sse_generator():
    async for chunk_dict in event_generator():
        event = chunk_dict.get("event", "message")
        data = chunk_dict.get("data", "")
        sse_message = f"event: {event}\ndata: {data}\n\n"
        yield sse_message.encode("utf-8")
        await asyncio.sleep(0)  # Flush

return StreamingResponse(
    sse_generator(),
    media_type="text/event-stream",
    headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    }
)
```

### If split produces many messages:

**Check**: Do messages have proper `event:` and `data:` fields?

**Fix**: Frontend parsing logic

---

## 📊 Complete Verification Timeline

### Phase 1: Infrastructure ✅
- [x] Spreadsheet permissions granted (no more 403)
- [x] Discovery Engine permissions granted
- [x] Backend debug logging deployed
- [x] Frontend debug logging deployed

### Phase 2: SSE Flow Investigation (IN PROGRESS)
- [ ] User tests production system
- [ ] Analyze enhanced debug logs
- [ ] Identify exact SSE format issue
- [ ] Implement fix

### Phase 3: Verification ⏳
- [ ] Frontend receives and parses all chunks
- [ ] Chat responses display correctly
- [ ] System performance acceptable (<10s response)

---

## 🔗 Related Documents

- [STREAMING_ISSUE_DIAGNOSIS_2025-10-27.md](./STREAMING_ISSUE_DIAGNOSIS_2025-10-27.md) - Initial diagnosis
- [DEBUG_IMPLEMENTATION_2025-10-28.md](./DEBUG_IMPLEMENTATION_2025-10-28.md) - Debug logging implementation
- [SPREADSHEET_SHARING_GUIDE_2025-10-28.md](./SPREADSHEET_SHARING_GUIDE_2025-10-28.md) - Spreadsheet permissions

---

## 📞 Action Required

**USER: Please test the updated system and provide the following:**

1. **Browser console logs** (complete output, especially `[API] [DEBUG]` lines)
2. **Screenshot** of any errors or unexpected behavior
3. **Confirm**:
   - Did you see any chat response text?
   - Did the status messages ("情報を検索中...") appear?

**URL**: https://fractal-ecosystem.web.app

---

**Created**: 2025-10-28
**Last Updated**: 2025-10-28
**Next Review**: After user provides enhanced debug logs
