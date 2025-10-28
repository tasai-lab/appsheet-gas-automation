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
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # セキュリティ設定
    admin_api_key: str = ""  # 管理者APIキー（必須設定）
    enable_admin_endpoints: bool = True  # 管理エンドポイントの有効化

    # サーバー設定
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = False

    # CORS設定
    cors_origins: list[str] = [
        "http://localhost:3000",
        "https://rag-frontend.vercel.app",
        "https://fractal-ecosystem.web.app",
        "https://fractal-ecosystem.firebaseapp.com"
    ]
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
    vertex_ai_embeddings_model: str = "gemini-embedding-001"
    vertex_ai_embeddings_dimension: int = 2048  # Firestore Vector Search制約: 最大2048次元
    vertex_ai_embeddings_task_type: str = "RETRIEVAL_DOCUMENT"
    vertex_ai_generation_model: str = "gemini-2.5-flash"
    vertex_ai_temperature: float = 0.3
    vertex_ai_max_output_tokens: int = 2048
    vertex_ai_top_p: float = 0.95
    vertex_ai_top_k: int = 40

    # Gemini思考モード設定
    vertex_ai_enable_thinking: bool = True  # 思考モードを有効化
    vertex_ai_thinking_budget: int = -1  # -1=自動制御, 0=無効, >0=トークン数指定
    vertex_ai_include_thoughts: bool = False  # 思考要約を応答に含めるか

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
    cache_default_ttl: int = 3600  # 1時間（デフォルト）
    cache_embeddings_ttl: int = 86400  # 24時間（Embeddings）
    cache_vector_db_ttl: int = 3600  # 1時間（Vector DBデータ）
    cache_search_results_ttl: int = 1800  # 30分（検索結果）
    cache_cleanup_interval: int = 600  # 10分（クリーンアップ間隔）
    cache_max_size: int = 1000  # 最大キャッシュエントリ数

    # モニタリング設定
    enable_cloud_logging: bool = True
    enable_cloud_monitoring: bool = True
    metrics_export_interval: int = 60

    # Firebase Admin設定
    firebase_admin_credentials_path: str = ""  # サービスアカウントJSONファイルパス
    firebase_admin_credentials_json: str = ""  # サービスアカウントJSON文字列（Cloud Run用）
    require_authentication: bool = True        # 認証を必須にする

    # チャット履歴設定
    use_firestore_chat_history: bool = True   # Firestoreを使用（False=Spreadsheet使用）

    # Firestore Vector Search設定
    use_firestore_vector_search: bool = False  # Firestore Vector Search使用フラグ（Phase 4実装）
    firestore_vector_collection: str = "knowledge_base"  # Firestoreコレクション名
    firestore_vector_field: str = "embedding"  # Embeddingフィールド名
    firestore_vector_distance_measure: str = "COSINE"  # 距離計算方法
    firestore_vector_max_results: int = 1000  # 最大結果数

    # LangSmith設定
    langchain_tracing_v2: bool = False  # LangSmithトレーシング有効化
    langchain_endpoint: str = "https://api.smith.langchain.com"
    langchain_api_key: str = ""
    langchain_project: str = "RAG-Medical-Assistant"
    langsmith_sampling_rate: float = 1.0  # 0.0-1.0（1.0 = 全リクエストをトレース）

    # ================================================================
    # V3: Cloud SQL (MySQL) 設定
    # ================================================================
    # MySQL接続設定
    mysql_host: str = ""  # Cloud SQL Private IP
    mysql_port: int = 3306
    mysql_database: str = "rag_system"
    mysql_user: str = "rag_user"
    mysql_password: str = ""  # 必須設定

    # MySQL SSL設定（本番環境推奨）
    mysql_ssl_ca: str = ""  # server-ca.pem パス
    mysql_ssl_cert: str = ""  # client-cert.pem パス
    mysql_ssl_key: str = ""  # client-key.pem パス
    mysql_ssl_enabled: bool = False  # SSL接続有効化

    # MySQL コネクションプール設定（ベストプラクティス）
    mysql_pool_size: int = 20  # 最大接続数（推奨: 20-50、低レイテンシ要求時）
    mysql_pool_max_overflow: int = 10  # オーバーフロー時の追加接続数
    mysql_pool_timeout: int = 30  # プール待機タイムアウト（秒）
    mysql_pool_recycle: int = 1800  # 接続再利用時間（秒、30分、Cloud SQL推奨）
    mysql_pool_pre_ping: bool = True  # 接続前のヘルスチェック（推奨）
    mysql_echo_pool: bool = False  # プールログ出力（開発時のみTrue）

    # MySQL タイムアウト設定
    mysql_connect_timeout: int = 10  # 接続タイムアウト（秒）
    mysql_read_timeout: int = 30  # 読み取りタイムアウト（秒）
    mysql_write_timeout: int = 30  # 書き込みタイムアウト（秒）

    # V3機能フラグ
    use_rag_engine_v3: bool = False  # RAG Engine V3使用フラグ（段階的移行）
    prompt_optimizer_enabled: bool = False  # プロンプト最適化有効化

    # プロンプト最適化設定
    prompt_optimizer_model: str = "gemini-2.5-flash-lite"  # 軽量・高速モデル
    prompt_optimizer_temperature: float = 0.2  # 低温度で安定した出力
    prompt_optimizer_max_output_tokens: int = 500  # 最適化プロンプトの最大トークン数
    prompt_optimizer_cache_ttl: int = 3600  # 類似プロンプトのキャッシュTTL（秒）

    # V3検索設定
    v3_vector_search_limit: int = 100  # Vector Searchで取得する候補数
    v3_rerank_top_n: int = 20  # リランキング後の最終結果数（V2: 10件 → V3: 20件）


@lru_cache()
def get_settings() -> Settings:
    """
    設定オブジェクトを取得（シングルトン）

    Returns:
        Settings: アプリケーション設定
    """
    return Settings()
