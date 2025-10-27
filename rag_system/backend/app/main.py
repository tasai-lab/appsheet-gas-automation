"""
RAG Medical Assistant API - メインアプリケーション

医療・看護記録検索 RAGシステムのBackend APIサーバー。
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import chat, clients, health
from app.services.cache_service import get_cache_service

# ロガー設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# 設定読み込み
settings = get_settings()

# グローバル変数：クリーンアップタスク
_cleanup_task = None


async def cache_cleanup_task():
    """
    キャッシュクリーンアップタスク（バックグラウンド）

    定期的に期限切れのキャッシュエントリを削除します。
    """
    cache = get_cache_service()
    cleanup_interval = settings.cache_cleanup_interval

    logger.info(f"🧹 Cache cleanup task started (interval: {cleanup_interval}s)")

    while True:
        try:
            await asyncio.sleep(cleanup_interval)
            cache.cleanup_expired()
            logger.debug(f"Cache cleanup executed (cache size: {len(cache._cache)})")
        except Exception as e:
            logger.error(f"Cache cleanup error: {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    アプリケーションライフサイクル管理

    起動時と終了時に実行される処理を定義します。
    """
    global _cleanup_task

    # 起動時処理
    logger.info("=" * 60)
    logger.info(f"🚀 {settings.app_name} v{settings.app_version} 起動中...")
    logger.info("=" * 60)
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"GCP Project: {settings.gcp_project_id}")
    logger.info(f"GCP Location: {settings.gcp_location}")
    logger.info(f"Vector DB Spreadsheet ID: {settings.vector_db_spreadsheet_id or '未設定'}")
    logger.info(f"Embeddings Model: {settings.vertex_ai_embeddings_model}")
    logger.info(f"Generation Model: {settings.vertex_ai_generation_model}")
    logger.info(f"Reranker: {settings.reranker_type} ({settings.reranker_model})")
    logger.info(f"Cache Enabled: {settings.cache_enabled}")
    logger.info(f"Cache Max Size: {settings.cache_max_size}")
    logger.info(f"Log Level: {settings.log_level}")
    logger.info(f"Authentication Required: {settings.require_authentication}")
    logger.info(f"LangSmith Tracing: {settings.langchain_tracing_v2}")
    logger.info("=" * 60)

    # Firebase Admin SDK初期化
    try:
        from app.services.firebase_admin import initialize_firebase_admin
        initialize_firebase_admin()
    except Exception as e:
        logger.error(f"Firebase Admin initialization failed: {e}")
        # 認証が必須でない場合は続行
        if settings.require_authentication:
            raise

    # キャッシュクリーンアップタスクを開始
    if settings.cache_enabled:
        _cleanup_task = asyncio.create_task(cache_cleanup_task())

    yield

    # 終了時処理
    logger.info("=" * 60)
    logger.info(f"🛑 {settings.app_name} 終了中...")
    logger.info("=" * 60)

    # クリーンアップタスクを停止
    if _cleanup_task:
        _cleanup_task.cancel()
        try:
            await _cleanup_task
        except asyncio.CancelledError:
            logger.info("Cache cleanup task stopped")

    # キャッシュをクリア
    if settings.cache_enabled:
        cache = get_cache_service()
        metrics = cache.get_metrics()
        logger.info(f"Final cache metrics: {metrics}")
        cache.clear()
        logger.info("Cache cleared")


# FastAPIアプリケーション作成
app = FastAPI(
    title=settings.app_name,
    description=settings.app_description,
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# CORSミドルウェア設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_credentials,
    allow_methods=settings.cors_methods,
    allow_headers=settings.cors_headers,
)


# ルーター登録
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(chat.router, prefix="/chat", tags=["Chat"])
app.include_router(clients.router, prefix="/clients", tags=["Clients"])


# ルートエンドポイント
@app.get("/")
async def root():
    """
    ルートエンドポイント

    APIの基本情報を返します。
    """
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "description": settings.app_description,
        "status": "running",
        "docs_url": "/docs" if settings.debug else None,
        "endpoints": {
            "health": "/health",
            "chat": "/chat/stream",
            "clients": "/clients"
        }
    }


# グローバル例外ハンドラー
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """
    グローバル例外ハンドラー

    予期しないエラーをキャッチし、適切なエラーレスポンスを返します。
    """
    logger.error(f"Unhandled exception: {exc}", exc_info=True)

    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": str(exc) if settings.debug else "An unexpected error occurred",
            "type": type(exc).__name__
        }
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower()
    )
