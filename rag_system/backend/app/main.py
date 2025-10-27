"""
RAG Medical Assistant API - メインアプリケーション

医療・看護記録検索 RAGシステムのBackend APIサーバー。
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import chat, clients, health, search

# ロガー設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# 設定読み込み
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    アプリケーションライフサイクル管理

    起動時と終了時に実行される処理を定義します。
    """
    # 起動時処理
    logger.info("=" * 60)
    logger.info(f"🚀 {settings.app_name} v{settings.app_version} 起動中...")
    logger.info("=" * 60)
    logger.info(f"GCP Project: {settings.gcp_project_id}")
    logger.info(f"GCP Location: {settings.gcp_location}")
    logger.info(f"Vector DB Spreadsheet ID: {settings.vector_db_spreadsheet_id or '未設定'}")
    logger.info(f"Embeddings Model: {settings.vertex_ai_embeddings_model}")
    logger.info(f"Generation Model: {settings.vertex_ai_generation_model}")
    logger.info(f"Reranker: {settings.reranker_type} ({settings.reranker_model})")
    logger.info(f"Log Level: {settings.log_level}")
    logger.info("=" * 60)

    # TODO: 起動時の初期化処理
    # - Vertex AI クライアント初期化
    # - Vector DB 接続確認
    # - 医療用語辞書ロード

    yield

    # 終了時処理
    logger.info("=" * 60)
    logger.info(f"🛑 {settings.app_name} 終了中...")
    logger.info("=" * 60)

    # TODO: 終了時のクリーンアップ処理
    # - 接続クローズ
    # - キャッシュクリア


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
app.include_router(search.router, prefix="/search", tags=["Search"])
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
            "search": "/search",
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
