# 医療特化型RAGシステム

## 概要

訪問看護・医療介護分野に特化した高精度RAG (Retrieval-Augmented Generation) システム。
15の既存GASプロジェクトから生成された13,500件以上の看護記録、通話記録、利用者情報をベクトル化し、医療用語シノニム対応のチャットインターフェースで検索・質疑応答を提供します。

## 主な特徴

### 🎯 精度優先設計
- **Hybrid Search**: BM25 + Dense Retrieval + ⭐ **Vertex AI Ranking API** Reranking
- **医療用語シノニム辞書**: UMLS/SNOMED CT準拠の用語正規化
- **インタラクティブ用語提案**: 検索失敗時に代替用語を自動提案

### 🏗️ アーキテクチャ
- **GAS Layer**: 15プロジェクトから自動ベクトル化
- **Vector DB**: Google Spreadsheet (初期13,500件、月間200件追加想定)
- **Backend**: Cloud Run + FastAPI (Python 3.11)
- **Frontend**: Vercel + Next.js 14 (App Router)
- **Embeddings**: Vertex AI gemini-embedding-001 (3072次元)
- **Generation**: Vertex AI Gemini 2.5 Flash/Pro (思考モード対応)

### 📊 対象データ
- **Nursing (看護)**: 5プロジェクト - 通常記録、精神科記録、計画書、報告書等
- **Clients (利用者)**: 4プロジェクト - 基本情報、質疑応答、フェースシート等
- **Calls (通話)**: 3プロジェクト - 要約生成、質疑応答、記録
- **Sales (営業)**: 2プロジェクト - 営業レポート、名刺管理

## プロジェクト構成

```
rag_system/
├── docs/                     # 設計書・仕様書
│   ├── 01_PROJECT_OVERVIEW.md
│   ├── 02_ARCHITECTURE.md
│   ├── 03_HYBRID_SEARCH_SPEC_V2.md
│   ├── 04_API_SPECIFICATION.md
│   ├── 06_DEPLOYMENT.md
│   └── 07_SECURITY.md
├── backend/                  # FastAPI Backend
│   ├── app/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── README.md
├── frontend/                 # Next.js Frontend
│   ├── components/
│   ├── hooks/
│   ├── pages/
│   └── package.json
└── README.md                 # このファイル
```

## クイックスタート

### 前提条件
- Google Cloud Platform アカウント (Vertex AI有効化済み)
- Node.js 18以上
- Python 3.11以上
- Docker (オプション)

### セットアップ

1. **Vector DB準備**
   ```bash
   # 共通モジュールのREADME参照
   # docs/ja/RAG_VECTOR_DB_SETUP.md を参照してスプレッドシート作成
   ```

2. **Backend起動**
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

3. **Frontend起動**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **アクセス**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## 使用例

### チャット検索

```bash
# ユーザー選択あり
curl -X POST http://localhost:8000/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "バルーンの使用状況を教えて",
    "user_id": "user_001"
  }'

# 全体検索
curl -X POST http://localhost:8000/chat/stream \
  -H "Content-Type: application/json" \
  -d '{
    "message": "最近の訪問時の状態変化は？"
  }'
```

### Hybrid Search

```bash
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "膀胱留置カテーテル",
    "top_k": 10,
    "user_id": "user_001"
  }'
```

## パフォーマンス目標

| 指標 | 目標値 |
|-----|--------|
| 検索精度 (NDCG@5) | 0.75以上 |
| 医療用語適合率 | 90%以上 |
| 平均応答時間 | 3秒以内 |
| 同時接続数 | 50ユーザー |

## コスト試算

| 項目 | 月額 (500クエリ/月) | 備考 |
|-----|---------------------|------|
| Vertex AI Embeddings | $0.00 | 無料 |
| ⭐ **Vertex AI Ranking API** | **$0.50** | **マネージドReranking (90%削減)** |
| Vector Search | $0.0005 | Spreadsheet無料 |
| Cloud Run (Backend) | $2-5 | 従量課金 (GPU不要) |
| Vercel Pro | $20 | オプション |
| **合計 (最小構成)** | **$2.50-5.50/月** | **必須コンポーネントのみ** |
| **合計 (フル構成)** | **$22.50-25.50/月** | Vercel Pro含む |

> 💡 **コスト最適化**: Vertex AI Ranking API採用により、Cross-Encoder比で**Re-rankingコスト90%削減** ($5.00 → $0.50) を達成。

## 開発ロードマップ

- [x] Phase 1: 共通モジュール実装 (embeddings_service, vector_db_sync)
- [ ] Phase 2: GASプロジェクト統合 (15プロジェクト)
- [ ] Phase 3: Backend実装 (Hybrid Search, 用語提案)
- [ ] Phase 4: Frontend実装 (チャットUI、ストリーミング)
- [ ] Phase 5: 医療用語辞書構築 (100語)
- [ ] Phase 6: 統合テスト・精度評価
- [ ] Phase 7: 本番デプロイ

## ドキュメント

### 📚 コアドキュメント

- [プロジェクト概要](docs/01_PROJECT_OVERVIEW.md) - システム全体像と主要機能
- [アーキテクチャ設計](docs/02_ARCHITECTURE.md) - システムアーキテクチャとコンポーネント
- [Hybrid Search仕様 v2.0](docs/03_HYBRID_SEARCH_SPEC_V2.md) - 検索エンジンの詳細仕様
- [API仕様](docs/04_API_SPECIFICATION.md) - REST API エンドポイント
- [デプロイメント手順](docs/06_DEPLOYMENT.md) - Cloud Run / Vercel デプロイ
- [セキュリティ設計](docs/07_SECURITY.md) - 認証・認可とデータ保護

### 🏗️ セットアップガイド

- [GCPセットアップ](docs/GCP_SETUP.md) - Vertex AI, Cloud Run, API有効化
- [Spreadsheet作成ガイド](docs/SPREADSHEET_CREATION_GUIDE.md) - Vector DB初期化
- [Phase 2セットアップ](docs/PHASE2_SETUP_GUIDE.md) - GASプロジェクト統合

### 🎯 技術決定記録 (ADR)

- [技術決定記録](docs/DECISIONS.md) - 主要な技術選定と理由
  - Vertex AI完全移行
  - リランキングモデル選択
  - ハイブリッド検索の採用
  - ベクトルDB設計
  - Gemini 2.5 Flashの採用
  - 重大なバグと教訓

### 📋 参照資料

- [AIモデル仕様](docs/ref/AIモデル仕様.md) - Gemini/Vertex AIモデル詳細
- [推奨アップデート2025](docs/ref/rag/推奨アップデート2025.md) - RAG最新トレンド

## ライセンス

Proprietary - Fractal Group

## 問い合わせ

- 担当: Fractal Group 開発チーム
- Email: t.asai@fractal-group.co.jp

---

**最終更新**: 2025-10-27
**バージョン**: 1.0.0-alpha
