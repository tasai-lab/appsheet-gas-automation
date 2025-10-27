# 超詳細デバッグ実装レポート - 2025-10-28

**日時**: 2025-10-28 13:00 JST
**対応内容**: SSEストリーミング問題の根本的診断強化
**実施者**: Claude Code
**ステータス**: 実装完了 - ユーザーによるSpreadsheet共有待ち

---

## 🎯 実施した対応

### 1. Backend: 超詳細デバッグログ追加

**ファイル**: `backend/app/routers/chat.py:75-275`

**追加したログポイント**:

| 位置 | ログメッセージ | 目的 |
|------|--------------|------|
| Line 82 | `🔵 [DEBUG] Event generator started` | event_generator関数の開始確認 |
| Line 91-100 | `🟢 [DEBUG] About to yield search status...` <br> `✅ [DEBUG] Search status yielded successfully` | 検索ステータスyield前後 |
| Line 130-142 | `🟢 [DEBUG] About to yield reranking status...` <br> `✅ [DEBUG] Reranking status yielded successfully` | リランキングステータスyield前後 |
| Line 165-173 | `🟢 [DEBUG] About to yield context (N items)...` <br> `✅ [DEBUG] Context yielded successfully` | コンテキストyield前後 |
| Line 177-186 | `🟢 [DEBUG] About to yield generating status...` <br> `✅ [DEBUG] Generating status yielded successfully` | 生成ステータスyield前後 |
| Line 189-211 | `🔵 [DEBUG] Starting Gemini API call...` <br> `🟢 [DEBUG] About to yield text chunk #N (length: X)...` <br> `✅ [DEBUG] Text chunk #N yielded successfully` | 各テキストチャンクyield前後 |
| Line 217-230 | `🟢 [DEBUG] About to yield completion event...` <br> `✅ [DEBUG] Completion event yielded successfully` | 完了イベントyield前後 |

**重要な変更**:
- 各`yield`文の**直前**と**直後**にログを追加
- チャンク数とデータ長を記録
- SSEイベントがBackend側で正しく生成されているかを完全追跡

**コード例**:
```python
logger.info("🟢 [DEBUG] About to yield search status...")
yield {
    "event": "message",
    "data": json.dumps(StreamChunk(
        type="status",
        status="searching",
        metadata={"message": "情報を検索中..."}
    ).model_dump())
}
logger.info("✅ [DEBUG] Search status yielded successfully")
```

---

### 2. Backend: バッファリング無効化ヘッダー追加

**ファイル**: `backend/app/routers/chat.py:271-275`

**変更内容**:
```python
# Before
return EventSourceResponse(event_generator())

# After
response = EventSourceResponse(event_generator())
response.headers["X-Accel-Buffering"] = "no"  # Nginx/Cloud Runバッファリング無効化
response.headers["Cache-Control"] = "no-cache"  # キャッシュ無効化
return response
```

**目的**:
- Cloud Runがレスポンスをバッファリングしてしまい、SSEイベントが遅延・消失する問題を防止
- `X-Accel-Buffering: no` は Nginx/Cloud Run のバッファリングを明示的に無効化
- `Cache-Control: no-cache` はプロキシやCDNによるキャッシュを防止

---

### 3. Frontend: rawバッファデバッグログ追加

**ファイル**: `frontend/src/lib/api.ts:110-116`

**追加したログ**:
```typescript
buffer += decoder.decode(value, { stream: true });

// [DEBUG] Rawバッファデバッグログ
console.log(`[API] [DEBUG] Raw buffer received: ${buffer.length} bytes`);
if (buffer.length > 0) {
  console.log(`[API] [DEBUG] Raw buffer content (first 300 chars):`, buffer.substring(0, 300));
}
```

**目的**:
- SSEストリームがFrontendに実際に到達しているかを確認
- バッファサイズと生データを可視化
- SSEメッセージパース前の生データをデバッグ

---

### 4. Cloud Run デプロイ

**コマンド実行**:
```bash
# 1. Artifact Registryにビルド
gcloud builds submit --tag us-central1-docker.pkg.dev/fractal-ecosystem/rag-backend/rag-backend:debug .

# 2. Cloud Runにデプロイ
gcloud run deploy rag-backend \
  --image us-central1-docker.pkg.dev/fractal-ecosystem/rag-backend/rag-backend:debug \
  --region us-central1 \
  --project fractal-ecosystem \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "VECTOR_DB_SPREADSHEET_ID=1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA,VERTEX_AI_ENABLE_THINKING=False,REQUIRE_AUTHENTICATION=True,USE_FIRESTORE_CHAT_HISTORY=True"
```

**デプロイ結果**:
- ✅ Revision: `rag-backend-00010-qmk`
- ✅ Service URL: `https://rag-backend-411046620715.us-central1.run.app`
- ✅ 環境変数: 正しく設定済み
- ✅ デプロイ時刻: 2025-10-28 13:15 JST

---

### 5. Frontend デプロイ

**コマンド実行**:
```bash
cd ../frontend
npm run build
firebase deploy --only hosting
```

**デプロイ結果**:
- ✅ Hosting URL: `https://fractal-ecosystem.web.app`
- ✅ ファイル数: 36 files
- ✅ デプロイ時刻: 2025-10-28 13:18 JST

---

## 📋 次に必要なアクション（ユーザー側）

### 🚨 **最重要**: Spreadsheet権限共有

**作業内容**: ベクトルDBスプレッドシートをCloud Runサービスアカウントと共有

**詳細手順**: `docs/SPREADSHEET_SHARING_GUIDE_2025-10-28.md` を参照

**クイックガイド**:

1. https://docs.google.com/spreadsheets/d/1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA/edit を開く

2. 右上の「共有」ボタンをクリック

3. 以下のメールアドレスを追加（編集者権限）:
   ```
   411046620715-compute@developer.gserviceaccount.com
   ```

4. 「送信」または「完了」ボタンをクリック

**所要時間**: 1分

**この作業が必要な理由**:

現在、Cloud Runは以下のエラーを出しています:
```
HttpError 403: "The caller does not have permission"
requesting spreadsheets/1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA/values/MedicalTerms
```

IAMロール（`roles/sheets.developer`）は付与済みですが、**特定のスプレッドシートファイルへのアクセス権限が必要**です。

---

## 🔍 期待される診断結果

### Spreadsheet共有前（現状）

**Backend Cloud Runログ（予想）**:
```
🔵 [DEBUG] Event generator started
🟢 [DEBUG] About to yield search status...
✅ [DEBUG] Search status yielded successfully
HttpError 403: "The caller does not have permission"
  requesting spreadsheets/.../values/MedicalTerms
[ERROR] Stream error: HttpError 403...
```

**Frontend Console（予想）**:
```
[API] streamChatMessage 開始 { hasToken: true }
[API] Authorization header added
[API] Response status: 200 OK
[API] ストリーム読み込み開始
[API] [DEBUG] Raw buffer received: 0 bytes  ← ❌ バッファ空
[API] ストリーム完了 {totalChunks: 0}  ← ❌ チャンク0
```

---

### Spreadsheet共有後（期待される結果）

**Backend Cloud Runログ**:
```
🔵 [DEBUG] Event generator started
🟢 [DEBUG] About to yield search status...
✅ [DEBUG] Search status yielded successfully
🟢 [DEBUG] About to yield reranking status...
✅ [DEBUG] Reranking status yielded successfully
🟢 [DEBUG] About to yield context (5 items)...
✅ [DEBUG] Context yielded successfully
🟢 [DEBUG] About to yield generating status...
✅ [DEBUG] Generating status yielded successfully
🔵 [DEBUG] Starting Gemini API call for response generation (streaming with history)...
🟢 [DEBUG] About to yield text chunk #1 (length: 127)...
✅ [DEBUG] Text chunk #1 yielded successfully
🟢 [DEBUG] About to yield text chunk #2 (length: 143)...
✅ [DEBUG] Text chunk #2 yielded successfully
🟢 [DEBUG] About to yield text chunk #3 (length: 117)...
✅ [DEBUG] Text chunk #3 yielded successfully
✅ [DEBUG] Gemini response completed - Total chunks: 3, Total length: 387 chars
🟢 [DEBUG] About to yield completion event - Total: 6137.23ms, Search: 1500ms, Generation: 4600ms
✅ [DEBUG] Completion event yielded successfully
```

**Frontend Console**:
```
[API] streamChatMessage 開始 { hasToken: true }
[API] Authorization header added
[API] Response status: 200 OK
[API] ストリーム読み込み開始
[API] [DEBUG] Raw buffer received: 150 bytes
[API] [DEBUG] Raw buffer content (first 300 chars): event: message
data: {"type":"status","status":"searching",...
[API] Chunk #1: status searching
[API] [DEBUG] Raw buffer received: 320 bytes
[API] Chunk #2: status reranking
[API] [DEBUG] Raw buffer received: 850 bytes
[API] Chunk #3: context
[API] [DEBUG] Raw buffer received: 1050 bytes
[API] Chunk #4: status generating
[API] [DEBUG] Raw buffer received: 1200 bytes
[API] Chunk #5: text
[API] [DEBUG] Raw buffer received: 1350 bytes
[API] Chunk #6: text
[API] [DEBUG] Raw buffer received: 1480 bytes
[API] Chunk #7: text
[API] [DEBUG] Raw buffer received: 1650 bytes
[API] Chunk #8: done
[API] ストリーム完了 {totalChunks: 8}  ← ✅ チャンク正常受信
[API] Reader released
```

---

## 📊 実装の技術的背景

### 問題の本質

**これまでの状況**:
- Backend: Geminiレスポンス生成成功（387文字、3チャンク）
- Frontend: totalChunks: 0（何も受信していない）

**仮説**:
1. **Cloud Run バッファリング** → `X-Accel-Buffering: no` で対応
2. **SSE yield実行確認不足** → 各yield前後にログ追加
3. **Frontend受信データ不明** → rawバッファログ追加
4. **Spreadsheet 403エラー** → ファイル権限共有が必要

### SSEストリーミングの仕組み

```
Backend (chat.py)                Cloud Run              Frontend (api.ts)
─────────────────                ─────────              ─────────────────
event_generator():
  yield status      ─────►  バッファリング?  ─────►  reader.read()
  yield context     ─────►  (X-Accel-Buffering    buffer += decode()
  yield text        ─────►   = no で無効化)   ─────►  SSEパース
  yield done        ─────►                    ─────►  チャンク処理
```

**追加したデバッグポイント**:
```
Backend                                  Frontend
───────────────────────────────────────────────────────────────
🔵 Event generator started
🟢 About to yield...    ───────►
✅ ...yielded           ───────►  [DEBUG] Raw buffer: N bytes
                                  [DEBUG] Content: ...
                                  Chunk #1: ...
```

---

## 🎓 学んだ教訓

### 1. Cloud Runでのストリーミング配信

**教訓**: Cloud Runはデフォルトでレスポンスをバッファリングするため、SSE配信時には明示的に無効化する必要がある

**対策**:
```python
response.headers["X-Accel-Buffering"] = "no"
response.headers["Cache-Control"] = "no-cache"
```

### 2. Async Generator のデバッグ

**教訓**: `async for ... yield` のデバッグは通常のログでは追いにくい。各yield前後にログを追加することで完全な追跡が可能。

**ベストプラクティス**:
```python
logger.info("🟢 [DEBUG] About to yield...")
yield data
logger.info("✅ [DEBUG] ...yielded successfully")
```

### 3. Google Sheets権限の2層構造

**教訓**: IAMロールとファイル共有は別物。両方が必要。

| レベル | 権限 | 付与方法 | 目的 |
|--------|------|---------|------|
| GCPプロジェクト | roles/sheets.developer | `gcloud projects add-iam-policy-binding` | Sheets API呼び出し許可 |
| スプレッドシート | 編集者 | Google Sheets UI「共有」ボタン | 特定ファイルへのアクセス許可 |

### 4. Frontend SSEデバッグの重要性

**教訓**: Frontendの`reader.read()`が何バイト受信しているかをログ出力することで、問題がBackend→Frontend間の通信なのか、Frontend側のパースなのかを特定できる。

**追加したログ**:
```typescript
console.log(`[API] [DEBUG] Raw buffer received: ${buffer.length} bytes`);
console.log(`[API] [DEBUG] Raw buffer content (first 300 chars):`, buffer.substring(0, 300));
```

---

## 📈 次のステップ（ユーザー実施後）

### 1. Spreadsheet共有完了確認

```bash
# Cloud Runログで403エラーが消えたことを確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=rag-backend" \
  --project=fractal-ecosystem \
  --limit=50 \
  --format="table(timestamp, textPayload)" \
  --freshness=10m | grep -E "(403|Permission)"
```

**期待される結果**: 403エラーが表示されない

### 2. E2Eテスト実施

1. https://fractal-ecosystem.web.app にアクセス
2. Googleアカウントでログイン
3. 任意のチャットメッセージを送信（例: "利用者CL-00001について教えて"）
4. ブラウザコンソールで以下を確認:
   - `[API] [DEBUG] Raw buffer received: N bytes` （N > 0）
   - `[API] Chunk #1: ...`、`[API] Chunk #2: ...` （複数チャンク）
   - `[API] ストリーム完了 {totalChunks: X}` （X > 0）
5. チャット画面に回答が表示されることを確認

### 3. Cloud Runログ確認

```bash
# 詳細デバッグログの確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=rag-backend" \
  --project=fractal-ecosystem \
  --limit=100 \
  --format="table(timestamp, textPayload)" \
  --freshness=5m | grep -E "(DEBUG|Chunk|yield)"
```

**期待される結果**: 各yieldの前後ログが表示される

---

## 🔗 関連ドキュメント

- [SPREADSHEET_SHARING_GUIDE_2025-10-28.md](./SPREADSHEET_SHARING_GUIDE_2025-10-28.md) - Spreadsheet共有手順
- [PRODUCTION_ISSUES_ROOT_CAUSE_ANALYSIS_2025-10-27.md](./PRODUCTION_ISSUES_ROOT_CAUSE_ANALYSIS_2025-10-27.md) - 過去の問題分析
- [STREAMING_ISSUE_DIAGNOSIS_2025-10-27.md](./STREAMING_ISSUE_DIAGNOSIS_2025-10-27.md) - ストリーミング問題診断

---

## 📞 トラブルシューティング

### Spreadsheet共有後も403エラーが出る場合

**対処法1**: Cloud Runを再起動
```bash
gcloud run services update rag-backend \
  --region=us-central1 \
  --project=fractal-ecosystem \
  --set-env-vars="FORCE_RESTART=$(date +%s)"
```

**対処法2**: サービスアカウントメールアドレスを再確認
```bash
# サービスアカウント一覧表示
gcloud iam service-accounts list --project=fractal-ecosystem | grep compute

# 期待される出力:
# 411046620715-compute@developer.gserviceaccount.com
```

### Frontendでtotal Chunks: 0が続く場合

**対処法1**: ブラウザキャッシュクリア
- Chrome: Cmd+Shift+Delete → 「キャッシュされた画像とファイル」をクリア

**対処法2**: Frontend rawバッファログを確認
- ブラウザコンソールで `[API] [DEBUG] Raw buffer` を検索
- バッファサイズが0バイトの場合 → Backend→Frontend間の通信問題
- バッファサイズが>0だがチャンクパースできない場合 → SSEフォーマット問題

---

**作成者**: Claude Code
**最終更新**: 2025-10-28 13:20 JST
**ステータス**: 実装完了 - Spreadsheet共有待ち
