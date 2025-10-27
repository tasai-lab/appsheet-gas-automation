# ストリーミング問題の診断レポート

**日時**: 2025-10-27 18:40 JST
**問題**: Backend側で生成されたSSEチャンクがFrontendに届かない
**症状**: `totalChunks: 0`（Frontend）vs `Chunks: 3, Total chars: 387`（Backend）

---

## 📊 問題の詳細

### Backend側のログ（正常動作）
```
18:17:35.918 - 📡 Calling Gemini API with streaming...
18:17:41.545 - ✅ Gemini streaming completed - Chunks: 3, Total chars: 387
18:17:41.546 - 📊 Sending completion event - Total: 6137.23ms
```

### Frontend側のログ（異常動作）
```
[API] streamChatMessage 開始 { hasToken: true }
[API] Authorization header added
[API] Response status: 200 OK
[API] ストリーム読み込み開始
[API] ストリーム完了 {totalChunks: 0}  ❌
[API] Reader released
```

### タイムライン分析
1. `18:17:35.559` - HTTP 200 OK 返却 ← **SSE接続確立**
2. `18:17:35.633` - Hybrid Search開始
3. `18:17:35.918` - Gemini API呼び出し
4. `18:17:41.545` - Gemini完了（3チャンク生成）
5. `18:17:41.703` - Firestore保存

**重要**: HTTP 200 OKは実際の処理開始前に返されています。これはEventSourceResponseの正常な動作です。

---

## 🔍 根本原因の候補

### 可能性1: Cloud Run バッファリング問題
Cloud Runがレスポンスをバッファリングし、ストリームが即座に送信されていない可能性。

**証拠**:
- Backendログには "Gemini streaming completed" が表示
- Frontendは即座に `done=true` を受信（チャンクを受信せず）

**対策**:
- `X-Accel-Buffering: no` ヘッダーを追加
- ストリーミングレスポンスの明示的なフラッシュ

### 可能性2: EventSourceResponse実装問題
FastAPIの `EventSourceResponse` が async generator を正しく処理していない可能性。

**証拠**:
- Backend側でyieldは実行されている（ログ確認済み）
- しかし、Frontend側は何も受信していない

**対策**:
- EventSourceResponseの代わりにStreamingResponseを使用
- 手動でSSEフォーマットを生成

### 可能性3: CORS / プリフライト問題
CORSプリフライトがストリーミングを妨げている可能性。

**証拠**:
- Frontend側は200 OKを受信
- しかし、その後のストリームが受信できない

**対策**:
- CORS設定の見直し
- `Access-Control-Allow-Headers` にストリーミング関連ヘッダーを追加

### 可能性4: RAG検索エラーによる early return
Spreadsheet権限エラーによりRAG検索が失敗し、event_generatorが early return している可能性。

**証拠**:
- ログに `HttpError 403: "The caller does not have permission"` が表示
- しかし、その後 Gemini APIは正常に動作

**対策**:
- Spreadsheet権限を付与
- エラーハンドリングの改善（エラー時もyieldを継続）

---

## 🧪 診断手順

### ステップ1: スプレッドシート権限の確認
```bash
# スプレッドシートに以下のサービスアカウントを共有
411046620715-compute@developer.gserviceaccount.com

# 権限レベル: 編集者
```

### ステップ2: Backend詳細デバッグログの追加
`backend/app/routers/chat.py` の `event_generator()` 内にデバッグログを追加：

```python
async def event_generator():
    accumulated_response = ""
    context_ids = []
    suggested_terms = []

    try:
        logger.info("🔵 Event generator started")

        # ステータス: 検索開始
        search_start_time = time.time()
        logger.info("🟢 Yielding search status...")
        yield {
            "event": "message",
            "data": json.dumps(StreamChunk(
                type="status",
                status="searching",
                metadata={"message": "情報を検索中..."}
            ).model_dump())
        }
        logger.info("✅ Search status yielded")

        # ... 以下同様に各yield前後にログを追加
```

### ステップ3: SSE送信の明示的なフラッシュ
Cloud Runでバッファリングを無効化するため、レスポンスヘッダーを追加：

```python
@router.post("/stream", ...)
async def chat_stream(...):
    # ... existing code ...

    response = EventSourceResponse(event_generator())
    response.headers["X-Accel-Buffering"] = "no"  # Nginxバッファリング無効化
    response.headers["Cache-Control"] = "no-cache"
    return response
```

### ステップ4: EventSourceResponse → StreamingResponse 移行
EventSourceResponseに問題がある場合、StreamingResponseで手動SSEフォーマットを実装：

```python
from fastapi.responses import StreamingResponse

async def sse_generator():
    async for chunk_dict in event_generator():
        event = chunk_dict.get("event", "message")
        data = chunk_dict.get("data", "")

        # SSEフォーマット: event: xxx\ndata: xxx\n\n
        sse_message = f"event: {event}\ndata: {data}\n\n"
        yield sse_message.encode("utf-8")

        # 明示的なフラッシュ（バッファリング防止）
        await asyncio.sleep(0)  # イベントループに制御を戻す

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

### ステップ5: Frontend側のデバッグログ強化
`frontend/src/lib/api.ts` にrawデータのログを追加：

```typescript
buffer += decoder.decode(value, { stream: true });
console.log("[API] Raw buffer received:", buffer.length, "bytes");
console.log("[API] Raw buffer content:", buffer.substring(0, 200));  // 最初の200文字
```

---

## 📋 次の行動計画

### 即座に実施（手動）
1. ✅ Spreadsheetに サービスアカウント `411046620715-compute@developer.gserviceaccount.com` を共有
   - URL: https://docs.google.com/spreadsheets/d/1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA/edit
   - 権限: 編集者

### コード修正（推奨順）
1. **chat.py: デバッグログ追加** - 各yield前後にログを追加し、どこでストリームが停止しているかを特定
2. **chat.py: バッファリング無効化ヘッダー追加** - `X-Accel-Buffering: no` を追加
3. **api.ts: rawバッファデバッグログ追加** - 実際に何バイト受信しているかを確認
4. **chat.py: EventSourceResponse → StreamingResponse移行** - 最後の手段として実装

### テスト手順
1. スプレッドシート権限付与後、Backendを再起動せずテスト
2. ブラウザのキャッシュをクリア
3. ブラウザコンソールでrawバッファのログを確認
4. Cloud Runログで各yieldのログを確認
5. 両方のログを比較し、どこでギャップが発生しているかを特定

---

## 🎯 期待される結果

### 修正後のFrontend

ログ
```
[API] streamChatMessage 開始 { hasToken: true }
[API] Authorization header added
[API] Response status: 200 OK
[API] ストリーム読み込み開始
[API] Raw buffer received: 150 bytes
[API] Chunk #1: status searching
[API] Raw buffer received: 320 bytes
[API] Chunk #2: status reranking
[API] Raw buffer received: 500 bytes
[API] Chunk #3: context
[API] Raw buffer received: 650 bytes
[API] Chunk #4: status generating
[API] Raw buffer received: 750 bytes
[API] Chunk #5: text
[API] ストリーム完了 {totalChunks: 5+}  ✅
```

### 修正後のBackendログ
```
🔵 Event generator started
🟢 Yielding search status...
✅ Search status yielded
🟢 Yielding reranking status...
✅ Reranking status yielded
🟢 Yielding context...
✅ Context yielded
🟢 Yielding text chunk...
✅ Text chunk yielded
✅ Gemini streaming completed - Chunks: 3, Total chars: 387
```

---

## 📖 関連ドキュメント

- [Server-Sent Events (SSE) 仕様](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [FastAPI EventSourceResponse](https://github.com/sysid/sse-starlette)
- [Cloud Run ストリーミングレスポンス](https://cloud.google.com/run/docs/triggering/websockets)
- [CORS設定ベストプラクティス](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

**作成者**: Claude Code
**最終更新**: 2025-10-27 18:40 JST
