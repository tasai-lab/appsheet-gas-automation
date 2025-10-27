"""
リクエストモデル定義
"""

from typing import Optional

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    """検索リクエスト"""

    query: str = Field(..., description="検索クエリ", min_length=1, max_length=500)
    domain: Optional[str] = Field(None, description="ドメインフィルタ (nursing/clients/calls/sales)")
    user_id: Optional[str] = Field(None, description="ユーザーID")
    top_k: Optional[int] = Field(10, description="返す結果数", ge=1, le=50)
    include_embeddings: bool = Field(False, description="埋め込みベクトルを含めるか")


class ChatRequest(BaseModel):
    """チャットリクエスト"""

    message: str = Field(..., description="ユーザーメッセージ", min_length=1, max_length=2000)
    session_id: Optional[str] = Field(None, description="セッションID")
    user_id: Optional[str] = Field(None, description="ユーザーID")
    client_id: Optional[str] = Field(None, description="利用者ID（特定利用者に絞り込む場合）")
    domain: Optional[str] = Field(None, description="ドメインフィルタ")
    context_ids: Optional[list[str]] = Field(None, description="コンテキストとして使用するKB ID一覧")
    context_size: Optional[int] = Field(20, description="コンテキスト取得数", ge=1, le=20)
    stream: bool = Field(True, description="ストリーミングレスポンス")


class FeedbackRequest(BaseModel):
    """フィードバックリクエスト"""

    session_id: str = Field(..., description="セッションID")
    message_id: str = Field(..., description="メッセージID")
    rating: int = Field(..., description="評価 (1-5)", ge=1, le=5)
    feedback_text: Optional[str] = Field(None, description="フィードバックテキスト", max_length=1000)
    suggested_terms: Optional[list[str]] = Field(None, description="提案された医療用語")
    term_feedback: Optional[dict[str, bool]] = Field(None, description="用語フィードバック")
