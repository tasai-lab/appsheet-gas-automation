"""
検索エンドポイント
"""

import logging
import time

from fastapi import APIRouter, HTTPException, status

from app.config import get_settings
from app.models.request import SearchRequest
from app.models.response import SearchResponse

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()


@router.post(
    "",
    response_model=SearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Hybrid Search",
    description="BM25 + Dense Retrieval + Vertex AI Ranking APIによるハイブリッド検索"
)
async def search(request: SearchRequest):
    """
    Hybrid Search

    Args:
        request: 検索リクエスト

    Returns:
        SearchResponse: 検索結果

    Raises:
        HTTPException: 検索エラー時
    """
    start_time = time.time()

    try:
        logger.info(f"Search query: {request.query}")

        # Hybrid Search エンジンを取得
        from app.services.rag_engine import get_hybrid_search_engine
        engine = get_hybrid_search_engine()

        # 検索実行
        search_result = engine.search(
            query=request.query,
            domain=request.domain,
            top_k=request.top_k
        )

        # レスポンスを構築
        from app.models.response import KnowledgeItem

        knowledge_items = [
            KnowledgeItem(
                id=result.get('id', ''),
                domain=result.get('domain', ''),
                title=result.get('title', ''),
                content=result.get('content', ''),
                score=result.get('rank_score', 0.0),
                source_type=result.get('source_type'),
                source_table=result.get('source_table'),
                source_id=result.get('source_id'),
                tags=result.get('tags', '').split(',') if result.get('tags') else []
            )
            for result in search_result.get('results', [])
        ]

        return SearchResponse(
            query=request.query,
            results=knowledge_items,
            total_count=search_result.get('total_count', 0),
            processing_time_ms=search_result.get('processing_time_ms', 0.0),
            reranked=search_result.get('reranked', False),
            suggested_terms=search_result.get('suggested_terms', [])
        )

    except Exception as e:
        logger.error(f"Search error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
