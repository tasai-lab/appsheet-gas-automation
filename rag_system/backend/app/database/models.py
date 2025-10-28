"""
SQLAlchemy ORM モデル

Cloud SQL (MySQL) のテーブル定義
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    TIMESTAMP,
    Column,
    Date,
    Enum,
    ForeignKey,
    Index,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.mysql import BIGINT, JSON
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(AsyncAttrs, DeclarativeBase):
    """Base class for all models"""

    pass


class KnowledgeBase(Base):
    """
    ナレッジベーステーブル

    医療・看護記録、利用者情報等のテキストデータを格納
    """

    __tablename__ = "knowledge_base"

    # 主キー
    id: Mapped[str] = mapped_column(String(255), primary_key=True, comment="ナレッジID（ユニーク）")

    # 分類・メタデータ
    domain: Mapped[str] = mapped_column(String(50), nullable=False, comment="ドメイン (nursing, clients, calls, etc.)")
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, comment="ソースタイプ (spreadsheet, firestore, etc.)")
    source_table: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, comment="ソーステーブル名")
    source_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment="ソースレコードID")

    # 利用者情報
    user_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment="利用者ID (CL-00001等)")
    user_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment="利用者名（検索最適化用）")

    # コンテンツ
    title: Mapped[str] = mapped_column(String(500), nullable=False, comment="タイトル")
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="コンテンツ本文")

    # 構造化データ
    structured_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="構造化データ (JSON形式)")
    metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, comment="メタデータ (JSON形式)")
    tags: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True, comment="タグ（カンマ区切り）")
    date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True, comment="記録日付")

    # タイムスタンプ
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        comment="作成日時",
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        comment="更新日時",
    )

    # リレーションシップ
    embedding: Mapped[Optional["Embedding"]] = relationship(
        "Embedding", back_populates="knowledge_base", uselist=False
    )

    # インデックス
    __table_args__ = (
        Index("idx_domain", "domain"),
        Index("idx_user_id", "user_id"),
        Index("idx_source", "source_type", "source_table"),
        Index("idx_date", "date"),
        # FULLTEXT INDEX は DDL で定義（SQLAlchemy では直接サポートしない）
    )


class Embedding(Base):
    """
    Embeddingテーブル

    Vertex AI Embeddings (gemini-embedding-001) による 2048次元ベクトル
    """

    __tablename__ = "embeddings"

    # 外部キー（knowledge_base.idと1:1関係）
    kb_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("knowledge_base.id", ondelete="CASCADE"),
        primary_key=True,
        comment="ナレッジID（knowledge_base.id）",
    )

    # ベクトルデータ（2048次元）
    # 注意: VECTOR型はSQLAlchemyでは直接サポートされていないため、
    # 実際のベクトル検索はSQL文字列で直接実行する必要があります
    embedding: Mapped[str] = mapped_column(
        Text,  # 実際にはVECTOR(2048)型だが、SQLAlchemyではTextとして扱う
        nullable=False,
        comment="Embeddingベクトル（2048次元）",
    )

    # メタデータ
    embedding_model: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        server_default="gemini-embedding-001",
        comment="Embeddingモデル",
    )
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        comment="作成日時",
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        comment="更新日時",
    )

    # リレーションシップ
    knowledge_base: Mapped["KnowledgeBase"] = relationship(
        "KnowledgeBase", back_populates="embedding"
    )

    # VECTOR INDEX は DDL で定義（SQLAlchemy では直接サポートしない）


class Client(Base):
    """
    利用者マスタテーブル

    利用者の基本情報と医療情報を管理
    """

    __tablename__ = "clients"

    # 主キー
    client_id: Mapped[str] = mapped_column(
        String(255), primary_key=True, comment="利用者ID (CL-00001等)"
    )

    # 基本情報
    client_name: Mapped[str] = mapped_column(String(255), nullable=False, comment="利用者名")
    client_name_kana: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="利用者名（カナ）"
    )
    birth_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True, comment="生年月日")
    gender: Mapped[Optional[str]] = mapped_column(
        Enum("male", "female", "other", name="gender_enum"),
        nullable=True,
        comment="性別",
    )

    # 医療・介護情報
    care_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, comment="介護度")
    primary_disease: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="主病名"
    )
    allergies: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="アレルギー情報")
    medications: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="服薬情報")

    # 連絡先・その他
    emergency_contact: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="緊急連絡先 (JSON形式)"
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="備考")

    # ステータス
    status: Mapped[str] = mapped_column(
        Enum("active", "inactive", "archived", name="status_enum"),
        nullable=False,
        server_default="active",
        comment="ステータス",
    )

    # タイムスタンプ
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        comment="作成日時",
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
        comment="更新日時",
    )

    # リレーションシップ
    chat_sessions: Mapped[list["ChatSession"]] = relationship(
        "ChatSession", back_populates="client"
    )

    # インデックス
    __table_args__ = (
        Index("idx_name", "client_name"),
        Index("idx_status", "status"),
    )


class ChatSession(Base):
    """
    チャットセッションテーブル

    ユーザーとのチャットセッションを管理
    """

    __tablename__ = "chat_sessions"

    # 主キー
    session_id: Mapped[str] = mapped_column(
        String(255), primary_key=True, comment="セッションID（ユニーク）"
    )

    # ユーザー・利用者情報
    user_id: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="ユーザーID（Firebase UID等）"
    )
    client_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        ForeignKey("clients.client_id", ondelete="SET NULL"),
        nullable=True,
        comment="関連利用者ID（任意）",
    )

    # セッション情報
    title: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="セッションタイトル（最初のメッセージ等）"
    )

    # タイムスタンプ
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        comment="作成日時",
    )
    last_message_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        comment="最終メッセージ日時",
    )

    # リレーションシップ
    client: Mapped[Optional["Client"]] = relationship(
        "Client", back_populates="chat_sessions"
    )
    messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage", back_populates="session"
    )

    # インデックス
    __table_args__ = (
        Index("idx_user_id", "user_id"),
        Index("idx_client_id", "client_id"),
        Index("idx_last_message", "last_message_at"),
    )


class ChatMessage(Base):
    """
    チャットメッセージテーブル

    チャットセッション内のメッセージを格納
    """

    __tablename__ = "chat_messages"

    # 主キー（自動インクリメント）
    message_id: Mapped[int] = mapped_column(
        BIGINT, primary_key=True, autoincrement=True, comment="メッセージID"
    )

    # セッション・ロール
    session_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("chat_sessions.session_id", ondelete="CASCADE"),
        nullable=False,
        comment="セッションID",
    )
    role: Mapped[str] = mapped_column(
        Enum("user", "assistant", "system", name="role_enum"),
        nullable=False,
        comment="ロール",
    )

    # メッセージ内容
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="メッセージ内容")

    # メタデータ
    context_used: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="使用したコンテキスト（検索結果等）"
    )
    metadata: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True, comment="その他メタデータ (JSON形式)"
    )

    # タイムスタンプ
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        comment="作成日時",
    )

    # リレーションシップ
    session: Mapped["ChatSession"] = relationship(
        "ChatSession", back_populates="messages"
    )

    # インデックス
    __table_args__ = (
        Index("idx_session", "session_id"),
        Index("idx_created_at", "created_at"),
    )


class VectorSearchStats(Base):
    """
    ベクトル検索統計テーブル（分析用）

    ベクトル検索のパフォーマンスと使用状況を記録
    """

    __tablename__ = "vector_search_stats"

    # 主キー（自動インクリメント）
    id: Mapped[int] = mapped_column(
        BIGINT, primary_key=True, autoincrement=True, comment="統計ID"
    )

    # 検索情報
    query: Mapped[str] = mapped_column(Text, nullable=False, comment="検索クエリ")
    user_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="ユーザーID"
    )
    client_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="利用者ID（フィルタ）"
    )

    # パフォーマンス
    result_count: Mapped[int] = mapped_column(nullable=False, comment="検索結果数")
    search_time_ms: Mapped[int] = mapped_column(nullable=False, comment="検索時間（ミリ秒）")

    # タイムスタンプ
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        comment="作成日時",
    )

    # インデックス
    __table_args__ = (
        Index("idx_user", "user_id"),
        Index("idx_client", "client_id"),
        Index("idx_created_at", "created_at"),
    )
