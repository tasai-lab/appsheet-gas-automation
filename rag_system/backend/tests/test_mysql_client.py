"""
MySQL Vector Client の単体テスト

テスト対象: app.services.mysql_client.MySQLVectorClient
"""

import json
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.mysql_client import MySQLVectorClient, get_mysql_client


@pytest.fixture
def mysql_client():
    """MySQLVectorClient インスタンスを返すフィクスチャ"""
    return MySQLVectorClient()


@pytest.fixture
def mock_db_session():
    """モックデータベースセッションを返すフィクスチャ"""
    session = AsyncMock()
    return session


@pytest.fixture
def sample_query_vector():
    """サンプルクエリベクトル（2048次元）"""
    return [0.1] * 2048


@pytest.fixture
def sample_search_results():
    """サンプル検索結果"""
    return [
        {
            "id": "kb-001",
            "domain": "nursing",
            "source_type": "spreadsheet",
            "source_table": "nursing_records",
            "source_id": "rec-001",
            "user_id": "CL-00001",
            "user_name": "山田太郎",
            "title": "看護記録 2025-10-28",
            "content": "体温37.2度、血圧120/80、バイタルサイン安定。",
            "structured_data": {"temperature": 37.2, "blood_pressure": "120/80"},
            "metadata": {"recorder": "看護師A"},
            "tags": "バイタル,体温,血圧",
            "date": datetime(2025, 10, 28).date(),
            "created_at": datetime(2025, 10, 28, 10, 0, 0),
            "distance": 0.15,
        },
        {
            "id": "kb-002",
            "domain": "nursing",
            "source_type": "spreadsheet",
            "source_table": "nursing_records",
            "source_id": "rec-002",
            "user_id": "CL-00001",
            "user_name": "山田太郎",
            "title": "看護記録 2025-10-27",
            "content": "体温36.8度、血圧118/78、食事摂取良好。",
            "structured_data": {"temperature": 36.8, "blood_pressure": "118/78"},
            "metadata": {"recorder": "看護師B"},
            "tags": "バイタル,体温,血圧,食事",
            "date": datetime(2025, 10, 27).date(),
            "created_at": datetime(2025, 10, 27, 10, 0, 0),
            "distance": 0.25,
        },
    ]


class TestMySQLVectorClientInit:
    """MySQLVectorClient 初期化テスト"""

    def test_init_success(self, mysql_client):
        """初期化が成功することを確認"""
        assert mysql_client is not None
        assert mysql_client.collection_name == "knowledge_base"

    def test_get_mysql_client(self):
        """get_mysql_client() がインスタンスを返すことを確認"""
        client = get_mysql_client()
        assert isinstance(client, MySQLVectorClient)


class TestVectorSearch:
    """vector_search メソッドのテスト"""

    @pytest.mark.asyncio
    async def test_vector_search_success(
        self, mysql_client, sample_query_vector, sample_search_results, mock_db_session
    ):
        """Vector Search が成功することを確認"""
        # モックの設定
        mock_result = MagicMock()
        mock_result.mappings().all.return_value = sample_search_results
        mock_db_session.execute.return_value = mock_result

        # db_manager.get_session をモック
        with patch(
            "app.services.mysql_client.db_manager.get_session"
        ) as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_db_session

            # 実行
            results = await mysql_client.vector_search(
                query_vector=sample_query_vector, limit=10
            )

            # 検証
            assert len(results) == 2
            assert results[0]["id"] == "kb-001"
            assert results[0]["distance"] == 0.15
            assert results[1]["id"] == "kb-002"
            assert results[1]["distance"] == 0.25

            # SQLが実行されたことを確認
            mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_vector_search_with_filters(
        self, mysql_client, sample_query_vector, sample_search_results, mock_db_session
    ):
        """フィルタ条件付き Vector Search が成功することを確認"""
        # モックの設定
        mock_result = MagicMock()
        mock_result.mappings().all.return_value = sample_search_results
        mock_db_session.execute.return_value = mock_result

        with patch(
            "app.services.mysql_client.db_manager.get_session"
        ) as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_db_session

            # 実行
            filters = {"domain": "nursing", "user_id": "CL-00001"}
            results = await mysql_client.vector_search(
                query_vector=sample_query_vector, limit=10, filters=filters
            )

            # 検証
            assert len(results) == 2
            assert all(r["domain"] == "nursing" for r in results)
            assert all(r["user_id"] == "CL-00001" for r in results)

    @pytest.mark.asyncio
    async def test_vector_search_empty_results(
        self, mysql_client, sample_query_vector, mock_db_session
    ):
        """検索結果が0件の場合を確認"""
        # モックの設定（空の結果）
        mock_result = MagicMock()
        mock_result.mappings().all.return_value = []
        mock_db_session.execute.return_value = mock_result

        with patch(
            "app.services.mysql_client.db_manager.get_session"
        ) as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_db_session

            # 実行
            results = await mysql_client.vector_search(
                query_vector=sample_query_vector, limit=10
            )

            # 検証
            assert len(results) == 0

    @pytest.mark.asyncio
    async def test_vector_search_invalid_vector_dimension(self, mysql_client):
        """無効なベクトル次元でエラーが発生することを確認"""
        # 2048次元ではないベクトル
        invalid_vector = [0.1] * 100

        with patch(
            "app.services.mysql_client.db_manager.get_session"
        ) as mock_get_session:
            mock_session = AsyncMock()
            mock_session.execute.side_effect = Exception(
                "Vector dimension mismatch"
            )
            mock_get_session.return_value.__aenter__.return_value = mock_session

            # 実行 & 検証（エラーが発生することを確認）
            with pytest.raises(Exception) as exc_info:
                await mysql_client.vector_search(
                    query_vector=invalid_vector, limit=10
                )

            assert "Vector dimension mismatch" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_vector_search_database_error(
        self, mysql_client, sample_query_vector
    ):
        """データベースエラー時の動作を確認"""
        with patch(
            "app.services.mysql_client.db_manager.get_session"
        ) as mock_get_session:
            mock_session = AsyncMock()
            mock_session.execute.side_effect = Exception("Database connection error")
            mock_get_session.return_value.__aenter__.return_value = mock_session

            # 実行 & 検証
            with pytest.raises(Exception) as exc_info:
                await mysql_client.vector_search(
                    query_vector=sample_query_vector, limit=10
                )

            assert "Database connection error" in str(exc_info.value)


class TestGetDocumentById:
    """get_document_by_id メソッドのテスト"""

    @pytest.mark.asyncio
    async def test_get_document_by_id_success(self, mysql_client, mock_db_session):
        """ID指定でドキュメントを取得できることを確認"""
        # モックの設定
        expected_doc = {
            "id": "kb-001",
            "domain": "nursing",
            "title": "看護記録 2025-10-28",
            "content": "体温37.2度、血圧120/80、バイタルサイン安定。",
            "user_id": "CL-00001",
            "user_name": "山田太郎",
        }
        mock_result = MagicMock()
        mock_result.mappings().first.return_value = expected_doc
        mock_db_session.execute.return_value = mock_result

        with patch(
            "app.services.mysql_client.db_manager.get_session"
        ) as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_db_session

            # 実行
            result = await mysql_client.get_document_by_id("kb-001")

            # 検証
            assert result is not None
            assert result["id"] == "kb-001"
            assert result["domain"] == "nursing"
            assert result["user_id"] == "CL-00001"

    @pytest.mark.asyncio
    async def test_get_document_by_id_not_found(self, mysql_client, mock_db_session):
        """存在しないIDで None が返ることを確認"""
        # モックの設定（結果なし）
        mock_result = MagicMock()
        mock_result.mappings().first.return_value = None
        mock_db_session.execute.return_value = mock_result

        with patch(
            "app.services.mysql_client.db_manager.get_session"
        ) as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_db_session

            # 実行
            result = await mysql_client.get_document_by_id("non-existent-id")

            # 検証
            assert result is None


class TestGetDocumentsByUser:
    """get_documents_by_user メソッドのテスト"""

    @pytest.mark.asyncio
    async def test_get_documents_by_user_success(
        self, mysql_client, sample_search_results, mock_db_session
    ):
        """利用者IDでドキュメントを取得できることを確認"""
        # モックの設定
        mock_result = MagicMock()
        mock_result.mappings().all.return_value = sample_search_results
        mock_db_session.execute.return_value = mock_result

        with patch(
            "app.services.mysql_client.db_manager.get_session"
        ) as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_db_session

            # 実行
            results = await mysql_client.get_documents_by_user(
                user_id="CL-00001", limit=10
            )

            # 検証
            assert len(results) == 2
            assert all(r["user_id"] == "CL-00001" for r in results)

    @pytest.mark.asyncio
    async def test_get_documents_by_user_with_domain_filter(
        self, mysql_client, sample_search_results, mock_db_session
    ):
        """ドメインフィルタ付きで取得できることを確認"""
        # モックの設定
        mock_result = MagicMock()
        mock_result.mappings().all.return_value = sample_search_results
        mock_db_session.execute.return_value = mock_result

        with patch(
            "app.services.mysql_client.db_manager.get_session"
        ) as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_db_session

            # 実行
            results = await mysql_client.get_documents_by_user(
                user_id="CL-00001", domain="nursing", limit=10
            )

            # 検証
            assert len(results) == 2
            assert all(r["domain"] == "nursing" for r in results)
            assert all(r["user_id"] == "CL-00001" for r in results)

    @pytest.mark.asyncio
    async def test_get_documents_by_user_empty_results(
        self, mysql_client, mock_db_session
    ):
        """検索結果が0件の場合を確認"""
        # モックの設定（空の結果）
        mock_result = MagicMock()
        mock_result.mappings().all.return_value = []
        mock_db_session.execute.return_value = mock_result

        with patch(
            "app.services.mysql_client.db_manager.get_session"
        ) as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_db_session

            # 実行
            results = await mysql_client.get_documents_by_user(
                user_id="non-existent-user", limit=10
            )

            # 検証
            assert len(results) == 0


class TestHealthCheck:
    """health_check メソッドのテスト"""

    @pytest.mark.asyncio
    async def test_health_check_success(self, mysql_client, mock_db_session):
        """ヘルスチェックが成功することを確認"""
        # モックの設定
        mock_kb_result = MagicMock()
        mock_kb_result.scalar.return_value = 3151

        mock_emb_result = MagicMock()
        mock_emb_result.scalar.return_value = 3151

        mock_db_session.execute.side_effect = [mock_kb_result, mock_emb_result]

        with patch(
            "app.services.mysql_client.db_manager.get_session"
        ) as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_db_session

            # 実行
            result = await mysql_client.health_check()

            # 検証
            assert result["status"] == "healthy"
            assert result["knowledge_base_count"] == 3151
            assert result["embeddings_count"] == 3151

    @pytest.mark.asyncio
    async def test_health_check_database_error(self, mysql_client):
        """データベースエラー時のヘルスチェックを確認"""
        with patch(
            "app.services.mysql_client.db_manager.get_session"
        ) as mock_get_session:
            mock_session = AsyncMock()
            mock_session.execute.side_effect = Exception("Database connection failed")
            mock_get_session.return_value.__aenter__.return_value = mock_session

            # 実行
            result = await mysql_client.health_check()

            # 検証
            assert result["status"] == "unhealthy"
            assert "error" in result
            assert "Database connection failed" in result["error"]


# ==========================================
# パフォーマンステスト
# ==========================================


class TestPerformance:
    """パフォーマンステスト"""

    @pytest.mark.asyncio
    async def test_vector_search_performance(
        self, mysql_client, sample_query_vector, sample_search_results, mock_db_session
    ):
        """Vector Search が2秒以内に完了することを確認"""
        import time

        # モックの設定
        mock_result = MagicMock()
        mock_result.mappings().all.return_value = sample_search_results
        mock_db_session.execute.return_value = mock_result

        with patch(
            "app.services.mysql_client.db_manager.get_session"
        ) as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_db_session

            # 実行時間計測
            start_time = time.time()
            await mysql_client.vector_search(
                query_vector=sample_query_vector, limit=100
            )
            elapsed_time = time.time() - start_time

            # 検証（2秒以内）
            assert elapsed_time < 2.0


# ==========================================
# エッジケーステスト
# ==========================================


class TestEdgeCases:
    """エッジケーステスト"""

    @pytest.mark.asyncio
    async def test_vector_search_with_large_limit(
        self, mysql_client, sample_query_vector, mock_db_session
    ):
        """大きなlimit値でも動作することを確認"""
        mock_result = MagicMock()
        # 大量の結果をシミュレート
        large_results = [{"id": f"kb-{i}", "distance": i * 0.01} for i in range(1000)]
        mock_result.mappings().all.return_value = large_results
        mock_db_session.execute.return_value = mock_result

        with patch(
            "app.services.mysql_client.db_manager.get_session"
        ) as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_db_session

            # 実行（limit=1000）
            results = await mysql_client.vector_search(
                query_vector=sample_query_vector, limit=1000
            )

            # 検証
            assert len(results) == 1000

    @pytest.mark.asyncio
    async def test_vector_search_with_zero_limit(
        self, mysql_client, sample_query_vector, mock_db_session
    ):
        """limit=0 で空の結果が返ることを確認"""
        mock_result = MagicMock()
        mock_result.mappings().all.return_value = []
        mock_db_session.execute.return_value = mock_result

        with patch(
            "app.services.mysql_client.db_manager.get_session"
        ) as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_db_session

            # 実行（limit=0）
            results = await mysql_client.vector_search(
                query_vector=sample_query_vector, limit=0
            )

            # 検証
            assert len(results) == 0
