# デプロイメント記録 - Phase 4.3 & 4.4

**日付**: 2025-10-27
**バージョン**: 1.0.0-beta
**担当**: Fractal Group 開発チーム

---

## Phase 4.3: SSE Streaming対応 ✅

### 実装内容

#### Backend改善
- ✅ Status streaming実装（searching/reranking/generating）
- ✅ 各処理フェーズの時間計測とメタデータ送信
- ✅ `/search`エンドポイント削除（チャットのみに集中）
- ✅ Vertex AI APIタイムアウト対応（コンテキストベースの一時レスポンス）

**変更ファイル:**
- `backend/app/models/response.py` - status/metadata フィールド追加
- `backend/app/routers/chat.py` - リアルタイムステータスストリーミング実装
- `backend/app/services/gemini_service.py` - タイムアウト対応

#### Frontend改善
- ✅ リアルタイムステータス表示（3段階プログレス）
- ✅ 経過時間表示（100ms更新）
- ✅ 新規チャットモーダル実装
- ✅ 利用者選択・固定機能
- ✅ ClientsContextでグローバル状態管理
- ✅ Markdown表示改善（react-markdown v9対応）
- ✅ 参照元表示の最適化

**変更ファイル:**
- `frontend/src/types/chat.ts` - StreamChunk型拡張
- `frontend/src/components/ChatContainer.tsx` - ステータス表示UI実装
- `frontend/src/components/NewChatModal.tsx` - 新規作成
- `frontend/src/contexts/ClientsContext.tsx` - 新規作成

#### スクリプト・ドキュメント
- ✅ ベクトル化スクリプト改善（data_sources.json更新）
- ✅ テストスクリプト追加（精度評価、パフォーマンステスト、E2Eテスト）
- ✅ API最適化ドキュメント追加

**コミット:**
```
feat(RAG Phase 4.3): リアルタイムステータス表示・利用者選択・Vertex AI対応
```

---

## Phase 4.4: Vercel 本番デプロイ ✅

### デプロイ情報

**Frontend URL**: https://frontend-ifi7yz3to-asais-projects-00125c26.vercel.app
**Backend URL**: https://rag-backend-411046620715.asia-northeast1.run.app
**リージョン**: 東京 (hnd1)

### 実行手順

#### 1. Vercel CLI インストール
```bash
npm install -g vercel
```

#### 2. 環境変数設定
```bash
echo "https://rag-backend-411046620715.asia-northeast1.run.app" | \
  vercel env add NEXT_PUBLIC_API_URL production
```

#### 3. 本番デプロイ
```bash
cd rag_system/frontend
vercel --prod --yes
```

#### 4. デプロイ検証
- ✅ ビルド成功: Next.js 14.2.23
- ✅ 環境変数反映確認
- ✅ SSE Streaming動作確認
- ✅ 利用者選択機能確認
- ✅ ステータス表示確認

### 修正内容

**型エラー修正:**
- `frontend/src/components/Sidebar.tsx` - testタブ削除、型定義修正

**コミット:**
```
fix(frontend): Sidebar型エラー修正・Vercelデプロイ対応
```

---

## デプロイ構成

### Backend (Cloud Run)
- **サービス名**: rag-backend
- **リージョン**: asia-northeast1
- **URL**: https://rag-backend-411046620715.asia-northeast1.run.app
- **CPU**: 2 vCPU
- **メモリ**: 2GB
- **最大インスタンス**: 10
- **ステータス**: ✅ 稼働中

### Frontend (Vercel)
- **プロジェクト**: frontend
- **URL**: https://frontend-ifi7yz3to-asais-projects-00125c26.vercel.app
- **リージョン**: Tokyo (hnd1)
- **Framework**: Next.js 14.2.23
- **Node.js**: 20.x
- **ステータス**: ✅ 稼働中

### Vector DB (Google Spreadsheet)
- **スプレッドシートID**: 1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA
- **データ件数**: 約13,500件
- **ステータス**: ✅ 同期中

---

## 実装済み機能

### チャット機能
- [x] SSE (Server-Sent Events) ストリーミング
- [x] リアルタイムステータス表示（3段階）
  - 検索中 (Searching)
  - リランキング中 (Reranking)
  - 生成中 (Generating)
- [x] 経過時間表示（100ms更新）
- [x] 中止ボタン
- [x] Markdown表示（react-markdown v9）
- [x] 参照元表示（コンテキスト）

### 利用者管理
- [x] 利用者一覧取得 (`/clients`)
- [x] 新規チャット作成モーダル
- [x] 利用者選択・固定機能
- [x] ClientsContextでグローバル状態管理

### UI/UX
- [x] ダークモード対応
- [x] レスポンシブデザイン
- [x] サイドバー（チャット履歴）
- [x] チャット入力エリア
- [x] メッセージ表示（ユーザー/AI）

---

## 技術スタック

### Backend
- Python 3.13
- FastAPI
- Vertex AI (Gemini 2.5 Flash/Pro)
- Vertex AI Ranking API (semantic-ranker-default-004)
- Google Sheets API

### Frontend
- Next.js 14.2.23 (App Router)
- React 18.3.1
- TypeScript 5
- Tailwind CSS 3.4.17
- react-markdown 10.1.0

### Infrastructure
- Cloud Run (Backend)
- Vercel (Frontend)
- Google Spreadsheet (Vector DB)

---

## パフォーマンス指標

### 応答時間（実測）
- 検索フェーズ: 約3-5秒
- リランキングフェーズ: 約0.5-1秒
- 生成フェーズ: 約2-4秒
- **合計**: 約5.5-10秒

### 精度指標（目標）
- NDCG@5: 0.75以上（未測定）
- 医療用語適合率: 90%以上（未測定）

---

## 既知の問題

### Vertex AI API タイムアウト
**症状**: ローカル環境からのVertex AI API呼び出しが時々タイムアウト
**対策**: コンテキストベースのフォールバックレスポンスを実装
**ステータス**: ⚠️ 監視中（本番環境では安定）

### 検索精度未評価
**症状**: NDCG@10やRecall@10の精度評価が未実施
**対策**: Phase 5.2で精度評価スクリプトを実行予定
**ステータス**: ⏳ Phase 5.2で対応

---

## 次のステップ

### Phase 5.1: エンドツーエンド統合テスト
- [ ] 本番環境でのE2Eテスト実行
- [ ] ユーザーシナリオテスト
- [ ] パフォーマンステスト

### Phase 5.2: 精度評価
- [ ] NDCG@10測定
- [ ] Recall@10測定
- [ ] 医療用語適合率測定

### Phase 5.3: パフォーマンステスト
- [ ] レイテンシ測定
- [ ] スループット測定
- [ ] 同時接続数テスト

---

## コミット履歴

### Phase 4.3 コミット
```
commit b6d6857
Author: Claude <noreply@anthropic.com>
Date:   2025-10-27 22:42

feat(RAG Phase 4.3): リアルタイムステータス表示・利用者選択・Vertex AI対応

## Backend改善
- Status streaming実装（searching/reranking/generating）
- 各処理フェーズの時間計測とメタデータ送信
- /searchエンドポイント削除（チャットのみに集中）
- Vertex AI APIタイムアウト対応（コンテキストベースの一時レスポンス）

## Frontend改善
- リアルタイムステータス表示（3段階プログレス）
- 経過時間表示（100ms更新）
- 新規チャットモーダル実装
- 利用者選択・固定機能
- ClientsContextでグローバル状態管理
- Markdown表示改善（react-markdown v9対応）
- 参照元表示の最適化

## スクリプト・ドキュメント
- ベクトル化スクリプト改善（data_sources.json更新）
- テストスクリプト追加（精度評価、パフォーマンステスト、E2Eテスト）
- API最適化ドキュメント追加
```

### Phase 4.4 コミット
```
commit 020e2a4
Author: Claude <noreply@anthropic.com>
Date:   2025-10-27 23:42

fix(frontend): Sidebar型エラー修正・Vercelデプロイ対応

## Frontend修正
- Sidebar: testタブとClientAutocompleteインポート削除
- ChatContainer: リアルタイムステータス表示改善

## Backend修正
- Gemini Service: Vertex AI APIタイムアウト時のコンテキストベースレスポンス改善
```

---

**署名**: Fractal Group 開発チーム
**承認**: t.asai@fractal-group.co.jp
**日付**: 2025-10-27 23:45 JST
