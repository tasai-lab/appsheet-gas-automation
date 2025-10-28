"""
チャットエンドポイント V3

RAG Engine V3を使用した高速・高精度なチャットAPI。
進捗イベント付きSSEストリーミング対応。
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime
from typing import AsyncGenerator, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sse_starlette.sse import EventSourceResponse

from app.config import get_settings
from app.middleware.auth import verify_firebase_token
from app.models.request import ChatRequest
from app.models.response import StreamChunk
from app.services.firestore_chat_history import get_firestore_chat_history_service
from app.services.gemini_service import get_gemini_service
from app.services.rag_engine_v3 import get_rag_engine_v3

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()


@router.post(
    "/stream/v3",
    status_code=status.HTTP_200_OK,
    summary="ストリーミングチャット V3",
    description="RAG Engine V3を使用したSSEストリーミングチャット（進捗イベント付き）",
)
async def chat_stream_v3(
    request: ChatRequest, user: dict = Depends(verify_firebase_token)
):
    """
    ストリーミングチャット V3

    Args:
        request: チャットリクエスト
        user: 認証済みユーザー情報

    Returns:
        EventSourceResponse: SSEストリーム

    Pipeline:
        1. optimizing - プロンプト最適化中（10%）
        2. searching - 情報を検索中（30%）
        3. reranking - 結果を最適化中（60%）
        4. generating - 回答を生成中（80%）
        5. done - 完了（100%）
    """
    start_time = time.time()

    try:
        logger.info("=" * 80)
        logger.info(f"📨 Chat V3 Request: {request.message[:100]}...")
        logger.info(f"   Session: {request.session_id}")
        logger.info(f"   Client: {request.client_id}")
        logger.info("=" * 80)

        # セッションID生成
        session_id = request.session_id or str(uuid.uuid4())

        # ユーザーID取得
        user_uid = user.get("uid") if user else "anonymous"

        # 1. ユーザーメッセージ保存（Firestore）
        if settings.use_firestore_chat_history:
            try:
                firestore_history = get_firestore_chat_history_service()
                firestore_history.save_user_message(
                    session_id=session_id,
                    user_id=user_uid,
                    message=request.message,
                    timestamp=datetime.now(),
                )
                logger.info(f"✅ User message saved - Session: {session_id}")
            except Exception as e:
                logger.error(f"⚠️ Failed to save user message: {e}", exc_info=True)

        async def event_generator() -> AsyncGenerator[Dict[str, Any], None]:
            """SSEイベントジェネレーター（V3）"""
            accumulated_response = ""
            context_ids = []

            try:
                # ================================================================
                # Stage 1: プロンプト最適化（10%）
                # ================================================================
                yield {
                    "event": "message",
                    "data": json.dumps(
                        StreamChunk(
                            type="progress",
                            status="optimizing",
                            progress=10,
                            metadata={"message": "プロンプトを最適化中..."},
                        ).model_dump()
                    ),
                }
                await asyncio.sleep(0)  # イベントループに制御を返す

                # ================================================================
                # Stage 2: RAG Engine V3 検索（30% → 60%）
                # ================================================================
                yield {
                    "event": "message",
                    "data": json.dumps(
                        StreamChunk(
                            type="progress",
                            status="searching",
                            progress=30,
                            metadata={"message": "情報を検索中..."},
                        ).model_dump()
                    ),
                }
                await asyncio.sleep(0)

                # RAG Engine V3で検索
                rag_engine = get_rag_engine_v3()

                search_result = await rag_engine.search(
                    query=request.message,
                    client_id=request.client_id,
                    client_name=None,  # TODO: client_nameを取得
                    domain=request.domain,
                    top_k=20,  # V3は20件返す
                )

                # 検索結果
                context = search_result["results"]
                optimized_query = search_result["optimized_query"]
                metrics = search_result["metrics"]

                logger.info(f"✅ RAG Engine V3 Search completed: {len(context)} results")
                logger.info(f"   Optimized Query: {optimized_query[:100]}...")
                logger.info(f"   Duration: {metrics['total_duration']:.3f}秒")

                # コンテキストIDを保存
                context_ids = [item.get("id") for item in context if item.get("id")]

                # ================================================================
                # Stage 3: リランキング完了（60%）
                # ================================================================
                yield {
                    "event": "message",
                    "data": json.dumps(
                        StreamChunk(
                            type="progress",
                            status="reranking",
                            progress=60,
                            metadata={
                                "message": "結果を最適化中...",
                                "search_duration": metrics["total_duration"],
                            },
                        ).model_dump()
                    ),
                }
                await asyncio.sleep(0)

                # ================================================================
                # Stage 4: 回答生成（80% → 100%）
                # ================================================================
                yield {
                    "event": "message",
                    "data": json.dumps(
                        StreamChunk(
                            type="progress",
                            status="generating",
                            progress=80,
                            metadata={"message": "回答を生成中..."},
                        ).model_dump()
                    ),
                }
                await asyncio.sleep(0)

                # 会話履歴取得（最新10件）
                history = []
                if settings.use_firestore_chat_history:
                    try:
                        firestore_history = get_firestore_chat_history_service()
                        history = firestore_history.get_recent_messages(
                            session_id=session_id, limit=10
                        )
                    except Exception as e:
                        logger.error(f"⚠️ Failed to fetch history: {e}")

                # Gemini Service で回答生成（ストリーミング）
                gemini_service = get_gemini_service()

                async for chunk in gemini_service.generate_response(
                    query=optimized_query,  # 最適化されたクエリを使用
                    context=context,
                    history=history,
                    stream=True,
                ):
                    accumulated_response += chunk

                    # テキストチャンクを送信
                    yield {
                        "event": "message",
                        "data": json.dumps(
                            StreamChunk(
                                type="content", content=chunk, metadata={}
                            ).model_dump()
                        ),
                    }
                    await asyncio.sleep(0)

                # ================================================================
                # Stage 5: 完了（100%）
                # ================================================================
                total_duration = time.time() - start_time

                logger.info("✅ Chat V3 completed")
                logger.info(f"   Response length: {len(accumulated_response)} chars")
                logger.info(f"   Total duration: {total_duration:.3f}秒")

                # 完了イベント送信
                yield {
                    "event": "message",
                    "data": json.dumps(
                        StreamChunk(
                            type="done",
                            status="completed",
                            progress=100,
                            metadata={
                                "total_duration": total_duration,
                                "search_duration": metrics["total_duration"],
                                "context_count": len(context),
                                "response_length": len(accumulated_response),
                            },
                        ).model_dump()
                    ),
                }

                # アシスタントメッセージ保存（Firestore）
                if settings.use_firestore_chat_history:
                    try:
                        firestore_history = get_firestore_chat_history_service()
                        firestore_history.save_assistant_message(
                            session_id=session_id,
                            message=accumulated_response,
                            context_ids=context_ids,
                            timestamp=datetime.now(),
                        )
                        logger.info(f"✅ Assistant message saved - Session: {session_id}")
                    except Exception as e:
                        logger.error(
                            f"⚠️ Failed to save assistant message: {e}", exc_info=True
                        )

            except Exception as e:
                logger.error(f"❌ Chat V3 generation failed: {e}", exc_info=True)

                # エラーイベント送信
                yield {
                    "event": "message",
                    "data": json.dumps(
                        StreamChunk(
                            type="error",
                            status="error",
                            metadata={"error": str(e), "error_type": type(e).__name__},
                        ).model_dump()
                    ),
                }

        # EventSourceResponse を返す（SSEストリーミング）
        return EventSourceResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # nginxバッファリング無効化
            },
        )

    except Exception as e:
        logger.error(f"❌ Chat V3 request failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": str(e), "error_type": type(e).__name__},
        )
