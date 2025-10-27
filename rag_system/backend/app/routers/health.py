"""
ヘルスチェックエンドポイント
"""

import logging
from datetime import datetime

from fastapi import APIRouter, status

from app.config import get_settings
from app.models.response import HealthResponse
from app.services.cache_service import get_cache_service

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


@router.get(
    "/cache/metrics",
    status_code=status.HTTP_200_OK,
    summary="キャッシュメトリクス",
    description="キャッシュの統計情報を取得します"
)
async def cache_metrics():
    """
    キャッシュメトリクス取得

    Returns:
        dict: キャッシュメトリクス
    """
    cache = get_cache_service()
    metrics = cache.get_metrics()

    return {
        "cache_enabled": settings.cache_enabled,
        "metrics": metrics,
        "config": {
            "default_ttl": settings.cache_default_ttl,
            "embeddings_ttl": settings.cache_embeddings_ttl,
            "vector_db_ttl": settings.cache_vector_db_ttl,
            "search_results_ttl": settings.cache_search_results_ttl,
        }
    }


@router.get(
    "/cache/info",
    status_code=status.HTTP_200_OK,
    summary="キャッシュ情報",
    description="キャッシュエントリの詳細情報を取得します"
)
async def cache_info(namespace: str = None):
    """
    キャッシュ情報取得

    Args:
        namespace: 名前空間フィルタ（オプション）

    Returns:
        dict: キャッシュエントリ情報
    """
    cache = get_cache_service()
    info = cache.get_cache_info(namespace)

    return {
        "namespace_filter": namespace,
        "total_entries": len(info),
        "entries": info
    }


@router.post(
    "/cache/clear",
    status_code=status.HTTP_200_OK,
    summary="キャッシュクリア",
    description="キャッシュを削除します"
)
async def cache_clear(namespace: str = None):
    """
    キャッシュクリア

    Args:
        namespace: 名前空間（指定しない場合は全てクリア）

    Returns:
        dict: クリア結果
    """
    cache = get_cache_service()

    before_count = len(cache._cache)
    cache.clear(namespace)
    after_count = len(cache._cache)
    cleared_count = before_count - after_count

    return {
        "cleared_entries": cleared_count,
        "remaining_entries": after_count,
        "namespace": namespace or "all"
    }
