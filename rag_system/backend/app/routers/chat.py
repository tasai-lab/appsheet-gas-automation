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
                # TODO: Phase 3.3-3.4で実装
                # 1. コンテキスト検索
                # 2. Gemini API呼び出し
                # 3. ストリーミングレスポンス

                # Stub実装
                yield {
                    "event": "message",
                    "data": StreamChunk(
                        type="text",
                        content="これはテストレスポンスです。Phase 3.4で実装予定。"
                    ).model_dump_json()
                }

                yield {
                    "event": "message",
                    "data": StreamChunk(
                        type="done",
                        content=None
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

        # TODO: Phase 3.3-3.4で実装

        # Stub実装
        return ChatResponse(
            session_id=session_id,
            message=ChatMessage(
                role="assistant",
                content="これはテストレスポンスです。Phase 3.4で実装予定。",
                timestamp=datetime.utcnow()
            ),
            context=[],
            suggested_terms=[],
            processing_time_ms=(time.time() - start_time) * 1000
        )

    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
