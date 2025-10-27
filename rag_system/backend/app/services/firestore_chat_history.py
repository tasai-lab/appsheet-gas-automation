"""
Firestoreチャット履歴サービス

チャット履歴をFirestoreに保存します（低コスト・スケーラブル）。
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from firebase_admin import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

logger = logging.getLogger(__name__)


class FirestoreChatHistoryService:
    """Firestoreチャット履歴サービス"""

    def __init__(self):
        """初期化"""
        self.db = firestore.client()
        self.sessions_collection = "chat_sessions"
        logger.info("FirestoreChatHistoryService initialized")

    def save_user_message(
        self,
        session_id: str,
        user_id: str,
        message: str,
        timestamp: Optional[datetime] = None
    ):
        """
        ユーザーメッセージを保存

        Args:
            session_id: セッションID
            user_id: ユーザーID
            message: メッセージ内容
            timestamp: タイムスタンプ
        """
        if timestamp is None:
            timestamp = datetime.utcnow()

        try:
            # セッションドキュメント参照
            session_ref = self.db.collection(self.sessions_collection).document(session_id)

            # セッションが存在しない場合は作成
            if not session_ref.get().exists:
                session_ref.set({
                    'user_id': user_id,
                    'created_at': timestamp,
                    'updated_at': timestamp
                })
            else:
                # 既存セッションのupdated_at更新
                session_ref.update({'updated_at': timestamp})

            # メッセージを追加
            session_ref.collection('messages').add({
                'role': 'user',
                'content': message,
                'context_ids': [],
                'suggested_terms': [],
                'term_feedback': '',
                'timestamp': timestamp
            })

            logger.info(f"✅ User message saved to Firestore - Session: {session_id}")
        except Exception as e:
            logger.error(f"❌ Failed to save user message to Firestore: {e}", exc_info=True)

    def save_assistant_message(
        self,
        session_id: str,
        user_id: str,
        message: str,
        context_ids: List[str],
        suggested_terms: List[str],
        timestamp: Optional[datetime] = None
    ):
        """
        アシスタントメッセージを保存

        Args:
            session_id: セッションID
            user_id: ユーザーID
            message: メッセージ内容
            context_ids: 使用されたコンテキストのIDリスト
            suggested_terms: 提案された用語リスト
            timestamp: タイムスタンプ
        """
        if timestamp is None:
            timestamp = datetime.utcnow()

        try:
            # セッションドキュメント参照
            session_ref = self.db.collection(self.sessions_collection).document(session_id)

            # セッションが存在しない場合は作成
            if not session_ref.get().exists:
                session_ref.set({
                    'user_id': user_id,
                    'created_at': timestamp,
                    'updated_at': timestamp
                })
            else:
                # 既存セッションのupdated_at更新
                session_ref.update({'updated_at': timestamp})

            # メッセージを追加
            session_ref.collection('messages').add({
                'role': 'assistant',
                'content': message,
                'context_ids': context_ids,
                'suggested_terms': suggested_terms,
                'term_feedback': '',
                'timestamp': timestamp
            })

            logger.info(
                f"✅ Assistant message saved to Firestore - "
                f"Session: {session_id}, Context: {len(context_ids)} items"
            )
        except Exception as e:
            logger.error(f"❌ Failed to save assistant message to Firestore: {e}", exc_info=True)

    def save_conversation(
        self,
        session_id: str,
        user_id: str,
        user_message: str,
        assistant_message: str,
        context_ids: List[str],
        suggested_terms: List[str],
        timestamp: Optional[datetime] = None
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
            timestamp: タイムスタンプ
        """
        if timestamp is None:
            timestamp = datetime.utcnow()

        try:
            # セッションドキュメント参照
            session_ref = self.db.collection(self.sessions_collection).document(session_id)

            # セッションが存在しない場合は作成
            if not session_ref.get().exists:
                session_ref.set({
                    'user_id': user_id,
                    'created_at': timestamp,
                    'updated_at': timestamp
                })
            else:
                # 既存セッションのupdated_at更新
                session_ref.update({'updated_at': timestamp})

            # メッセージコレクション参照
            messages_ref = session_ref.collection('messages')

            # バッチ書き込みで2つのメッセージを追加
            batch = self.db.batch()

            # ユーザーメッセージ
            user_msg_ref = messages_ref.document()
            batch.set(user_msg_ref, {
                'role': 'user',
                'content': user_message,
                'context_ids': [],
                'suggested_terms': [],
                'term_feedback': '',
                'timestamp': timestamp
            })

            # アシスタントメッセージ
            assistant_msg_ref = messages_ref.document()
            batch.set(assistant_msg_ref, {
                'role': 'assistant',
                'content': assistant_message,
                'context_ids': context_ids,
                'suggested_terms': suggested_terms,
                'term_feedback': '',
                'timestamp': timestamp
            })

            # バッチコミット
            batch.commit()

            logger.info(
                f"✅ Conversation saved to Firestore - Session: {session_id}, "
                f"User: {len(user_message)} chars, Assistant: {len(assistant_message)} chars, "
                f"Context: {len(context_ids)} items"
            )
        except Exception as e:
            logger.error(f"❌ Failed to save conversation to Firestore: {e}", exc_info=True)

    def get_session_history(
        self,
        session_id: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        セッションの履歴を取得

        Args:
            session_id: セッションID
            limit: 取得する最大メッセージ数

        Returns:
            メッセージのリスト
        """
        try:
            session_ref = self.db.collection(self.sessions_collection).document(session_id)

            if not session_ref.get().exists:
                logger.warning(f"Session not found: {session_id}")
                return []

            # メッセージを取得（タイムスタンプ順）
            messages_ref = session_ref.collection('messages')
            messages = messages_ref.order_by('timestamp').limit(limit).stream()

            result = []
            for msg in messages:
                msg_data = msg.to_dict()
                msg_data['id'] = msg.id
                result.append(msg_data)

            logger.info(f"✅ Retrieved {len(result)} messages for session: {session_id}")
            return result

        except Exception as e:
            logger.error(f"❌ Failed to get session history: {e}", exc_info=True)
            return []

    def get_user_sessions(
        self,
        user_id: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        ユーザーの全セッションを取得

        Args:
            user_id: ユーザーID
            limit: 取得する最大セッション数

        Returns:
            セッションのリスト
        """
        try:
            sessions_ref = self.db.collection(self.sessions_collection)
            query = sessions_ref.where(filter=FieldFilter('user_id', '==', user_id))
            query = query.order_by('updated_at', direction=firestore.Query.DESCENDING)
            query = query.limit(limit)

            sessions = query.stream()

            result = []
            for session in sessions:
                session_data = session.to_dict()
                session_data['session_id'] = session.id
                result.append(session_data)

            logger.info(f"✅ Retrieved {len(result)} sessions for user: {user_id}")
            return result

        except Exception as e:
            logger.error(f"❌ Failed to get user sessions: {e}", exc_info=True)
            return []

    def delete_session(self, session_id: str):
        """
        セッションを削除（メッセージも含む）

        Args:
            session_id: セッションID
        """
        try:
            session_ref = self.db.collection(self.sessions_collection).document(session_id)

            # メッセージを削除
            messages_ref = session_ref.collection('messages')
            messages = messages_ref.stream()

            batch = self.db.batch()
            for msg in messages:
                batch.delete(msg.reference)

            # セッションドキュメントを削除
            batch.delete(session_ref)

            batch.commit()

            logger.info(f"✅ Session deleted: {session_id}")

        except Exception as e:
            logger.error(f"❌ Failed to delete session: {e}", exc_info=True)


# モジュールレベルのシングルトン
_firestore_chat_history_service: Optional[FirestoreChatHistoryService] = None


def get_firestore_chat_history_service() -> FirestoreChatHistoryService:
    """
    Firestoreチャット履歴サービスを取得（シングルトン）

    Returns:
        FirestoreChatHistoryService: Firestoreチャット履歴サービス
    """
    global _firestore_chat_history_service
    if _firestore_chat_history_service is None:
        _firestore_chat_history_service = FirestoreChatHistoryService()
    return _firestore_chat_history_service
