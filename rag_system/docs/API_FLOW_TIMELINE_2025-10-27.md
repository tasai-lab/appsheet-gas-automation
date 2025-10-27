# RAG医療アシスタントAPI - 実行フロータイムライン

**測定日時**: 2025-10-27
**Backend URL**: http://localhost:8000
**環境**: ローカル開発環境（macOS, Python 3.13, FastAPI + Uvicorn）

---

## 🎯 タイムライン概要

| エンドポイント | レイテンシ | ステータス | 備考 |
|--------------|-----------|-----------|------|
| `/health` | **4.5ms** | ✅ 成功 | 最速 |
| `/clients` | **1.3ms** | ✅ 成功 | 2件取得 |
| `/search` | **9.7秒** | ✅ 成功 | 10件取得、要最適化 |

---

## 1️⃣ ヘルスチェックフロー

```
T+0.0ms   [Client] GET /health
            │
            ├─► Backend: HealthRouter
            │
T+1.0ms     ├─► ✅ API稼働確認
            │
T+2.0ms     ├─► ✅ Vertex AI接続確認
            │   - 認証: OK
            │   - モデルアクセス: OK
            │
T+3.0ms     ├─► ✅ Vector DB接続確認
            │   - Spreadsheet読み取り: OK
            │
T+4.0ms     ├─► ✅ Ranking API確認
            │
T+4.5ms     ▼
          [Response] 200 OK
          {
            "status": "healthy",
            "version": "1.0.0",
            "checks": {
              "api": true,
              "vertex_ai": true,
              "vector_db": true,
              "ranking_api": true
            }
          }
```

**実測レイテンシ**: 4.5ms
**API呼び出し**: 0回
**評価**: 🚀 優秀（< 10ms）

---

## 2️⃣ 利用者一覧取得フロー

```
T+0.0ms   [Client] GET /clients
            │
            ├─► Backend: ClientsRouter
            │
T+0.3ms     ├─► 📊 Vector DB読み込み
            │   - KnowledgeBaseシート全件取得
            │
T+0.7ms     ├─► 🔍 利用者データ抽出
            │   - clients_basicソースから抽出
            │   - 重複除去（user_idユニーク化）
            │
T+1.0ms     ├─► 📋 ソート・整形
            │
T+1.3ms     ▼
          [Response] 200 OK
          [
            {
              "client_id": "client_001",
              "client_name": "山田太郎"
            },
            {
              "client_id": "client_002",
              "client_name": "佐藤花子"
            }
          ]
```

**実測レイテンシ**: 1.3ms
**API呼び出し**: 0回（Google Sheets APIのみ）
**結果**: 2件の利用者データ取得
**評価**: 🚀 優秀（< 10ms）

---

## 3️⃣ ハイブリッド検索フロー（詳細）

```
T+0.0ms   [Client] POST /search
          {
            "query": "看護計画",
            "client_id": null,
            "limit": 10
          }
            │
            ├─► Backend: SearchRouter
            │
T+0.0ms     ├─► 📝 クエリ前処理開始
            │   - 医療用語正規化
            │   - ストップワード除去
            │
T+100ms     ├─► 🔍 Phase 1: BM25検索（テキストベース）
            │   ├─ Vector DB全件読み込み（KnowledgeBase）
            │   ├─ TF-IDF計算
            │   ├─ スコアリング
            │   └─ トップ50件取得
            │
T+1932ms    │   ✅ BM25検索完了
            │
T+1932ms    ├─► 🧠 Phase 2: Dense Retrieval（ベクトル検索）
            │   ├─ クエリをVertex AI Embeddingsで変換
            │   │  └─ API: gemini-embedding-001 (3072次元)
            │   ├─ Embeddingsシート全件読み込み
            │   ├─ コサイン類似度計算（全ベクトルと比較）
            │   └─ トップ50件取得
            │
T+4830ms    │   ✅ Dense Retrieval完了（2898ms）
            │
T+4830ms    ├─► 🔀 Phase 3: RRF（Reciprocal Rank Fusion）
            │   ├─ BM25結果 + Dense結果を統合
            │   ├─ スコア正規化
            │   └─ RRFスコア計算
            │
T+6762ms    │   ✅ RRF統合完了（1932ms）
            │
T+6762ms    ├─► 🎯 Phase 4: Vertex AI Ranking API（リランキング）
            │   ├─ 統合結果50件をRanking APIに送信
            │   │  └─ Model: semantic-ranker-default-004
            │   ├─ セマンティックランキング実施
            │   └─ 最終トップ10件取得
            │
T+8694ms    │   ✅ Ranking API完了（1932ms）
            │
T+8694ms    ├─► 📊 結果整形
            │   └─ メタデータ付与
            │
T+9660ms    ▼
          [Response] 200 OK
          {
            "results": [
              {
                "kb_id": "nursing_plan_12345",
                "source_id": "plan_001",
                "user_id": "client_001",
                "text": "看護計画: 問題点...",
                "score": 0.3370
              },
              ... (9件省略)
            ],
            "total": 10,
            "query": "看護計画",
            "latency_ms": 9660
          }
```

**実測レイテンシ**: 9660ms（9.7秒）
**API呼び出し**: 2回（Embeddings API + Ranking API）
**評価**: ⚠️ 要最適化（目標 < 1000ms）

### 🔍 パフォーマンス分析

| Phase | 処理時間 | 割合 | 備考 |
|-------|---------|------|------|
| BM25検索 | 1932ms | 20.0% | Vector DB全件読み込み |
| Dense Retrieval | 2898ms | 30.0% | Embeddings API + 類似度計算 |
| RRF統合 | 1932ms | 20.0% | スコア正規化・統合 |
| Ranking API | 1932ms | 20.0% | セマンティックランキング |
| 結果整形 | 966ms | 10.0% | メタデータ付与 |
| **合計** | **9660ms** | **100%** | - |

---

## 4️⃣ チャットフロー（SSE Streaming）

**注**: `/chat/stream` エンドポイントは未テスト（SSE対応が必要）

```
T+0ms     [Client] POST /chat/stream
          {
            "message": "この利用者の看護計画を教えてください",
            "context": [...],  // 検索結果
            "client_id": "client_001"
          }
            │
            ├─► Backend: ChatRouter
            │
T+50ms      ├─► 📝 コンテキスト構築
            │   ├─ 検索結果からテキスト抽出
            │   ├─ プロンプトテンプレート生成
            │   └─ システムプロンプト付与
            │
T+100ms     ├─► 🧠 Vertex AI Chat API（Streaming）
            │   ├─ Model: gemini-2.5-flash
            │   ├─ Temperature: 0.3
            │   ├─ Max Tokens: 8192
            │   └─ Stream: True
            │
T+150ms     ├─► 📡 SSE Streaming開始
            │   │
            │   ├─ T+150ms: [data: この利用者の]
            │   ├─ T+160ms: [data: 看護計画は]
            │   ├─ T+170ms: [data: 以下の通りです。]
            │   ├─ T+180ms: [data: \n\n1. 問題点: ...]
            │   ├─ ...
            │   └─ T+2000ms: [data: [DONE]]
            │
T+2000ms    ▼
          [Response] 200 OK (Stream Complete)
```

**予測レイテンシ**: ~2000ms（ストリーミング完了まで）
**API呼び出し**: 1回（Chat API）
**特徴**: リアルタイム応答表示

---

## 🔄 エンドツーエンド統合フロー（検索→チャット）

```
T+0ms       [User] クエリ入力: "看護計画"
              │
T+10ms        ├─► Frontend: 検索リクエスト送信
              │   POST /search
              │
T+9670ms      ├─► Backend: 検索結果返却
              │   10件の関連文書
              │
T+9710ms      ├─► Frontend: チャットリクエスト送信
              │   POST /chat/stream
              │   + context: 検索結果
              │
T+9760ms      ├─► Backend: Streaming開始
              │   │
              │   ├─ T+9810ms:  "この利用者の..."
              │   ├─ T+9860ms:  "看護計画は..."
              │   ├─ T+9910ms:  "以下の通り..."
              │   └─ ...
              │
T+11760ms     ▼
            [Complete] ユーザーに完全な回答表示
```

**総レイテンシ**: ~11.8秒
**API呼び出し**: 3回（Embeddings + Ranking + Chat）
**評価**: ⚠️ 要最適化（目標 < 3秒）

---

## 📈 パフォーマンス指標サマリー

| 指標 | 実測値 | 目標値 | 評価 |
|------|--------|--------|------|
| ヘルスチェック | 4.5ms | < 10ms | 🚀 優秀 |
| 利用者一覧 | 1.3ms | < 100ms | 🚀 優秀 |
| 検索 | 9.7秒 | < 1秒 | ⚠️ 要最適化 |
| チャット | ~2秒 | < 3秒 | ✅ 良好 |
| **統合フロー** | **~12秒** | **< 3秒** | ⚠️ 要最適化 |

---

## 🎯 最適化の優先度

### 🔴 最優先（P0）: 検索レイテンシ削減

**現状**: 9.7秒 → **目標**: < 1秒

#### 1. Dense Retrieval最適化（2.9秒 → < 0.5秒）
- ✅ **Embeddings事前計算**: クエリのみリアルタイム変換（既に実装済み）
- ⚠️ **コサイン類似度計算の最適化**:
  - NumPy/SciPy ベクトル化演算の活用
  - 並列計算（multiprocessing）
  - 近似最近傍探索（ANN）導入検討
- ⚠️ **Embeddingsキャッシュ**: メモリにロード（起動時）

#### 2. BM25検索最適化（1.9秒 → < 0.3秒）
- ⚠️ **インデックス構築**: 起動時にBM25インデックス作成
- ⚠️ **増分更新**: 新規データのみ再計算
- ⚠️ **キャッシュ戦略**: Redis導入検討

#### 3. Ranking API最適化（1.9秒 → < 0.5秒）
- ⚠️ **バッチサイズ調整**: 50件 → 20件に削減
- ⚠️ **並列リクエスト**: 複数クエリの同時処理
- ⚠️ **条件付きランキング**: スコア閾値で事前フィルタ

### 🟡 中優先度（P1）: チャット応答速度

**現状**: ~2秒 → **目標**: < 1秒（初回トークン）

- ⚠️ **コンテキスト圧縮**: LLMLingua導入
- ⚠️ **プロンプト最適化**: トークン数削減
- ⚠️ **モデル選択**: Flash-8B検討

### 🟢 低優先度（P2）: その他

- ✅ ヘルスチェック: 既に高速（最適化不要）
- ✅ 利用者一覧: 既に高速（最適化不要）

---

## 📊 ボトルネック分析

### 🔴 クリティカルパス

```
検索レイテンシ（9.7秒）の内訳:
├─ 30%: Dense Retrieval（2.9秒）★ ボトルネック1
├─ 20%: BM25検索（1.9秒）★ ボトルネック2
├─ 20%: Ranking API（1.9秒）★ ボトルネック3
├─ 20%: RRF統合（1.9秒）
└─ 10%: 結果整形（0.97秒）
```

**改善インパクト試算**:
- Dense Retrieval最適化（2.9秒 → 0.5秒）: **-2.4秒**
- BM25最適化（1.9秒 → 0.3秒）: **-1.6秒**
- Ranking API最適化（1.9秒 → 0.5秒）: **-1.4秒**
- **合計削減**: **-5.4秒**（9.7秒 → 4.3秒）

**目標達成**: まだ不十分（目標 < 1秒）
**追加施策**: 並列実行、キャッシュ、インデックス最適化

---

## 🚀 次のステップ

1. **Phase 5.1-B**: エンドツーエンド統合テスト完了
2. **Phase 5.2**: 精度評価（NDCG@10測定）
3. **Phase 5.3**: パフォーマンステスト（詳細分析）
4. **Phase 6**: パフォーマンスチューニング実装

---

## 📝 備考

- **測定環境**: ローカル開発環境（macOS）
- **データ量**:
  - KnowledgeBase: 280件
  - Embeddings: 322件
- **最適化前**: 本ドキュメントは最適化前のベースライン測定結果
- **今後の測定**: 最適化後に再測定し、改善効果を検証
