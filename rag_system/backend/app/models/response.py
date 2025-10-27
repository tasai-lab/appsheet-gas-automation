"""
レスポンスモデル定義
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class KnowledgeItem(BaseModel):
    """ナレッジアイテム"""

    id: str = Field(..., description="KB ID")
    domain: str = Field(..., description="ドメイン")
    source_type: Optional[str] = Field(None, description="ソースタイプ")
    source_table: Optional[str] = Field(None, description="ソーステーブル")
    source_id: Optional[str] = Field(None, description="ソースレコードID")
    title: str = Field(..., description="タイトル")
    content: str = Field(..., description="コンテンツ")
    score: float = Field(..., description="関連度スコア", ge=0.0)
    date: Optional[str] = Field(None, description="日付")
    tags: Optional[list[str]] = Field(None, description="タグ")
    metadata: Optional[dict[str, Any]] = Field(None, description="メタデータ")
    embedding: Optional[list[float]] = Field(None, description="埋め込みベクトル")


class SearchResponse(BaseModel):
    """検索レスポンス"""

    query: str = Field(..., description="検索クエリ")
    results: list[KnowledgeItem] = Field(..., description="検索結果")
    total_count: int = Field(..., description="総件数")
    processing_time_ms: float = Field(..., description="処理時間（ミリ秒）")
    reranked: bool = Field(False, description="リランキング実施済みか")
    suggested_terms: Optional[list[str]] = Field(None, description="提案された医療用語")


class ChatMessage(BaseModel):
    """チャットメッセージ"""

    role: str = Field(..., description="ロール (user/assistant)")
    content: str = Field(..., description="メッセージ内容")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="タイムスタンプ")


class ChatResponse(BaseModel):
    """チャットレスポンス"""

    session_id: str = Field(..., description="セッションID")
    message: ChatMessage = Field(..., description="アシスタントメッセージ")
    context: list[KnowledgeItem] = Field(..., description="参照したコンテキスト")
    suggested_terms: Optional[list[str]] = Field(None, description="提案された医療用語")
    processing_time_ms: float = Field(..., description="処理時間（ミリ秒）")


class StreamChunk(BaseModel):
    """ストリームチャンク"""

    type: str = Field(..., description="チャンクタイプ (text/context/done/error)")
    content: Optional[str] = Field(None, description="テキストコンテンツ")
    context: Optional[list[KnowledgeItem]] = Field(None, description="コンテキスト")
    suggested_terms: Optional[list[str]] = Field(None, description="提案された医療用語")
    error: Optional[str] = Field(None, description="エラーメッセージ")


class HealthResponse(BaseModel):
    """ヘルスチェックレスポンス"""

    status: str = Field(..., description="ステータス (healthy/unhealthy)")
    version: str = Field(..., description="バージョン")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="タイムスタンプ")
    checks: dict[str, bool] = Field(..., description="各コンポーネントのヘルスチェック結果")
    details: Optional[dict[str, Any]] = Field(None, description="詳細情報")


class ErrorResponse(BaseModel):
    """エラーレスポンス"""

    error: str = Field(..., description="エラータイプ")
    message: str = Field(..., description="エラーメッセージ")
    details: Optional[dict[str, Any]] = Field(None, description="詳細情報")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="タイムスタンプ")
