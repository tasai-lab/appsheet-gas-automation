# RAG Medical Assistant API - Backend

医療・看護記録検索RAGシステムのBackend APIサーバー。

## 📋 概要

- **Framework**: FastAPI 0.115.0
- **Language**: Python 3.11
- **AI Platform**: Google Cloud Vertex AI
- **Ranking**: Vertex AI Ranking API (semantic-ranker-default-004)
- **Vector DB**: Google Spreadsheet
- **Deployment**: Cloud Run

## 🚀 クイックスタート

### 1. 依存関係インストール

```bash
cd rag_system/backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. 環境変数設定

`.env`ファイルを作成:

```bash
cp .env.example .env
```

必須環境変数を設定:

```env
GCP_PROJECT_ID=fractal-ecosystem
GCP_LOCATION=us-central1
VECTOR_DB_SPREADSHEET_ID=<SPREADSHEET_ID>
```

### 3. ローカル起動

```bash
uvicorn app.main:app --reload --port 8000
```

### 4. API確認

```bash
# ヘルスチェック
curl http://localhost:8000/health

# APIドキュメント
open http://localhost:8000/docs
```

## 📁 プロジェクト構造

```
backend/
├── app/
│   ├── main.py                  # FastAPI アプリケーション
│   ├── config.py                # 設定管理
│   ├── routers/                 # エンドポイント
│   │   ├── health.py            # ヘルスチェック
│   │   ├── search.py            # 検索API
│   │   └── chat.py              # チャットAPI
│   ├── models/                  # Pydanticモデル
│   │   ├── request.py           # リクエストモデル
│   │   └── response.py          # レスポンスモデル
│   ├── services/                # ビジネスロジック
│   │   ├── rag_engine.py        # Hybrid Search
│   │   ├── reranker.py          # Vertex AI Ranking API
│   │   ├── vertex_ai.py         # Vertex AI クライアント
│   │   ├── spreadsheet.py       # Vector DB接続
│   │   └── medical_terms.py     # 医療用語処理
│   └── utils/                   # ユーティリティ
│       ├── cosine.py            # コサイン類似度
│       ├── bm25.py              # BM25スコアリング
│       └── logger.py            # ロギング
├── tests/                       # テスト
├── requirements.txt             # 依存関係
├── Dockerfile                   # Dockerイメージ
└── README.md                    # このファイル
```

## 🔌 APIエンドポイント

### Health Check

```bash
GET /health
```

### Search

```bash
POST /search
Content-Type: application/json

{
  "query": "膀胱留置カテーテル交換の手順",
  "domain": "nursing",
  "top_k": 10
}
```

### Chat (Streaming)

```bash
POST /chat/stream
Content-Type: application/json

{
  "message": "バルーン交換の記録を教えて",
  "user_id": "user_001",
  "domain": "nursing",
  "stream": true
}
```

## 🐳 Docker実行

### ビルド

```bash
docker build -t rag-backend .
```

### 実行

```bash
docker run -p 8000:8000 \
  -e GCP_PROJECT_ID=fractal-ecosystem \
  -e GCP_LOCATION=us-central1 \
  -e VECTOR_DB_SPREADSHEET_ID=<SPREADSHEET_ID> \
  rag-backend
```

## 🚢 Cloud Run デプロイ

```bash
# 1. Artifact Registryにプッシュ
gcloud builds submit --tag gcr.io/fractal-ecosystem/rag-backend:latest

# 2. Cloud Runにデプロイ
gcloud run deploy rag-backend \
  --image gcr.io/fractal-ecosystem/rag-backend:latest \
  --platform managed \
  --region us-central1 \
  --service-account rag-backend@fractal-ecosystem.iam.gserviceaccount.com \
  --set-env-vars GCP_PROJECT_ID=fractal-ecosystem \
  --set-env-vars GCP_LOCATION=us-central1 \
  --set-env-vars VECTOR_DB_SPREADSHEET_ID=<SPREADSHEET_ID>
```

## 🧪 テスト実行

```bash
# 全テスト実行
pytest

# カバレッジ付き
pytest --cov=app --cov-report=html

# 特定のテスト
pytest tests/test_search.py
```

## 📝 開発フロー

### Phase 3.1: プロジェクト構造作成 ✅
- [x] ディレクトリ構造
- [x] requirements.txt
- [x] FastAPI基本設定
- [x] ルーター（stub）
- [x] モデル定義
- [x] Dockerfile

### Phase 3.2: Vertex AI Ranking API統合 ⏳
- [ ] Vertex AIクライアント実装
- [ ] Ranking API呼び出し実装
- [ ] エラーハンドリング

### Phase 3.3: Hybrid Search実装 ⏳
- [ ] BM25検索
- [ ] Dense Retrieval
- [ ] Ranking APIリランキング
- [ ] 医療用語シノニム処理

### Phase 3.4: REST/SSE実装 ⏳
- [ ] 検索エンドポイント実装
- [ ] チャットエンドポイント実装
- [ ] SSEストリーミング実装

### Phase 3.5: Cloud Run デプロイ ⏳
- [ ] Dockerイメージビルド
- [ ] Cloud Runデプロイ
- [ ] 動作確認

## 🔧 トラブルシューティング

### Vertex AI認証エラー

```bash
gcloud auth application-default login
```

### Spreadsheet接続エラー

`.env`の`VECTOR_DB_SPREADSHEET_ID`が正しく設定されているか確認してください。

## 📚 関連ドキュメント

- [アーキテクチャ設計](../docs/02_ARCHITECTURE.md)
- [Hybrid Search仕様](../docs/03_HYBRID_SEARCH_SPEC_V2.md)
- [API仕様](../docs/04_API_SPECIFICATION.md)
- [デプロイ手順](../docs/06_DEPLOYMENT.md)

---

**バージョン**: 1.0.0
**最終更新**: 2025-10-27
