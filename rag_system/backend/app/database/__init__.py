"""
データベースモジュール

Cloud SQL (MySQL) への接続とORM管理を提供します。
"""

from app.database.connection import (
    close_db,
    db_health_check,
    db_manager,
    get_db_session,
    init_db,
)
from app.database.models import (
    Base,
    ChatMessage,
    ChatSession,
    Client,
    Embedding,
    KnowledgeBase,
    VectorSearchStats,
)

__all__ = [
    # Connection management
    "db_manager",
    "init_db",
    "close_db",
    "get_db_session",
    "db_health_check",
    # ORM Models
    "Base",
    "KnowledgeBase",
    "Embedding",
    "Client",
    "ChatSession",
    "ChatMessage",
    "VectorSearchStats",
]
