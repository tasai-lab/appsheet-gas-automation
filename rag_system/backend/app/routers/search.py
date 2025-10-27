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

        # TODO: Phase 3.3でHybrid Search実装
        # 1. クエリから医療用語抽出
        # 2. BM25検索
        # 3. Dense Retrieval
        # 4. Vertex AI Ranking APIでリランキング

        # Stub実装
        return SearchResponse(
            query=request.query,
            results=[],
            total_count=0,
            processing_time_ms=(time.time() - start_time) * 1000,
            reranked=False,
            suggested_terms=[]
        )

    except Exception as e:
        logger.error(f"Search error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
