"""
RAG Engine V3

Cloud SQL (MySQL) + プロンプト最適化による高速・高精度なRAGエンジン

検索パイプライン:
1. プロンプト最適化（Gemini 2.5 Flash-Lite）
2. ベクトル化（gemini-embedding-001）
3. Vector Search（MySQL VECTOR型）
4. リランキング（Vertex AI Ranking API）
"""

import logging
import time
from typing import Any, Dict, List, Optional

from app.config import get_settings
from app.services.mysql_client import get_mysql_client
from app.services.prompt_optimizer import get_prompt_optimizer
from app.services.reranker import VertexAIRanker
from app.services.vertex_ai import get_vertex_ai_client

logger = logging.getLogger(__name__)
settings = get_settings()


class RAGEngineV3:
    """RAG Engine V3 - 4ステップ検索パイプライン"""

    def __init__(self):
        """初期化"""
        # 各種クライアント取得
        self.prompt_optimizer = get_prompt_optimizer()
        self.vertex_ai_client = get_vertex_ai_client()
        self.mysql_client = get_mysql_client()
        self.reranker = VertexAIRanker()

        # 設定
        self.vector_search_limit = settings.v3_vector_search_limit  # 100件
        self.rerank_top_n = settings.v3_rerank_top_n  # 20件

        logger.info("✅ RAG Engine V3 initialized")
        logger.info(f"   Vector Search Limit: {self.vector_search_limit}")
        logger.info(f"   Rerank Top N: {self.rerank_top_n}")

    async def search(
        self,
        query: str,
        client_id: Optional[str] = None,
        client_name: Optional[str] = None,
        domain: Optional[str] = None,
        top_k: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        4ステップ検索実行

        Args:
            query: ユーザークエリ
            client_id: 利用者ID
            client_name: 利用者名
            domain: ドメインフィルタ
            top_k: 最終結果数（デフォルト: 20）

        Returns:
            検索結果（results, optimized_query, metrics）

        Pipeline:
            Step 1: プロンプト最適化（< 1秒）
            Step 2: ベクトル化（< 0.5秒）
            Step 3: Vector Search（< 0.5秒）
            Step 4: リランキング（< 1秒）
            Total: < 2秒（目標）
        """
        start_time = time.time()
        top_k = top_k or self.rerank_top_n

        metrics = {
            "step1_duration": 0.0,
            "step2_duration": 0.0,
            "step3_duration": 0.0,
            "step4_duration": 0.0,
            "total_duration": 0.0,
            "step3_candidates": 0,
            "step4_results": 0,
        }

        try:
            logger.info("=" * 80)
            logger.info(f"🔍 RAG Engine V3 Search: '{query[:100]}...'")
            logger.info(f"   Client: {client_id} ({client_name})")
            logger.info(f"   Domain: {domain}")
            logger.info(f"   Top K: {top_k}")
            logger.info("=" * 80)

            # ========================================================================
            # Step 1: プロンプト最適化（Gemini 2.5 Flash-Lite）
            # ========================================================================
            logger.info("\n[Step 1/4] プロンプト最適化開始...")
            step1_start = time.time()

            optimized_query = await self.prompt_optimizer.optimize_prompt(
                raw_prompt=query, client_id=client_id, client_name=client_name
            )

            metrics["step1_duration"] = time.time() - step1_start
            logger.info(f"✅ [Step 1/4] 完了: {metrics['step1_duration']:.3f}秒")
            logger.info(f"   Original: {query[:100]}...")
            logger.info(f"   Optimized: {optimized_query[:100]}...")

            # ========================================================================
            # Step 2: ベクトル化（gemini-embedding-001）
            # ========================================================================
            logger.info("\n[Step 2/4] ベクトル化開始...")
            step2_start = time.time()

            # ★★★ Vertex AI API呼び出し: 1回のみ実行 ★★★
            query_embedding = self.vertex_ai_client.generate_query_embedding(
                query=optimized_query, output_dimensionality=2048
            )

            metrics["step2_duration"] = time.time() - step2_start
            logger.info(f"✅ [Step 2/4] 完了: {metrics['step2_duration']:.3f}秒")
            logger.info(f"   Embedding次元: {len(query_embedding)}")

            # ========================================================================
            # Step 3: Vector Search（MySQL VECTOR型）
            # ========================================================================
            logger.info("\n[Step 3/4] Vector Search開始...")
            step3_start = time.time()

            # フィルタ構築
            filters = {}
            if domain:
                filters["domain"] = domain
            if client_id:
                filters["user_id"] = client_id

            # ★★★ MySQL Vector Search: 1回のみ実行 ★★★
            candidates = await self.mysql_client.vector_search(
                query_vector=query_embedding, limit=self.vector_search_limit, filters=filters
            )

            metrics["step3_duration"] = time.time() - step3_start
            metrics["step3_candidates"] = len(candidates)
            logger.info(f"✅ [Step 3/4] 完了: {metrics['step3_duration']:.3f}秒")
            logger.info(f"   候補数: {len(candidates)}件")

            if not candidates:
                logger.warning("⚠️  候補が見つかりませんでした")
                return {
                    "query": query,
                    "optimized_query": optimized_query,
                    "results": [],
                    "metrics": metrics,
                }

            # ========================================================================
            # Step 4: リランキング（Vertex AI Ranking API）
            # ========================================================================
            logger.info("\n[Step 4/4] リランキング開始...")
            step4_start = time.time()

            # ★★★ Vertex AI Ranking API: 1回のみ実行 ★★★
            results = self.reranker.rerank(
                query=optimized_query, documents=candidates, top_n=top_k
            )

            metrics["step4_duration"] = time.time() - step4_start
            metrics["step4_results"] = len(results)
            logger.info(f"✅ [Step 4/4] 完了: {metrics['step4_duration']:.3f}秒")
            logger.info(f"   最終結果数: {len(results)}件")

            # ========================================================================
            # 統計情報
            # ========================================================================
            metrics["total_duration"] = time.time() - start_time

            logger.info("\n" + "=" * 80)
            logger.info("✅ RAG Engine V3 Search 完了")
            logger.info("=" * 80)
            logger.info(f"Total Duration: {metrics['total_duration']:.3f}秒")
            logger.info(f"  Step 1 (Optimization): {metrics['step1_duration']:.3f}秒")
            logger.info(f"  Step 2 (Vectorize):    {metrics['step2_duration']:.3f}秒")
            logger.info(f"  Step 3 (Search):       {metrics['step3_duration']:.3f}秒")
            logger.info(f"  Step 4 (Rerank):       {metrics['step4_duration']:.3f}秒")
            logger.info(f"Results: {len(results)}件")
            logger.info("=" * 80)

            return {
                "query": query,
                "optimized_query": optimized_query,
                "results": results,
                "metrics": metrics,
            }

        except Exception as e:
            logger.error(f"❌ RAG Engine V3 Search failed: {e}", exc_info=True)
            raise


# グローバルインスタンス（シングルトン）
_rag_engine_v3: Optional[RAGEngineV3] = None


def get_rag_engine_v3() -> RAGEngineV3:
    """
    RAG Engine V3取得（シングルトン）

    Returns:
        RAGEngineV3 インスタンス
    """
    global _rag_engine_v3

    if _rag_engine_v3 is None:
        _rag_engine_v3 = RAGEngineV3()

    return _rag_engine_v3
