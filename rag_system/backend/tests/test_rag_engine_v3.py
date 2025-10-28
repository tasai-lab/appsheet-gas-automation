"""
RAG Engine V3 の単体テスト

テスト対象: app.services.rag_engine_v3.RAGEngineV3
"""

import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.rag_engine_v3 import RAGEngineV3


@pytest.fixture
def mock_prompt_optimizer():
    """モック PromptOptimizer を返すフィクスチャ"""
    optimizer = MagicMock()
    optimizer.optimize_prompt = AsyncMock(
        return_value="最適化されたクエリ: 利用者の状態変化について教えてください"
    )
    return optimizer


@pytest.fixture
def mock_vertex_ai_client():
    """モック VertexAIClient を返すフィクスチャ"""
    client = MagicMock()
    # 2048次元のサンプルベクトル
    client.generate_query_embedding.return_value = [0.1] * 2048
    return client


@pytest.fixture
def mock_mysql_client():
    """モック MySQLVectorClient を返すフィクスチャ"""
    client = MagicMock()
    # vector_search は async メソッド
    client.vector_search = AsyncMock(
        return_value=[
            {
                "id": "kb-001",
                "title": "利用者状態変化記録",
                "content": "利用者の状態が改善しました",
                "score": 0.95,
                "metadata": {"domain": "nursing"},
            },
            {
                "id": "kb-002",
                "title": "バイタルサイン記録",
                "content": "体温37.2度、血圧120/80",
                "score": 0.88,
                "metadata": {"domain": "nursing"},
            },
        ]
    )
    return client


@pytest.fixture
def mock_reranker():
    """モック VertexAIRanker を返すフィクスチャ"""
    reranker = MagicMock()
    # rerank メソッドは同期
    reranker.rerank.return_value = [
        {
            "id": "kb-001",
            "title": "利用者状態変化記録",
            "content": "利用者の状態が改善しました",
            "relevance_score": 0.98,
            "metadata": {"domain": "nursing"},
        },
        {
            "id": "kb-002",
            "title": "バイタルサイン記録",
            "content": "体温37.2度、血圧120/80",
            "relevance_score": 0.92,
            "metadata": {"domain": "nursing"},
        },
    ]
    return reranker


@pytest.fixture
def rag_engine_v3(
    mock_prompt_optimizer, mock_vertex_ai_client, mock_mysql_client, mock_reranker
):
    """RAGEngineV3 インスタンスを返すフィクスチャ（モック注入）"""
    with patch("app.services.rag_engine_v3.get_prompt_optimizer") as mock_get_optimizer, \
         patch("app.services.rag_engine_v3.get_vertex_ai_client") as mock_get_vertex, \
         patch("app.services.rag_engine_v3.get_mysql_client") as mock_get_mysql, \
         patch("app.services.rag_engine_v3.VertexAIRanker") as mock_ranker_class:

        mock_get_optimizer.return_value = mock_prompt_optimizer
        mock_get_vertex.return_value = mock_vertex_ai_client
        mock_get_mysql.return_value = mock_mysql_client
        mock_ranker_class.return_value = mock_reranker

        engine = RAGEngineV3()
        return engine


class TestRAGEngineV3Init:
    """RAGEngineV3 初期化テスト"""

    def test_init_success(
        self, mock_prompt_optimizer, mock_vertex_ai_client, mock_mysql_client, mock_reranker
    ):
        """初期化が成功することを確認"""
        with patch("app.services.rag_engine_v3.get_prompt_optimizer") as mock_get_optimizer, \
             patch("app.services.rag_engine_v3.get_vertex_ai_client") as mock_get_vertex, \
             patch("app.services.rag_engine_v3.get_mysql_client") as mock_get_mysql, \
             patch("app.services.rag_engine_v3.VertexAIRanker") as mock_ranker_class:

            mock_get_optimizer.return_value = mock_prompt_optimizer
            mock_get_vertex.return_value = mock_vertex_ai_client
            mock_get_mysql.return_value = mock_mysql_client
            mock_ranker_class.return_value = mock_reranker

            engine = RAGEngineV3()

            assert engine is not None
            assert engine.prompt_optimizer is not None
            assert engine.vertex_ai_client is not None
            assert engine.mysql_client is not None
            assert engine.reranker is not None
            assert engine.vector_search_limit > 0
            assert engine.rerank_top_n > 0

    def test_init_with_default_settings(
        self, mock_prompt_optimizer, mock_vertex_ai_client, mock_mysql_client, mock_reranker
    ):
        """デフォルト設定で初期化されることを確認"""
        with patch("app.services.rag_engine_v3.get_prompt_optimizer") as mock_get_optimizer, \
             patch("app.services.rag_engine_v3.get_vertex_ai_client") as mock_get_vertex, \
             patch("app.services.rag_engine_v3.get_mysql_client") as mock_get_mysql, \
             patch("app.services.rag_engine_v3.VertexAIRanker") as mock_ranker_class:

            mock_get_optimizer.return_value = mock_prompt_optimizer
            mock_get_vertex.return_value = mock_vertex_ai_client
            mock_get_mysql.return_value = mock_mysql_client
            mock_ranker_class.return_value = mock_reranker

            engine = RAGEngineV3()

            # デフォルト設定を確認（get_settings() の値）
            assert engine.vector_search_limit == 100  # デフォルト
            assert engine.rerank_top_n == 20  # デフォルト


class TestSearch:
    """search メソッドのテスト"""

    @pytest.mark.asyncio
    async def test_search_success(self, rag_engine_v3):
        """4ステップ検索が成功することを確認"""
        query = "利用者の状態変化を教えてください"

        result = await rag_engine_v3.search(query=query)

        # 基本的な戻り値の検証
        assert result is not None
        assert "query" in result
        assert "optimized_query" in result
        assert "results" in result
        assert "metrics" in result

        assert result["query"] == query
        assert result["optimized_query"] == "最適化されたクエリ: 利用者の状態変化について教えてください"
        assert len(result["results"]) == 2

        # メトリクスの検証
        metrics = result["metrics"]
        assert metrics["step1_duration"] >= 0
        assert metrics["step2_duration"] >= 0
        assert metrics["step3_duration"] >= 0
        assert metrics["step4_duration"] >= 0
        assert metrics["total_duration"] >= 0
        assert metrics["step3_candidates"] == 2
        assert metrics["step4_results"] == 2

    @pytest.mark.asyncio
    async def test_search_with_client_info(self, rag_engine_v3):
        """利用者情報付き検索が成功することを確認"""
        query = "直近の状態変化"
        client_id = "CL-00001"
        client_name = "山田太郎"

        result = await rag_engine_v3.search(
            query=query, client_id=client_id, client_name=client_name
        )

        assert result is not None
        assert result["query"] == query

        # プロンプト最適化が呼ばれたことを確認
        rag_engine_v3.prompt_optimizer.optimize_prompt.assert_called_once_with(
            raw_prompt=query, client_id=client_id, client_name=client_name
        )

    @pytest.mark.asyncio
    async def test_search_with_domain_filter(self, rag_engine_v3):
        """ドメインフィルタ付き検索が成功することを確認"""
        query = "看護記録を検索"
        domain = "nursing"

        result = await rag_engine_v3.search(query=query, domain=domain)

        assert result is not None

        # MySQL Vector Search がフィルタ付きで呼ばれたことを確認
        call_args = rag_engine_v3.mysql_client.vector_search.call_args
        assert call_args is not None
        filters = call_args.kwargs.get("filters", {})
        assert filters.get("domain") == domain

    @pytest.mark.asyncio
    async def test_search_with_top_k(self, rag_engine_v3):
        """top_k パラメータが正しく適用されることを確認"""
        query = "検索クエリ"
        top_k = 10

        result = await rag_engine_v3.search(query=query, top_k=top_k)

        assert result is not None

        # リランキングが top_k で呼ばれたことを確認
        call_args = rag_engine_v3.reranker.rerank.call_args
        assert call_args is not None
        assert call_args.kwargs.get("top_n") == top_k

    @pytest.mark.asyncio
    async def test_search_empty_results(self, rag_engine_v3):
        """候補が見つからない場合の動作を確認"""
        # MySQL Vector Search が空のリストを返すように設定
        rag_engine_v3.mysql_client.vector_search = AsyncMock(return_value=[])

        query = "見つからないクエリ"
        result = await rag_engine_v3.search(query=query)

        assert result is not None
        assert result["results"] == []
        assert result["metrics"]["step3_candidates"] == 0
        assert result["metrics"]["step4_results"] == 0

        # リランキングは呼ばれないことを確認
        rag_engine_v3.reranker.rerank.assert_not_called()

    @pytest.mark.asyncio
    async def test_search_step1_error(self, rag_engine_v3):
        """Step 1 でエラーが発生した場合の動作を確認"""
        # プロンプト最適化でエラーを発生させる
        rag_engine_v3.prompt_optimizer.optimize_prompt.side_effect = Exception(
            "Prompt optimization failed"
        )

        query = "テストクエリ"

        with pytest.raises(Exception) as exc_info:
            await rag_engine_v3.search(query=query)

        assert "Prompt optimization failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_search_step2_error(self, rag_engine_v3):
        """Step 2 でエラーが発生した場合の動作を確認"""
        # ベクトル化でエラーを発生させる
        rag_engine_v3.vertex_ai_client.generate_query_embedding.side_effect = Exception(
            "Vectorization failed"
        )

        query = "テストクエリ"

        with pytest.raises(Exception) as exc_info:
            await rag_engine_v3.search(query=query)

        assert "Vectorization failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_search_step3_error(self, rag_engine_v3):
        """Step 3 でエラーが発生した場合の動作を確認"""
        # Vector Search でエラーを発生させる
        rag_engine_v3.mysql_client.vector_search.side_effect = Exception(
            "Vector search failed"
        )

        query = "テストクエリ"

        with pytest.raises(Exception) as exc_info:
            await rag_engine_v3.search(query=query)

        assert "Vector search failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_search_step4_error(self, rag_engine_v3):
        """Step 4 でエラーが発生した場合の動作を確認"""
        # リランキングでエラーを発生させる
        rag_engine_v3.reranker.rerank.side_effect = Exception("Reranking failed")

        query = "テストクエリ"

        with pytest.raises(Exception) as exc_info:
            await rag_engine_v3.search(query=query)

        assert "Reranking failed" in str(exc_info.value)


class TestSearchPipeline:
    """4ステップパイプラインの詳細テスト"""

    @pytest.mark.asyncio
    async def test_step1_prompt_optimization(self, rag_engine_v3):
        """Step 1: プロンプト最適化が正しく実行されることを確認"""
        query = "利用者の状態"
        client_id = "CL-00001"
        client_name = "山田太郎"

        await rag_engine_v3.search(
            query=query, client_id=client_id, client_name=client_name
        )

        # プロンプト最適化が正しいパラメータで呼ばれたことを確認
        rag_engine_v3.prompt_optimizer.optimize_prompt.assert_called_once_with(
            raw_prompt=query, client_id=client_id, client_name=client_name
        )

    @pytest.mark.asyncio
    async def test_step2_vectorization(self, rag_engine_v3):
        """Step 2: ベクトル化が正しく実行されることを確認"""
        query = "検索クエリ"

        await rag_engine_v3.search(query=query)

        # ベクトル化が最適化されたクエリで呼ばれたことを確認
        rag_engine_v3.vertex_ai_client.generate_query_embedding.assert_called_once_with(
            query="最適化されたクエリ: 利用者の状態変化について教えてください",
            output_dimensionality=2048,
        )

    @pytest.mark.asyncio
    async def test_step3_vector_search(self, rag_engine_v3):
        """Step 3: Vector Search が正しく実行されることを確認"""
        query = "検索クエリ"

        await rag_engine_v3.search(query=query)

        # Vector Search が正しいパラメータで呼ばれたことを確認
        call_args = rag_engine_v3.mysql_client.vector_search.call_args
        assert call_args is not None
        assert len(call_args.kwargs["query_vector"]) == 2048
        assert call_args.kwargs["limit"] == 100  # vector_search_limit

    @pytest.mark.asyncio
    async def test_step4_reranking(self, rag_engine_v3):
        """Step 4: リランキングが正しく実行されることを確認"""
        query = "検索クエリ"

        await rag_engine_v3.search(query=query)

        # リランキングが正しいパラメータで呼ばれたことを確認
        call_args = rag_engine_v3.reranker.rerank.call_args
        assert call_args is not None
        assert call_args.kwargs["query"] == "最適化されたクエリ: 利用者の状態変化について教えてください"
        assert len(call_args.kwargs["documents"]) == 2
        assert call_args.kwargs["top_n"] == 20  # rerank_top_n


class TestMetrics:
    """メトリクス記録のテスト"""

    @pytest.mark.asyncio
    async def test_metrics_all_steps_recorded(self, rag_engine_v3):
        """全ステップのメトリクスが記録されることを確認"""
        query = "テストクエリ"
        result = await rag_engine_v3.search(query=query)

        metrics = result["metrics"]

        # 全ステップの duration が記録されている
        assert "step1_duration" in metrics
        assert "step2_duration" in metrics
        assert "step3_duration" in metrics
        assert "step4_duration" in metrics
        assert "total_duration" in metrics

        # 全て >= 0
        assert metrics["step1_duration"] >= 0
        assert metrics["step2_duration"] >= 0
        assert metrics["step3_duration"] >= 0
        assert metrics["step4_duration"] >= 0
        assert metrics["total_duration"] >= 0

    @pytest.mark.asyncio
    async def test_metrics_total_duration(self, rag_engine_v3):
        """total_duration が各ステップの合計以上であることを確認"""
        query = "テストクエリ"
        result = await rag_engine_v3.search(query=query)

        metrics = result["metrics"]
        step_sum = (
            metrics["step1_duration"]
            + metrics["step2_duration"]
            + metrics["step3_duration"]
            + metrics["step4_duration"]
        )

        # total_duration は各ステップの合計以上（オーバーヘッド含む）
        assert metrics["total_duration"] >= step_sum

    @pytest.mark.asyncio
    async def test_metrics_candidates_and_results(self, rag_engine_v3):
        """候補数と結果数が正しく記録されることを確認"""
        query = "テストクエリ"
        result = await rag_engine_v3.search(query=query)

        metrics = result["metrics"]

        assert metrics["step3_candidates"] == 2  # MySQL から2件取得
        assert metrics["step4_results"] == 2  # リランキング後2件


class TestEdgeCases:
    """エッジケーステスト"""

    @pytest.mark.asyncio
    async def test_search_empty_query(self, rag_engine_v3):
        """空のクエリでも動作することを確認"""
        query = ""
        result = await rag_engine_v3.search(query=query)

        assert result is not None
        assert result["query"] == ""

    @pytest.mark.asyncio
    async def test_search_very_long_query(self, rag_engine_v3):
        """非常に長いクエリでも動作することを確認"""
        query = "利用者の状態について教えてください " * 100  # 長いクエリ
        result = await rag_engine_v3.search(query=query)

        assert result is not None
        assert result["query"] == query

    @pytest.mark.asyncio
    async def test_search_unicode_query(self, rag_engine_v3):
        """Unicode文字を含むクエリでも動作することを確認"""
        query = "利用者の体温は📈上昇傾向ですか？🤔"
        result = await rag_engine_v3.search(query=query)

        assert result is not None
        assert result["query"] == query

    @pytest.mark.asyncio
    async def test_search_all_filters(self, rag_engine_v3):
        """全フィルタを同時に適用しても動作することを確認"""
        query = "検索クエリ"
        client_id = "CL-00001"
        client_name = "山田太郎"
        domain = "nursing"
        top_k = 5

        result = await rag_engine_v3.search(
            query=query,
            client_id=client_id,
            client_name=client_name,
            domain=domain,
            top_k=top_k,
        )

        assert result is not None

        # フィルタが正しく適用されたことを確認
        call_args = rag_engine_v3.mysql_client.vector_search.call_args
        filters = call_args.kwargs.get("filters", {})
        assert filters.get("domain") == domain
        assert filters.get("user_id") == client_id


class TestPerformance:
    """パフォーマンステスト"""

    @pytest.mark.asyncio
    async def test_search_performance_under_2_seconds(self, rag_engine_v3):
        """検索が2秒以内に完了することを確認"""
        query = "テストクエリ"

        start_time = time.time()
        result = await rag_engine_v3.search(query=query)
        elapsed_time = time.time() - start_time

        # モックのため実際の処理時間は短いが、実装が正しいことを確認
        assert result is not None
        assert elapsed_time < 2.0

        # メトリクスに記録された total_duration も確認
        assert result["metrics"]["total_duration"] < 2.0

    @pytest.mark.asyncio
    async def test_search_step_durations_reasonable(self, rag_engine_v3):
        """各ステップの実行時間が妥当な範囲内であることを確認"""
        query = "テストクエリ"
        result = await rag_engine_v3.search(query=query)

        metrics = result["metrics"]

        # 各ステップが1秒以内（モック使用のため実際は非常に短い）
        assert metrics["step1_duration"] < 1.0  # プロンプト最適化
        assert metrics["step2_duration"] < 0.5  # ベクトル化
        assert metrics["step3_duration"] < 0.5  # Vector Search
        assert metrics["step4_duration"] < 1.0  # リランキング


class TestGetRAGEngineV3:
    """get_rag_engine_v3 シングルトン取得のテスト"""

    def test_get_rag_engine_v3_singleton(self):
        """シングルトンパターンが正しく動作することを確認"""
        from app.services.rag_engine_v3 import _rag_engine_v3, get_rag_engine_v3

        # グローバル変数をリセット
        import app.services.rag_engine_v3
        app.services.rag_engine_v3._rag_engine_v3 = None

        with patch("app.services.rag_engine_v3.get_prompt_optimizer"), \
             patch("app.services.rag_engine_v3.get_vertex_ai_client"), \
             patch("app.services.rag_engine_v3.get_mysql_client"), \
             patch("app.services.rag_engine_v3.VertexAIRanker"):

            engine1 = get_rag_engine_v3()
            engine2 = get_rag_engine_v3()

            # 同じインスタンスであることを確認
            assert engine1 is engine2
