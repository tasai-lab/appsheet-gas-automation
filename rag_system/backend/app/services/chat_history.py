"""
チャット履歴サービス

チャット履歴をGoogle Spreadsheet（ChatHistoryシート）に保存します。
"""

import logging
import json
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.services.spreadsheet import get_spreadsheet_client

logger = logging.getLogger(__name__)


class ChatHistoryService:
    """チャット履歴サービス"""

    def __init__(self):
        """初期化"""
        self.spreadsheet = get_spreadsheet_client()
        self.sheet_name = "ChatHistory"
        logger.info("ChatHistoryService initialized")

    def save_user_message(
        self,
        session_id: str,
        user_id: str,
        message: str,
        timestamp: Optional[str] = None
    ):
        """
        ユーザーメッセージを保存

        Args:
            session_id: セッションID
            user_id: ユーザーID
            message: メッセージ内容
            timestamp: タイムスタンプ（ISO 8601形式）
        """
        if timestamp is None:
            timestamp = datetime.utcnow().isoformat() + "Z"

        row = [
            session_id,
            user_id,
            "user",
            message,
            "",  # context_ids
            "",  # suggested_terms
            "",  # term_feedback
            timestamp
        ]

        try:
            self.spreadsheet.append_to_sheet(self.sheet_name, [row])
            logger.info(f"✅ User message saved - Session: {session_id}")
        except Exception as e:
            logger.error(f"❌ Failed to save user message: {e}", exc_info=True)

    def save_assistant_message(
        self,
        session_id: str,
        user_id: str,
        message: str,
        context_ids: List[str],
        suggested_terms: List[str],
        timestamp: Optional[str] = None
    ):
        """
        アシスタントメッセージを保存

        Args:
            session_id: セッションID
            user_id: ユーザーID
            message: メッセージ内容
            context_ids: 使用されたコンテキストのIDリスト
            suggested_terms: 提案された用語リスト
            timestamp: タイムスタンプ（ISO 8601形式）
        """
        if timestamp is None:
            timestamp = datetime.utcnow().isoformat() + "Z"

        row = [
            session_id,
            user_id,
            "assistant",
            message,
            json.dumps(context_ids, ensure_ascii=False),
            json.dumps(suggested_terms, ensure_ascii=False),
            "",  # term_feedback
            timestamp
        ]

        try:
            self.spreadsheet.append_to_sheet(self.sheet_name, [row])
            logger.info(f"✅ Assistant message saved - Session: {session_id}, Context: {len(context_ids)} items")
        except Exception as e:
            logger.error(f"❌ Failed to save assistant message: {e}", exc_info=True)

    def save_conversation(
        self,
        session_id: str,
        user_id: str,
        user_message: str,
        assistant_message: str,
        context_ids: List[str],
        suggested_terms: List[str],
        timestamp: Optional[str] = None
    ):
        """
        会話全体を保存（ユーザーメッセージ + アシスタントメッセージ）

        Args:
            session_id: セッションID
            user_id: ユーザーID
            user_message: ユーザーメッセージ
            assistant_message: アシスタントメッセージ
            context_ids: 使用されたコンテキストのIDリスト
            suggested_terms: 提案された用語リスト
            timestamp: タイムスタンプ（ISO 8601形式）
        """
        if timestamp is None:
            timestamp = datetime.utcnow().isoformat() + "Z"

        # ユーザーメッセージ
        user_row = [
            session_id,
            user_id,
            "user",
            user_message,
            "",  # context_ids
            "",  # suggested_terms
            "",  # term_feedback
            timestamp
        ]

        # アシスタントメッセージ
        assistant_row = [
            session_id,
            user_id,
            "assistant",
            assistant_message,
            json.dumps(context_ids, ensure_ascii=False),
            json.dumps(suggested_terms, ensure_ascii=False),
            "",  # term_feedback
            timestamp
        ]

        try:
            # 2行まとめて追記
            self.spreadsheet.append_to_sheet(self.sheet_name, [user_row, assistant_row])
            logger.info(
                f"✅ Conversation saved - Session: {session_id}, "
                f"User: {len(user_message)} chars, Assistant: {len(assistant_message)} chars, "
                f"Context: {len(context_ids)} items"
            )
        except Exception as e:
            logger.error(f"❌ Failed to save conversation: {e}", exc_info=True)


# モジュールレベルのシングルトン
_chat_history_service: Optional[ChatHistoryService] = None


def get_chat_history_service() -> ChatHistoryService:
    """
    チャット履歴サービスを取得（シングルトン）

    Returns:
        ChatHistoryService: チャット履歴サービス
    """
    global _chat_history_service
    if _chat_history_service is None:
        _chat_history_service = ChatHistoryService()
    return _chat_history_service
