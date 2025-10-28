# Backend - Claude Code ガイド

**プロジェクト**: RAG Medical Assistant API - Backend
**現在**: V3移行プロジェクト（Phase 0: 準備 → Phase 1-2: Backend実装）
**担当フェーズ**: Phase 1（DB移行）+ Phase 2（Backend実装）= 22日間
**技術スタック**: FastAPI 0.115 + Vertex AI + Cloud SQL MySQL 9.0
**最終更新**: 2025-10-28

---

## 🎯 Backend担当のV3タスク（22日間）

### Phase 1: データベース移行（10日間、2025-11-04〜2025-11-14）

- [ ] **Task 1.1: スキーマ作成**（2日、優先度: 🔴）
  - ファイル: `backend/sql/schema.sql`
  - 5テーブル作成（knowledge_base, embeddings, clients, chat_sessions, chat_messages）
  - Vector Index作成（COSINE distance, 2048次元）
  - 担当: Backend Lead

- [ ] **Task 1.2: 移行スクリプト開発**（4日、優先度: 🔴）
  - ファイル: `scripts/migrate_to_mysql.py`
  - Firestore → MySQL データ移行
  - バリデーション機能実装
  - 進捗表示機能実装
  - 担当: Backend開発者

- [ ] **Task 1.3: テストデータ移行**（2日、優先度: 🟡）
  - 100件のテストデータ移行
  - データ整合性検証
  - パフォーマンステスト（検索レイテンシ測定）
  - 担当: Backend開発者

- [ ] **Task 1.4: 本番データ移行**（2日、優先度: 🔴）
  - 3,151件 + 増分データ移行
  - ダウンタイム最小化（並行運用）
  - ロールバック計画策定
  - 担当: Backend Lead + DevOps

### Phase 2: Backend実装（12日間、2025-11-14〜2025-11-25）

- [ ] **Task 2.1: MySQL接続層実装**（3日、優先度: 🔴）
  - ファイル: `app/services/mysql_client.py`, `app/database/connection.py`
  - SQLAlchemy ORM モデル作成
  - Vector Search関数実装
  - コネクションプーリング（10並列）
  - 担当: Backend Lead

- [ ] **Task 2.2: プロンプト最適化実装**（3日、優先度: 🔴）
  - ファイル: `app/services/prompt_optimizer.py`
  - Gemini 2.5 Flash-Lite統合
  - 利用者情報自動組み込み
  - 時間表現変換（「直近」→「2025-10-21〜2025-10-28」）
  - 担当: Backend開発者

- [ ] **Task 2.3: RAG Engine V3実装**（4日、優先度: 🔴）
  - ファイル: `app/services/rag_engine_v3.py`
  - 4ステップ検索パイプライン実装
  - 20件検索結果返却
  - パフォーマンス最適化（1-2秒目標）
  - 担当: Backend Lead

- [ ] **Task 2.4: ストリーミング改善**（2日、優先度: 🟡）
  - ファイル: `app/routers/chat_v3.py`, `app/services/gemini_service_v3.py`
  - 思考モード有効化（thinking_budget: -1）
  - 進捗イベント送信（optimize → vectorize → search → rerank）
  - 初回チャンク1秒以内目標
  - 担当: Backend開発者

**詳細**: [../../docs/V3_TASKS.md](../../docs/V3_TASKS.md)

---

## 🚀 クイックスタート

### ローカル開発

```bash
# バックエンドディレクトリに移動
cd backend

# 仮想環境作成・有効化
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存関係インストール
pip install -r requirements.txt

# 環境変数設定（.envファイル作成）
cp .env.example .env
# .envファイルを編集: GCP_PROJECT_ID, MYSQL_HOST等

# 開発サーバー起動
uvicorn app.main:app --reload --port 8000
```

### APIドキュメント確認

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

---

## ⚠️ 最重要な制約（必読）

### 1. API呼び出し: リトライループ厳禁

**絶対に禁止:**
```python
# ❌ 絶対に書かない
for attempt in range(3):  # リトライループ
    try:
        result = await vertex_ai.generate(...)
        break
    except:
        continue
```

**正しいパターン:**
```python
# ✅ 1回のみ実行
try:
    # ★★★ Vertex AI API呼び出し: 1回のみ実行 ★★★
    logger.info("[API] Vertex AI呼び出し開始")
    result = await vertex_ai.generate(...)
    logger.info("[API] Vertex AI呼び出し成功")
    return result
except Exception as e:
    logger.error(f"[API] Vertex AI呼び出し失敗: {e}")
    raise  # 即座にraise（リトライしない）
```

**理由**: 過去に200,000+ API呼び出し/日の事故発生（参照: [../../docs/ERROR_LOG.md](../../docs/ERROR_LOG.md)）

### 2. エラー記録: 全てのエラーを ERROR_LOG.md に記録

**発生したエラーは必ず記録:**
- ファイルパス: `rag_system/docs/ERROR_LOG.md`
- 記録項目: 発生日時、問題内容、原因分析、解決策、再発防止策、教訓

### 3. セキュリティ: 個人情報保護

```python
# ❌ 個人情報をログに出力しない
logger.info(f"利用者: {user_name}, 記録: {medical_record}")

# ✅ マスキング必須
logger.info(f"利用者ID: {user_id[:4]}***, 記録ID: {record_id}")
```

---

## 📁 Backend プロジェクト構造（V3対応）

```
backend/
├── app/
│   ├── main.py                      # FastAPIアプリケーション（エントリーポイント）
│   ├── config.py                    # 環境変数・設定管理（Pydantic Settings）
│   │
│   ├── routers/                     # エンドポイント（APIルーター）
│   │   ├── health.py                # ヘルスチェック・キャッシュメトリクス
│   │   ├── chat.py                  # チャットAPI（SSEストリーミング）← V2
│   │   ├── chat_v3.py               # ⭐ チャットAPI V3 ← **Task 2.4で実装**
│   │   ├── clients.py               # 利用者情報取得API
│   │   └── search.py                # 検索API（非推奨・互換性のみ）
│   │
│   ├── models/                      # Pydanticモデル
│   │   ├── request.py               # リクエストモデル
│   │   └── response.py              # レスポンスモデル
│   │
│   ├── services/                    # ビジネスロジック（サービス層）
│   │   ├── rag_engine.py            # Hybrid Search エンジン V2（現行）
│   │   ├── rag_engine_v3.py         # ⭐ RAG Engine V3 ← **Task 2.3で実装**
│   │   ├── mysql_client.py          # ⭐ MySQL接続クライアント ← **Task 2.1で実装**
│   │   ├── prompt_optimizer.py      # ⭐ プロンプト最適化 ← **Task 2.2で更新**
│   │   ├── vertex_ai.py             # Vertex AI クライアント（Embeddings）
│   │   ├── gemini_service.py        # Gemini生成API（回答生成）V2
│   │   ├── gemini_service_v3.py     # ⭐ Gemini Service V3（思考モード） ← **Task 2.4で実装**
│   │   ├── reranker.py              # Vertex AI Ranking API（Re-ranking）
│   │   ├── firestore_vector_service.py  # Firestore Vector Search（V2）
│   │   ├── firestore_chat_history.py    # Firestore チャット履歴管理
│   │   ├── spreadsheet.py           # Google Spreadsheet接続
│   │   ├── medical_terms.py         # 医療用語展開・シノニム処理
│   │   ├── cache_service.py         # キャッシュサービス（インメモリ）
│   │   └── firebase_admin.py        # Firebase Admin SDK初期化
│   │
│   ├── database/                    # ⭐ データベース層 ← **Task 2.1で新規作成**
│   │   ├── connection.py            # データベース接続管理（SQLAlchemy）
│   │   └── models.py                # SQLAlchemy ORM モデル
│   │
│   ├── middleware/                  # ミドルウェア
│   │   └── auth.py                  # Firebase認証（実装予定）
│   │
│   └── utils/                       # ユーティリティ
│       ├── cosine.py                # コサイン類似度計算
│       └── bm25.py                  # BM25スコアリング
│
├── sql/                             # ⭐ SQLスクリプト ← **Task 1.1で作成**
│   ├── schema.sql                   # データベーススキーマ
│   ├── migrations/                  # マイグレーションスクリプト
│   └── README.md                    # SQL関連ドキュメント
│
├── scripts/                         # スクリプト
│   ├── migrate_to_mysql.py          # ⭐ Firestore → MySQL 移行 ← **Task 1.2で実装**
│   └── validate_migration.py        # ⭐ 移行検証スクリプト ← **Task 1.3で実装**
│
├── tests/                           # テスト（pytest）
│   ├── test_rag_engine_v3.py        # ⭐ V3テスト ← **Task 2.3で実装**
│   ├── test_mysql_client.py         # ⭐ V3テスト ← **Task 2.1で実装**
│   └── test_prompt_optimizer.py     # ⭐ V3テスト ← **Task 2.2で実装**
│
├── requirements.txt                 # 依存関係（mysql-connector-python追加予定）
├── Dockerfile                       # Dockerイメージ
├── .env.example                     # 環境変数テンプレート
└── README.md                        # Backend概要
```

---

## 🆕 V3新サービス実装ガイド

### 1. MySQL Client ([mysql_client.py](../app/services/mysql_client.py)) - Task 2.1

**実装仕様**:
```python
from typing import List, Dict, Any, Optional
from sqlalchemy import create_engine, text
from sqlalchemy.pool import QueuePool
import logging

logger = logging.getLogger(__name__)

class MySQLClient:
    """Cloud SQL MySQL接続クライアント（Vector Search対応）"""
    
    def __init__(self, connection_string: str, pool_size: int = 10):
        """
        Args:
            connection_string: MySQL接続文字列
            pool_size: コネクションプール数（デフォルト: 10）
        """
        self.engine = create_engine(
            connection_string,
            poolclass=QueuePool,
            pool_size=pool_size,
            max_overflow=20,
            pool_pre_ping=True
        )
    
    async def vector_search(
        self,
        query_vector: List[float],
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        MySQL Vector Search実行
        
        Args:
            query_vector: クエリベクトル（2048次元）
            limit: 検索結果数
            filters: フィルタ条件（domain, user_id）
        
        Returns:
            検索結果リスト
        """
        try:
            logger.info("[MySQLClient] Vector Search開始")
            
            # ★★★ 1回のみ実行（リトライなし） ★★★
            with self.engine.connect() as conn:
                # Vector Search SQL
                sql = text("""
                    SELECT 
                        kb.id,
                        kb.domain,
                        kb.user_id,
                        kb.user_name,
                        kb.title,
                        kb.content,
                        kb.created_at,
                        VEC_DISTANCE(e.embedding, :query_vector, COSINE) as distance
                    FROM knowledge_base kb
                    JOIN embeddings e ON kb.id = e.kb_id
                    WHERE 1=1
                        AND (:domain IS NULL OR kb.domain = :domain)
                        AND (:user_id IS NULL OR kb.user_id = :user_id)
                    ORDER BY distance ASC
                    LIMIT :limit
                """)
                
                result = conn.execute(sql, {
                    "query_vector": query_vector,
                    "domain": filters.get("domain") if filters else None,
                    "user_id": filters.get("user_id") if filters else None,
                    "limit": limit
                })
                
                results = [dict(row) for row in result]
                
            logger.info(f"[MySQLClient] Vector Search完了: {len(results)}件")
            return results
            
        except Exception as e:
            logger.error(f"[MySQLClient] Vector Search失敗: {e}")
            raise  # 即座にraise
```

**テスト**:
```python
# tests/test_mysql_client.py
import pytest
from app.services.mysql_client import MySQLClient

@pytest.mark.asyncio
async def test_vector_search():
    client = MySQLClient("mysql://...")
    results = await client.vector_search(
        query_vector=[0.1] * 2048,
        limit=10
    )
    assert len(results) <= 10
    assert "distance" in results[0]
```

### 2. Prompt Optimizer ([prompt_optimizer.py](../app/services/prompt_optimizer.py)) - Task 2.2

**実装仕様**:
```python
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class PromptOptimizer:
    """プロンプト最適化サービス（Gemini 2.5 Flash-Lite）"""
    
    def __init__(self, gemini_client):
        self.gemini_client = gemini_client
    
    async def optimize(
        self,
        query: str,
        client_id: Optional[str] = None,
        client_name: Optional[str] = None,
        chat_history: List[Dict[str, Any]] = []
    ) -> str:
        """
        プロンプト最適化
        
        Args:
            query: ユーザー入力クエリ
            client_id: 利用者ID
            client_name: 利用者名
            chat_history: 会話履歴
        
        Returns:
            最適化されたプロンプト
        """
        try:
            logger.info(f"[PromptOptimizer] 最適化開始: {query[:50]}...")
            
            # システムプロンプト作成
            system_prompt = self._build_system_prompt(
                client_id=client_id,
                client_name=client_name
            )
            
            # Gemini 2.5 Flash-Lite呼び出し（★★★ 1回のみ ★★★）
            optimized_query = await self.gemini_client.generate(
                model="gemini-2.5-flash-lite",
                system=system_prompt,
                prompt=query,
                temperature=0.3,
                max_output_tokens=1024
            )
            
            logger.info(f"[PromptOptimizer] 最適化完了: {optimized_query[:50]}...")
            return optimized_query
            
        except Exception as e:
            logger.error(f"[PromptOptimizer] 最適化失敗: {e}")
            raise
    
    def _build_system_prompt(
        self,
        client_id: Optional[str],
        client_name: Optional[str]
    ) -> str:
        """システムプロンプト作成"""
        today = datetime.now().strftime("%Y年%m月%d日")
        week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y年%m月%d日")
        
        return f"""
あなたは医療・看護記録検索システムのクエリ最適化AIです。

## タスク
ユーザーの入力クエリを、検索精度が最大化されるように最適化してください。

## 最適化ルール
1. **利用者情報の組み込み**: 必ず以下の情報を含める
   - 利用者名: {client_name or "（未選択）"}
   - 利用者ID: {client_id or "（未選択）"}

2. **時間表現の変換**:
   - "直近" → "{week_ago}から{today}"
   - "最近" → "{week_ago}から{today}"
   - "今日" → "{today}"

3. **医療用語の展開**:
   - "ADL" → "日常生活動作（ADL）"
   - "バイタル" → "バイタルサイン（体温・血圧・脈拍・呼吸）"

4. **具体性の向上**:
   - 曖昧な表現を具体的に変換
   - 検索意図を明確化

## 出力形式
最適化されたクエリのみを出力してください（説明不要）。

## 例
入力: "直近の変化を教えて"
出力: "{client_name}さん（利用者ID: {client_id}）の{week_ago}から{today}までの状態変化を教えてください"
"""
```

### 3. RAG Engine V3 ([rag_engine_v3.py](../app/services/rag_engine_v3.py)) - Task 2.3

**実装仕様**:
```python
from typing import Dict, Any, Optional
import logging
import time

logger = logging.getLogger(__name__)

class RAGEngineV3:
    """RAG Engine V3 - 4ステップ検索パイプライン"""
    
    def __init__(
        self,
        prompt_optimizer,
        vertex_ai_client,
        mysql_client,
        reranker
    ):
        self.prompt_optimizer = prompt_optimizer
        self.vertex_ai_client = vertex_ai_client
        self.mysql_client = mysql_client
        self.reranker = reranker
    
    async def search(
        self,
        query: str,
        client_id: Optional[str] = None,
        client_name: Optional[str] = None,
        top_k: int = 20
    ) -> Dict[str, Any]:
        """
        4ステップ検索実行
        
        Args:
            query: ユーザークエリ
            client_id: 利用者ID
            client_name: 利用者名
            top_k: 最終結果数（デフォルト: 20）
        
        Returns:
            検索結果（results, optimized_query, metrics）
        """
        start_time = time.time()
        metrics = {}
        
        try:
            # Step 1: プロンプト最適化（< 1秒目標）
            logger.info("[RAGEngineV3] Step 1: プロンプト最適化開始")
            step1_start = time.time()
            optimized_query = await self.prompt_optimizer.optimize(
                query=query,
                client_id=client_id,
                client_name=client_name
            )
            metrics["step1_duration"] = time.time() - step1_start
            logger.info(f"[RAGEngineV3] Step 1完了: {metrics['step1_duration']:.2f}秒")
            
            # Step 2: ベクトル化（< 0.5秒目標）
            logger.info("[RAGEngineV3] Step 2: ベクトル化開始")
            step2_start = time.time()
            query_vector = self.vertex_ai_client.generate_query_embedding(optimized_query)
            metrics["step2_duration"] = time.time() - step2_start
            logger.info(f"[RAGEngineV3] Step 2完了: {metrics['step2_duration']:.2f}秒")
            
            # Step 3: Vector Search（< 0.5秒目標）
            logger.info("[RAGEngineV3] Step 3: Vector Search開始")
            step3_start = time.time()
            candidates = await self.mysql_client.vector_search(
                query_vector=query_vector,
                limit=100,  # 候補は多めに取得
                filters={"user_id": client_id} if client_id else None
            )
            metrics["step3_duration"] = time.time() - step3_start
            metrics["step3_candidates"] = len(candidates)
            logger.info(f"[RAGEngineV3] Step 3完了: {metrics['step3_duration']:.2f}秒、{len(candidates)}件")
            
            # Step 4: リランキング（< 1秒目標）
            logger.info("[RAGEngineV3] Step 4: リランキング開始")
            step4_start = time.time()
            results = self.reranker.rerank(
                query=optimized_query,
                documents=candidates,
                top_n=top_k
            )
            metrics["step4_duration"] = time.time() - step4_start
            metrics["step4_results"] = len(results)
            logger.info(f"[RAGEngineV3] Step 4完了: {metrics['step4_duration']:.2f}秒、{len(results)}件")
            
            # 総時間
            metrics["total_duration"] = time.time() - start_time
            logger.info(f"[RAGEngineV3] 検索完了: {metrics['total_duration']:.2f}秒")
            
            return {
                "results": results,
                "optimized_query": optimized_query,
                "metrics": metrics
            }
            
        except Exception as e:
            logger.error(f"[RAGEngineV3] 検索失敗: {e}")
            raise
```

---

## 🧪 テスト

### テスト実行

```bash
# 全テスト実行
pytest

# カバレッジ付き
pytest --cov=app --cov-report=html

# V3テストのみ
pytest tests/test_rag_engine_v3.py
pytest tests/test_mysql_client.py
pytest tests/test_prompt_optimizer.py

# 非同期テストのデバッグ
pytest tests/test_chat_v3.py -v -s
```

---

## 🔧 環境変数設定

### V3追加環境変数

```bash
# Cloud SQL設定
MYSQL_HOST=10.x.x.x  # Private IP
MYSQL_PORT=3306
MYSQL_DATABASE=rag_system
MYSQL_USER=rag_user
MYSQL_PASSWORD=<PASSWORD>
MYSQL_SSL_CA=/path/to/server-ca.pem
MYSQL_POOL_SIZE=10

# プロンプト最適化
PROMPT_OPTIMIZER_MODEL=gemini-2.5-flash-lite
PROMPT_OPTIMIZER_TEMPERATURE=0.3
PROMPT_OPTIMIZER_MAX_OUTPUT_TOKENS=1024

# V3機能切替
USE_RAG_ENGINE_V3=true  # V3エンジン有効化
```

---

## 💻 コーディング規約

```python
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

async def function_name(
    param1: str,
    param2: Optional[int] = None
) -> Dict[str, Any]:
    """
    関数説明

    Args:
        param1: パラメータ1の説明
        param2: パラメータ2の説明（オプション）

    Returns:
        戻り値の説明

    Raises:
        Exception: エラーの説明
    """
    try:
        logger.info(f"[function_name] 処理開始: param1={param1}")

        # ★★★ API呼び出し: 1回のみ実行 ★★★
        result = await api_call(param1)

        logger.info("[function_name] 処理成功")
        return {"success": True, "result": result}

    except Exception as e:
        logger.error(f"[function_name] 処理失敗: {e}", exc_info=True)
        raise  # 即座にraise（リトライしない）
```

---

## ✅ Backend開発チェックリスト

### タスク開始前

- [ ] [V3_TASKS.md](../../docs/V3_TASKS.md) でタスク詳細を確認
- [ ] [V3_ARCHITECTURE.md](../../docs/V3_ARCHITECTURE.md) の該当セクションを確認
- [ ] [ERROR_LOG.md](../../docs/ERROR_LOG.md) で過去のエラーを確認
- [ ] ブランチ作成: `git checkout -b feature/task-X.Y`

### 実装中

- [ ] 型ヒント必須（mypy互換）
- [ ] Docstring記述（Google Style）
- [ ] ログ出力（logger.info, logger.error）
- [ ] API呼び出しは1回のみ（リトライループ厳禁）
- [ ] セキュリティ確認（個人情報マスキング）

### タスク完了後 ⭐ **必須**

- [ ] `pytest tests/test_*.py` 成功
- [ ] `mypy app/` 成功
- [ ] **[V3_PROGRESS.md](../../docs/V3_PROGRESS.md) を即座に更新** ⭐ **最重要**
- [ ] **Slackに完了報告を投稿** ⭐ **最重要**
- [ ] PR作成（[PROJECT_MANAGEMENT.md](../../docs/PROJECT_MANAGEMENT.md) テンプレート使用）
- [ ] コードレビュー依頼

---

## 📣 タスク完了時の進捗シェア（Backend開発者向け）

### ⚠️ タスク完了時は必ず実施

#### 1. V3_PROGRESS.md を即座に更新

```bash
# 完了タスクをチェック
- [x] Task X.Y: タスク名

# Phase進捗率を更新
Phase 1: データベース移行 [▰▰▰▰▰▱▱▱▱▱] 50% → 60%
Phase 2: Backend実装    [▰▰▰▱▱▱▱▱▱▱] 25% → 30%
```

#### 2. Slackに完了報告（テンプレート）

```
✅ Backend Task完了

【タスク】: Task X.Y - タスク名
【完了日時】: YYYY-MM-DD HH:MM
【成果物】:
- app/services/xxx.py（機能実装）
- tests/test_xxx.py（テストケース）
- backend/sql/xxx.sql（スキーマ更新、該当する場合）

【テスト結果】:
- pytest: X/X成功
- mypy: エラーなし
- パフォーマンス: 検索速度 X秒（目標: Y秒）

【次のタスク】: Task X.Y+1
【見積】: X日

【ブロッカー】: なし
```

#### 3. 良い報告例（Backend）

```
✅ Task 2.1完了 - MySQL接続層実装

【完了日時】: 2025-11-17 18:00
【成果物】:
- app/services/mysql_client.py（250行）
- app/database/connection.py（80行）
- app/database/models.py（120行）
- tests/test_mysql_client.py（20テストケース）

【テスト結果】:
- pytest: 20/20成功
- mypy: エラーなし
- Vector Search: 平均0.4秒（目標: 0.5秒以内）✅
- コネクションプール: 10並列接続成功✅

【次のタスク】: Task 2.2 - プロンプト最適化実装
【見積】: 3日

【ブロッカー】: なし
```

#### 4. 日次報告（毎日17:00）

**Backend開発者の日次報告**:
- 実装したファイル名とテスト結果
- パフォーマンス測定結果（該当する場合）
- 明日の実装計画

---

## 📚 関連ドキュメント

### V3プロジェクト
- **[V3_TASKS.md](../../docs/V3_TASKS.md)** - Backend担当タスク詳細
- **[V3_ARCHITECTURE.md](../../docs/V3_ARCHITECTURE.md)** - Section 3（DB設計）、Section 5（Backend）
- **[V3_PROGRESS.md](../../docs/V3_PROGRESS.md)** - 進捗追跡
- **[TEAM_ASSIGNMENT.md](../../docs/TEAM_ASSIGNMENT.md)** - Backend役割（Phase 1-2メイン）

### コア
- **[ERROR_LOG.md](../../docs/ERROR_LOG.md)** ⭐ 必読
- **[04_API_SPECIFICATION.md](../../docs/04_API_SPECIFICATION.md)** - API仕様
- **[07_SECURITY.md](../../docs/07_SECURITY.md)** - セキュリティ設計

---

**最終更新**: 2025-10-28
**次回レビュー**: Phase 1開始時（2025-11-04）
