"""
アプリケーション設定管理

環境変数から設定を読み込み、型安全な設定オブジェクトを提供します。
"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """アプリケーション設定"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # アプリケーション基本設定
    app_name: str = "RAG Medical Assistant API"
    app_version: str = "1.0.0"
    app_description: str = "医療・看護記録検索 RAGシステム Backend API"
    debug: bool = False
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # サーバー設定
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = False

    # CORS設定
    cors_origins: list[str] = ["http://localhost:3000", "https://rag-frontend.vercel.app"]
    cors_credentials: bool = True
    cors_methods: list[str] = ["*"]
    cors_headers: list[str] = ["*"]

    # Google Cloud設定
    gcp_project_id: str = "fractal-ecosystem"
    gcp_location: str = "us-central1"
    gcp_project_number: str = "411046620715"

    # Vector DB (Google Spreadsheet)
    vector_db_spreadsheet_id: str = ""  # 作成後に設定
    vector_db_sheets: dict[str, str] = {
        "knowledge_base": "KnowledgeBase",
        "embeddings": "Embeddings",
        "medical_terms": "MedicalTerms",
        "chat_history": "ChatHistory"
    }

    # Vertex AI設定
    vertex_ai_embeddings_model: str = "text-embedding-004"
    vertex_ai_embeddings_dimension: int = 768  # 768 or 3072
    vertex_ai_embeddings_task_type: str = "RETRIEVAL_DOCUMENT"
    vertex_ai_generation_model: str = "gemini-2.5-flash"
    vertex_ai_temperature: float = 0.3
    vertex_ai_max_output_tokens: int = 2048
    vertex_ai_top_p: float = 0.95
    vertex_ai_top_k: int = 40

    # Vertex AI Ranking API設定
    reranker_type: str = "vertex_ai_ranking_api"
    reranker_model: str = "semantic-ranker-default-004"  # または semantic-ranker-fast-004
    reranker_top_n: int = 10

    # Hybrid Search設定
    search_bm25_top_k: int = 500  # BM25で取得する候補数
    search_dense_top_k: int = 50  # Dense Retrievalで取得する候補数
    search_final_top_k: int = 10  # 最終的に返す結果数
    search_bm25_weight: float = 0.3
    search_dense_weight: float = 0.7

    # 医療用語処理設定
    medical_terms_cache_ttl: int = 3600  # 1時間
    medical_terms_max_synonyms: int = 10

    # チャット設定
    chat_max_history: int = 10
    chat_context_window: int = 5
    chat_streaming_enabled: bool = True

    # パフォーマンス設定
    batch_size: int = 100
    max_concurrent_requests: int = 10
    request_timeout: int = 30

    # キャッシュ設定
    cache_enabled: bool = True
    cache_ttl: int = 300  # 5分

    # モニタリング設定
    enable_cloud_logging: bool = True
    enable_cloud_monitoring: bool = True
    metrics_export_interval: int = 60


@lru_cache()
def get_settings() -> Settings:
    """
    設定オブジェクトを取得（シングルトン）

    Returns:
        Settings: アプリケーション設定
    """
    return Settings()
