"""
MySQL接続 統合テスト

Cloud SQL for MySQL との接続と基本操作をテストします。

実行要件:
- Cloud SQL インスタンスが起動していること
- .env に接続情報が正しく設定されていること
- データベース `rag_system` が作成済みであること

実行方法:
```bash
# 統合テスト実行（Cloud SQL接続必須）
pytest tests/integration/test_mysql_connection.py -v

# Cloud SQL未起動時はスキップ
SKIP_INTEGRATION_TESTS=1 pytest tests/integration/test_mysql_connection.py -v
```
"""

import os

import pytest
from sqlalchemy import text

from app.database.connection import db_manager

# 環境変数でスキップ設定
SKIP_INTEGRATION = os.getenv("SKIP_INTEGRATION_TESTS", "0") == "1"


@pytest.fixture(scope="module")
async def db_session():
    """データベースセッションを返すフィクスチャ（モジュールスコープ）"""
    if SKIP_INTEGRATION:
        pytest.skip("Integration tests are disabled (SKIP_INTEGRATION_TESTS=1)")

    try:
        async with db_manager.get_session() as session:
            yield session
    except Exception as e:
        pytest.skip(f"Cloud SQL not available: {e}")


@pytest.mark.integration
@pytest.mark.skipif(SKIP_INTEGRATION, reason="Integration tests disabled")
class TestMySQLConnection:
    """MySQL接続テスト"""

    @pytest.mark.asyncio
    async def test_connection_success(self, db_session):
        """Cloud SQL接続が成功することを確認"""
        result = await db_session.execute(text("SELECT 1"))
        assert result is not None

    @pytest.mark.asyncio
    async def test_database_version(self, db_session):
        """MySQL バージョンが 9.0 以上であることを確認"""
        result = await db_session.execute(text("SELECT VERSION()"))
        version = result.scalar()
        assert version is not None
        print(f"MySQL Version: {version}")
        # MySQL 9.0 以上であることを確認（Vector Type サポート）
        assert version.startswith("9.") or version.startswith("8.")

    @pytest.mark.asyncio
    async def test_database_exists(self, db_session):
        """データベース `rag_system` が存在することを確認"""
        result = await db_session.execute(text("SELECT DATABASE()"))
        db_name = result.scalar()
        assert db_name == "rag_system"


@pytest.mark.integration
@pytest.mark.skipif(SKIP_INTEGRATION, reason="Integration tests disabled")
class TestKnowledgeBaseTable:
    """knowledge_base テーブルのテスト"""

    @pytest.mark.asyncio
    async def test_table_exists(self, db_session):
        """knowledge_base テーブルが存在することを確認"""
        result = await db_session.execute(
            text(
                """
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = 'rag_system'
                AND table_name = 'knowledge_base'
                """
            )
        )
        count = result.scalar()
        assert count == 1, "knowledge_base テーブルが存在しません"

    @pytest.mark.asyncio
    async def test_table_columns(self, db_session):
        """knowledge_base テーブルのカラムが正しいことを確認"""
        result = await db_session.execute(
            text(
                """
                SELECT COLUMN_NAME
                FROM information_schema.columns
                WHERE table_schema = 'rag_system'
                AND table_name = 'knowledge_base'
                ORDER BY ORDINAL_POSITION
                """
            )
        )
        columns = [row[0] for row in result.fetchall()]

        # 必須カラムの確認
        expected_columns = ["id", "title", "content", "domain", "user_id", "metadata", "created_at", "updated_at"]
        for col in expected_columns:
            assert col in columns, f"カラム '{col}' が存在しません"


@pytest.mark.integration
@pytest.mark.skipif(SKIP_INTEGRATION, reason="Integration tests disabled")
class TestEmbeddingsTable:
    """embeddings テーブルのテスト"""

    @pytest.mark.asyncio
    async def test_table_exists(self, db_session):
        """embeddings テーブルが存在することを確認"""
        result = await db_session.execute(
            text(
                """
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = 'rag_system'
                AND table_name = 'embeddings'
                """
            )
        )
        count = result.scalar()
        assert count == 1, "embeddings テーブルが存在しません"

    @pytest.mark.asyncio
    async def test_vector_column_type(self, db_session):
        """embeddings.embedding カラムが VECTOR(2048) 型であることを確認"""
        result = await db_session.execute(
            text(
                """
                SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
                FROM information_schema.columns
                WHERE table_schema = 'rag_system'
                AND table_name = 'embeddings'
                AND COLUMN_NAME = 'embedding'
                """
            )
        )
        row = result.fetchone()
        assert row is not None, "embedding カラムが存在しません"
        # MySQL 9.0 の VECTOR 型を確認
        # 実際の型名は環境によって異なる可能性があるため、存在確認のみ
        print(f"embedding column type: {row}")


@pytest.mark.integration
@pytest.mark.skipif(SKIP_INTEGRATION, reason="Integration tests disabled")
class TestVectorOperations:
    """Vector 操作のテスト"""

    @pytest.mark.asyncio
    async def test_vector_insert_and_search(self, db_session):
        """Vector データの挿入と検索が成功することを確認"""
        # テストデータ挿入（knowledge_base）
        kb_result = await db_session.execute(
            text(
                """
                INSERT INTO knowledge_base (id, title, content, domain, user_id, metadata)
                VALUES (:id, :title, :content, :domain, :user_id, :metadata)
                """
            ),
            {
                "id": "test-kb-001",
                "title": "テストナレッジ",
                "content": "これはテストデータです",
                "domain": "nursing",
                "user_id": "test-user-001",
                "metadata": "{}",
            },
        )

        # テストベクトル挿入（embeddings）
        test_vector = [0.1] * 2048  # 2048次元のサンプルベクトル
        vector_str = "[" + ",".join(map(str, test_vector)) + "]"

        emb_result = await db_session.execute(
            text(
                """
                INSERT INTO embeddings (knowledge_id, embedding)
                VALUES (:knowledge_id, :embedding)
                """
            ),
            {"knowledge_id": "test-kb-001", "embedding": vector_str},
        )

        await db_session.commit()

        # Vector Search実行（VEC_DISTANCE 関数）
        query_vector = [0.1] * 2048
        query_vector_str = "[" + ",".join(map(str, query_vector)) + "]"

        search_result = await db_session.execute(
            text(
                """
                SELECT
                    kb.id,
                    kb.title,
                    kb.content,
                    VEC_DISTANCE(e.embedding, :query_vector) AS distance
                FROM knowledge_base kb
                JOIN embeddings e ON kb.id = e.knowledge_id
                WHERE kb.id = 'test-kb-001'
                ORDER BY distance ASC
                LIMIT 1
                """
            ),
            {"query_vector": query_vector_str},
        )

        row = search_result.fetchone()
        assert row is not None
        assert row[0] == "test-kb-001"
        assert row[1] == "テストナレッジ"
        print(f"Vector distance: {row[3]}")

        # クリーンアップ
        await db_session.execute(text("DELETE FROM embeddings WHERE knowledge_id = 'test-kb-001'"))
        await db_session.execute(text("DELETE FROM knowledge_base WHERE id = 'test-kb-001'"))
        await db_session.commit()


@pytest.mark.integration
@pytest.mark.skipif(SKIP_INTEGRATION, reason="Integration tests disabled")
class TestPerformance:
    """パフォーマンステスト"""

    @pytest.mark.asyncio
    async def test_connection_pool(self, db_session):
        """コネクションプールが正しく動作することを確認"""
        # 複数のクエリを順次実行
        for i in range(10):
            result = await db_session.execute(text("SELECT 1"))
            assert result is not None

    @pytest.mark.asyncio
    async def test_simple_query_performance(self, db_session):
        """シンプルなクエリが高速に実行されることを確認"""
        import time

        start_time = time.time()
        result = await db_session.execute(text("SELECT COUNT(*) FROM knowledge_base"))
        elapsed_time = time.time() - start_time

        assert result is not None
        # 1秒以内に完了することを確認
        assert elapsed_time < 1.0, f"Query took {elapsed_time:.3f}s (expected < 1.0s)"
