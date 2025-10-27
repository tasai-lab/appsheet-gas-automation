"""
チャットエンドポイント
"""

import logging
import time
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from sse_starlette.sse import EventSourceResponse

from app.config import get_settings
from app.models.request import ChatRequest
from app.models.response import ChatMessage, ChatResponse, StreamChunk

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()


@router.post(
    "/stream",
    response_class=EventSourceResponse,
    status_code=status.HTTP_200_OK,
    summary="ストリーミングチャット",
    description="SSEによるストリーミングチャット応答"
)
async def chat_stream(request: ChatRequest):
    """
    ストリーミングチャット

    Args:
        request: チャットリクエスト

    Returns:
        EventSourceResponse: SSEストリーム

    Raises:
        HTTPException: チャットエラー時
    """
    start_time = time.time()

    try:
        logger.info(f"Chat message: {request.message}")

        # セッションID生成
        session_id = request.session_id or str(uuid.uuid4())

        async def event_generator():
            """SSEイベントジェネレーター"""
            try:
                # 1. コンテキスト検索
                from app.services.rag_engine import get_hybrid_search_engine
                from app.services.gemini_service import get_gemini_service
                from app.models.response import KnowledgeItem

                engine = get_hybrid_search_engine()
                gemini_service = get_gemini_service()

                # Hybrid Search実行
                search_result = engine.search(
                    query=request.message,
                    domain=request.domain,
                    client_id=request.client_id,
                    top_k=request.context_size or 5
                )

                # コンテキストをStreamChunkとして送信
                context_items = [
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

                # コンテキスト送信
                yield {
                    "event": "message",
                    "data": StreamChunk(
                        type="context",
                        context=context_items
                    ).model_dump_json()
                }

                # 2. Gemini API呼び出し & ストリーミング
                async for text_chunk in gemini_service.generate_response(
                    query=request.message,
                    context=search_result.get('results', []),
                    stream=True
                ):
                    yield {
                        "event": "message",
                        "data": StreamChunk(
                            type="text",
                            content=text_chunk
                        ).model_dump_json()
                    }

                # 3. 完了通知
                yield {
                    "event": "message",
                    "data": StreamChunk(
                        type="done",
                        suggested_terms=search_result.get('suggested_terms', [])
                    ).model_dump_json()
                }

            except Exception as e:
                logger.error(f"Stream error: {e}", exc_info=True)
                yield {
                    "event": "error",
                    "data": StreamChunk(
                        type="error",
                        error=str(e)
                    ).model_dump_json()
                }

        return EventSourceResponse(event_generator())

    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post(
    "",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="チャット（非ストリーミング）",
    description="通常のチャット応答（非ストリーミング）"
)
async def chat(request: ChatRequest):
    """
    チャット（非ストリーミング）

    Args:
        request: チャットリクエスト

    Returns:
        ChatResponse: チャット応答

    Raises:
        HTTPException: チャットエラー時
    """
    start_time = time.time()

    try:
        logger.info(f"Chat message (non-streaming): {request.message}")

        # セッションID生成
        session_id = request.session_id or str(uuid.uuid4())

        # 1. コンテキスト検索
        from app.services.rag_engine import get_hybrid_search_engine
        from app.services.gemini_service import get_gemini_service
        from app.models.response import KnowledgeItem

        engine = get_hybrid_search_engine()
        gemini_service = get_gemini_service()

        # Hybrid Search実行
        search_result = engine.search(
            query=request.message,
            domain=request.domain,
            client_id=request.client_id,
            top_k=request.context_size or 5
        )

        # コンテキストアイテムを構築
        context_items = [
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

        # 2. Gemini応答生成（非ストリーミング）
        full_response = ""
        async for text_chunk in gemini_service.generate_response(
            query=request.message,
            context=search_result.get('results', []),
            stream=False
        ):
            full_response += text_chunk

        # 3. レスポンス構築
        return ChatResponse(
            session_id=session_id,
            message=ChatMessage(
                role="assistant",
                content=full_response,
                timestamp=datetime.utcnow()
            ),
            context=context_items,
            suggested_terms=search_result.get('suggested_terms', []),
            processing_time_ms=(time.time() - start_time) * 1000
        )

    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
