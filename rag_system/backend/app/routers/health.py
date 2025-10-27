"""
ヘルスチェックエンドポイント
"""

import logging
from datetime import datetime

from fastapi import APIRouter, status

from app.config import get_settings
from app.models.response import HealthResponse

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()


@router.get(
    "",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="ヘルスチェック",
    description="APIサーバーの稼働状態を確認します"
)
async def health_check():
    """
    ヘルスチェック

    Returns:
        HealthResponse: ヘルスチェック結果
    """
    # TODO: 各コンポーネントのヘルスチェック実装
    checks = {
        "api": True,
        "vertex_ai": True,  # TODO: Vertex AI接続確認
        "vector_db": True,  # TODO: Spreadsheet接続確認
        "ranking_api": True,  # TODO: Ranking API確認
    }

    all_healthy = all(checks.values())

    return HealthResponse(
        status="healthy" if all_healthy else "unhealthy",
        version=settings.app_version,
        timestamp=datetime.utcnow(),
        checks=checks,
        details={
            "gcp_project": settings.gcp_project_id,
            "gcp_location": settings.gcp_location,
            "embeddings_model": settings.vertex_ai_embeddings_model,
            "generation_model": settings.vertex_ai_generation_model,
            "reranker": settings.reranker_model
        }
    )


@router.get(
    "/ready",
    status_code=status.HTTP_200_OK,
    summary="レディネスチェック",
    description="APIサーバーがリクエストを受け付けられる状態かを確認します"
)
async def readiness_check():
    """
    レディネスチェック（Kubernetes用）

    Returns:
        dict: レディネス状態
    """
    # TODO: 必要なリソースの準備完了確認
    return {"status": "ready"}


@router.get(
    "/live",
    status_code=status.HTTP_200_OK,
    summary="ライブネスチェック",
    description="APIサーバーが生存しているかを確認します"
)
async def liveness_check():
    """
    ライブネスチェック（Kubernetes用）

    Returns:
        dict: ライブネス状態
    """
    return {"status": "alive"}
