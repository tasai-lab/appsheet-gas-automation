"""
チャットエンドポイント
"""

import json
import logging
import time
import uuid
from datetime import datetime

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
import asyncio

from app.config import get_settings
from app.models.request import ChatRequest
from app.models.response import ChatMessage, ChatResponse, StreamChunk
from app.services.chat_history import get_chat_history_service
from app.services.firestore_chat_history import get_firestore_chat_history_service
from app.middleware.auth import verify_firebase_token

router = APIRouter()
logger = logging.getLogger(__name__)
settings = get_settings()


@router.post(
    "/stream",
    status_code=status.HTTP_200_OK,
    summary="ストリーミングチャット",
    description="SSEによるストリーミングチャット応答"
)
async def chat_stream(
    request: ChatRequest,
    user: dict = Depends(verify_firebase_token)
):
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
        logger.info(f"Session ID: {session_id}")

        # ユーザーID取得（認証済みユーザー）
        user_uid = user.get("uid") if user else "anonymous"

        # 1. セッション作成・ユーザーメッセージ保存（処理開始前に実行）
        if settings.use_firestore_chat_history:
            try:
                firestore_history = get_firestore_chat_history_service()
                firestore_history.save_user_message(
                    session_id=session_id,
                    user_id=user_uid,
                    message=request.message,
                    timestamp=datetime.now()
                )
                logger.info(f"✅ Session created & user message saved - Session: {session_id}")
            except Exception as history_error:
                logger.error(f"⚠️ Failed to save user message: {history_error}", exc_info=True)

        async def event_generator():
            """SSEイベントジェネレーター"""
            accumulated_response = ""  # ストリーミングレスポンスを蓄積
            context_ids = []  # コンテキストIDリスト
            suggested_terms = []  # 提案用語リスト

            try:
                logger.info("🔵 [DEBUG] Event generator started")

                # 1. コンテキスト検索
                from app.services.rag_engine import get_hybrid_search_engine
                from app.services.gemini_service import get_gemini_service
                from app.models.response import KnowledgeItem

                # ステータス: 検索開始
                search_start_time = time.time()
                logger.info("🟢 [DEBUG] About to yield search status...")
                yield {
                    "event": "message",
                    "data": json.dumps(StreamChunk(
                        type="status",
                        status="searching",
                        metadata={"message": "情報を検索中..."}
                    ).model_dump())
                }
                logger.info("✅ [DEBUG] Search status yielded successfully")

                engine = get_hybrid_search_engine()
                gemini_service = get_gemini_service()

                # ★★★ 会話履歴取得（コンテキスト化） ★★★
                history = []
                if settings.use_firestore_chat_history:
                    try:
                        firestore_history_service = get_firestore_chat_history_service()
                        history = firestore_history_service.get_session_history(
                            session_id=session_id,
                            limit=10  # 最新10件
                        )
                        logger.info(f"📚 Retrieved {len(history)} history messages for context")
                    except Exception as history_error:
                        logger.warning(f"⚠️ Failed to retrieve history: {history_error}")
                        # 履歴取得失敗してもcontinue（graceful degradation）

                # Hybrid Search実行
                search_result = await engine.search(
                    query=request.message,
                    domain=request.domain,
                    client_id=request.client_id,
                    top_k=request.context_size or 5
                )

                search_time = (time.time() - search_start_time) * 1000

                # ステータス: リランキング完了
                logger.info("🟢 [DEBUG] About to yield reranking status...")
                yield {
                    "event": "message",
                    "data": json.dumps(StreamChunk(
                        type="status",
                        status="reranking",
                        metadata={
                            "message": f"結果を最適化しました ({len(search_result.get('results', []))}件)",
                            "search_time_ms": search_time
                        }
                    ).model_dump())
                }
                logger.info("✅ [DEBUG] Reranking status yielded successfully")

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

                # チャット履歴保存用にIDを記録
                context_ids = [result.get('id', '') for result in search_result.get('results', [])]
                suggested_terms = search_result.get('suggested_terms', [])

                # コンテキスト送信
                logger.info(f"🟢 [DEBUG] About to yield context ({len(context_items)} items)...")
                yield {
                    "event": "message",
                    "data": json.dumps(StreamChunk(
                        type="context",
                        context=context_items
                    ).model_dump())
                }
                logger.info("✅ [DEBUG] Context yielded successfully")

                # ステータス: 生成開始
                generation_start_time = time.time()
                logger.info("🟢 [DEBUG] About to yield generating status...")
                yield {
                    "event": "message",
                    "data": json.dumps(StreamChunk(
                        type="status",
                        status="generating",
                        metadata={"message": "回答を生成中..."}
                    ).model_dump())
                }
                logger.info("✅ [DEBUG] Generating status yielded successfully")

                # 2. Gemini API呼び出し (ストリーミングモード + 会話履歴付き)
                logger.info("🔵 [DEBUG] Starting Gemini API call for response generation (streaming with history)...")

                text_chunk_count = 0
                async for text_chunk in gemini_service.generate_response(
                    query=request.message,
                    context=search_result.get('results', []),
                    history=history,  # ← 会話履歴を追加
                    stream=True  # ストリーミング有効化
                ):
                    if text_chunk:
                        text_chunk_count += 1
                        accumulated_response += text_chunk  # レスポンスを蓄積
                        logger.info(f"🟢 [DEBUG] About to yield text chunk #{text_chunk_count} (length: {len(text_chunk)})...")
                        yield {
                            "event": "message",
                            "data": json.dumps(StreamChunk(
                                type="text",
                                content=text_chunk
                            ).model_dump())
                        }
                        logger.info(f"✅ [DEBUG] Text chunk #{text_chunk_count} yielded successfully")

                logger.info(f"✅ [DEBUG] Gemini response completed - Total chunks: {text_chunk_count}, Total length: {len(accumulated_response)} chars")

                generation_time = (time.time() - generation_start_time) * 1000
                total_time = (time.time() - start_time) * 1000

                # 3. 完了通知
                logger.info(f"🟢 [DEBUG] About to yield completion event - Total: {total_time:.2f}ms, Search: {search_time:.2f}ms, Generation: {generation_time:.2f}ms")
                yield {
                    "event": "message",
                    "data": json.dumps(StreamChunk(
                        type="done",
                        suggested_terms=search_result.get('suggested_terms', []),
                        metadata={
                            "total_time_ms": total_time,
                            "search_time_ms": search_time,
                            "generation_time_ms": generation_time
                        }
                    ).model_dump())
                }
                logger.info("✅ [DEBUG] Completion event yielded successfully")

                # 4. チャット履歴を保存（Firestore or Spreadsheet）
                try:
                    if settings.use_firestore_chat_history:
                        # Firestoreに保存（低コスト）- user_uidを使用
                        firestore_history = get_firestore_chat_history_service()
                        firestore_history.save_assistant_message(
                            session_id=session_id,
                            user_id=user_uid,  # ← user_uidに変更
                            message=accumulated_response,
                            context_ids=context_ids,
                            suggested_terms=suggested_terms
                        )
                        logger.info(f"💾 Chat history saved to Firestore - Session: {session_id}")
                    else:
                        # Spreadsheetに保存（従来方式）
                        chat_history = get_chat_history_service()
                        chat_history.save_conversation(
                            session_id=session_id,
                            user_id=user_id,
                            user_message=request.message,
                            assistant_message=accumulated_response,
                            context_ids=context_ids,
                            suggested_terms=suggested_terms
                        )
                        logger.info(f"💾 Chat history saved to Spreadsheet - Session: {session_id}")
                except Exception as history_error:
                    # チャット履歴保存エラーは致命的ではないのでログのみ
                    logger.error(f"⚠️ Failed to save chat history: {history_error}", exc_info=True)

            except Exception as e:
                logger.error(f"Stream error: {e}", exc_info=True)
                yield {
                    "event": "error",
                    "data": json.dumps(StreamChunk(
                        type="error",
                        error=str(e)
                    ).model_dump())
                }

        # ★★★ StreamingResponseに変更 - 手動SSEフォーマット ★★★
        async def sse_wrapper():
            """SSEフォーマットラッパー - 明示的に \\n\\n 区切りを追加"""
            async for event_dict in event_generator():
                event_type = event_dict.get("event", "message")
                data = event_dict.get("data", "")

                # SSE形式: event: xxx\ndata: xxx\n\n
                sse_message = f"event: {event_type}\ndata: {data}\n\n"

                # デバッグログ
                logger.info(f"📤 [DEBUG] Sending SSE message (length: {len(sse_message)} bytes, type: {event_type})")

                yield sse_message.encode("utf-8")

                # バッファリング防止 - イベントループに制御を戻す
                await asyncio.sleep(0)

        # StreamingResponseを返す
        return StreamingResponse(
            sse_wrapper(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )

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
        search_result = await engine.search(
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

        # 3. チャット履歴を保存（Firestore or Spreadsheet）
        try:
            user_id = request.client_id or "anonymous"
            context_ids = [result.get('id', '') for result in search_result.get('results', [])]

            if settings.use_firestore_chat_history:
                # Firestoreに保存（低コスト）
                firestore_history = get_firestore_chat_history_service()
                firestore_history.save_conversation(
                    session_id=session_id,
                    user_id=user_id,
                    user_message=request.message,
                    assistant_message=full_response,
                    context_ids=context_ids,
                    suggested_terms=search_result.get('suggested_terms', [])
                )
                logger.info(f"💾 Chat history saved to Firestore - Session: {session_id}")
            else:
                # Spreadsheetに保存（従来方式）
                chat_history = get_chat_history_service()
                chat_history.save_conversation(
                    session_id=session_id,
                    user_id=user_id,
                    user_message=request.message,
                    assistant_message=full_response,
                    context_ids=context_ids,
                    suggested_terms=search_result.get('suggested_terms', [])
                )
                logger.info(f"💾 Chat history saved to Spreadsheet - Session: {session_id}")
        except Exception as history_error:
            # チャット履歴保存エラーは致命的ではないのでログのみ
            logger.error(f"⚠️ Failed to save chat history: {history_error}", exc_info=True)

        # 4. レスポンス構築
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


@router.get(
    "/sessions",
    status_code=status.HTTP_200_OK,
    summary="チャットセッション一覧取得",
    description="認証ユーザーのチャットセッション一覧を取得"
)
async def get_sessions(
    user: dict = Depends(verify_firebase_token),
    limit: int = 20
):
    """
    チャットセッション一覧を取得

    Args:
        user: Firebase認証ユーザー情報
        limit: 取得件数上限

    Returns:
        セッション一覧

    Raises:
        HTTPException: 取得エラー時
    """
    try:
        if not settings.use_firestore_chat_history:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="Chat history feature is disabled"
            )

        user_uid = user.get("uid")
        if not user_uid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )

        firestore_history = get_firestore_chat_history_service()
        sessions = firestore_history.get_user_sessions(user_uid, limit=limit)

        return {
            "sessions": sessions,
            "total": len(sessions)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get sessions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get(
    "/sessions/{session_id}/messages",
    status_code=status.HTTP_200_OK,
    summary="セッションメッセージ取得",
    description="指定セッションの全メッセージを取得"
)
async def get_session_messages(
    session_id: str,
    user: dict = Depends(verify_firebase_token),
    limit: int = 100
):
    """
    セッションのメッセージ一覧を取得

    Args:
        session_id: セッションID
        user: Firebase認証ユーザー情報
        limit: 取得件数上限

    Returns:
        メッセージ一覧

    Raises:
        HTTPException: 取得エラー時
    """
    try:
        if not settings.use_firestore_chat_history:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="Chat history feature is disabled"
            )

        user_uid = user.get("uid")
        if not user_uid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found"
            )

        firestore_history = get_firestore_chat_history_service()
        messages = firestore_history.get_session_history(session_id, limit=limit)

        # セッション所有権確認（オプショナル - セキュリティ強化）
        # TODO: セッション作成者のuser_idとリクエストユーザーのuidが一致するか確認

        return {
            "session_id": session_id,
            "messages": messages,
            "total": len(messages)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get messages for session {session_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
