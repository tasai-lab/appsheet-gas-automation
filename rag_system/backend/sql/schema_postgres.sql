-- =============================================================================
-- RAG System V3 - PostgreSQL + pgvector Database Schema
-- =============================================================================
-- Created: 2025-10-28
-- Version: 3.0.0
-- Database: Cloud SQL for PostgreSQL 15
-- Vector Extension: pgvector 0.8.0
-- Embedding Dimension: 2048 (Firestore Vector Search互換)
--
-- 主要な変更点（MySQL V3 → PostgreSQL V3）:
-- - pgvector拡張使用（vector(2048)型）
-- - HNSWインデックス使用（高速ベクトル検索）
-- - PostgreSQL特有の機能活用（GIN index、to_tsvector等）
-- =============================================================================

-- pgvector拡張有効化（既に有効化済みの場合はスキップ）
CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- 1. knowledge_base テーブル（ナレッジベース）
-- -----------------------------------------------------------------------------
-- 医療・看護記録、利用者情報等のテキストデータを格納
-- Vertex AI Embeddings による検索対象データ

CREATE TABLE IF NOT EXISTS knowledge_base (
    -- 主キー
    id VARCHAR(255) PRIMARY KEY,

    -- 分類・メタデータ
    domain VARCHAR(50) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    source_table VARCHAR(100),
    source_id VARCHAR(255),

    -- 利用者情報
    user_id VARCHAR(255),
    user_name VARCHAR(255),

    -- コンテンツ
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,

    -- 構造化データ
    structured_data JSONB,
    metadata JSONB,
    tags VARCHAR(1000),
    date DATE,

    -- RAGベストプラクティス: チャンク管理
    chunk_id VARCHAR(255),
    chunk_index INT DEFAULT 0,
    total_chunks INT DEFAULT 1,
    parent_doc_id VARCHAR(255),

    -- RAGベストプラクティス: 文書分類
    document_type VARCHAR(100),
    language VARCHAR(10) DEFAULT 'ja',

    -- RAGベストプラクティス: 品質・重要度
    quality_score DECIMAL(5,4) DEFAULT 1.0,
    importance_weight DECIMAL(5,4) DEFAULT 1.0,

    -- タイムスタンプ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- インデックス（標準検索用）
CREATE INDEX IF NOT EXISTS idx_kb_domain ON knowledge_base(domain);
CREATE INDEX IF NOT EXISTS idx_kb_user_id ON knowledge_base(user_id);
CREATE INDEX IF NOT EXISTS idx_kb_source ON knowledge_base(source_type, source_table);
CREATE INDEX IF NOT EXISTS idx_kb_date ON knowledge_base(date);
CREATE INDEX IF NOT EXISTS idx_kb_chunk ON knowledge_base(parent_doc_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_kb_document_type ON knowledge_base(document_type);
CREATE INDEX IF NOT EXISTS idx_kb_language ON knowledge_base(language);

-- Hybrid Retrieval: Full-text Search用（Sparse Retrieval）
-- PostgreSQL Full-Text Search with GIN index
CREATE INDEX IF NOT EXISTS idx_kb_fulltext ON knowledge_base
USING GIN (to_tsvector('japanese', title || ' ' || content || ' ' || COALESCE(tags, '')));

-- コメント
COMMENT ON TABLE knowledge_base IS 'ナレッジベース（ベクトル検索対象データ）';
COMMENT ON COLUMN knowledge_base.id IS 'ナレッジID（ユニーク）';
COMMENT ON COLUMN knowledge_base.domain IS 'ドメイン (nursing, clients, calls, etc.)';
COMMENT ON COLUMN knowledge_base.source_type IS 'ソースタイプ (spreadsheet, firestore, etc.)';
COMMENT ON COLUMN knowledge_base.content IS 'コンテンツ本文';
COMMENT ON COLUMN knowledge_base.quality_score IS '品質スコア（0-1）';
COMMENT ON COLUMN knowledge_base.importance_weight IS '重要度重み（0-1、検索時の調整用）';

-- -----------------------------------------------------------------------------
-- 2. embeddings テーブル（ベクトルデータ）
-- -----------------------------------------------------------------------------
-- Vertex AI Embeddings (gemini-embedding-001) による 2048次元ベクトル
-- pgvector 0.8.0 の vector型を使用

CREATE TABLE IF NOT EXISTS embeddings (
    -- 外部キー（knowledge_base.idと1:1関係）
    kb_id VARCHAR(255) PRIMARY KEY,

    -- ベクトルデータ（2048次元）
    embedding vector(2048) NOT NULL,

    -- メタデータ
    embedding_model VARCHAR(100) DEFAULT 'gemini-embedding-001',
    embedding_version VARCHAR(50) DEFAULT '1.0',

    -- 品質スコア（RAGベストプラクティス）
    confidence_score DECIMAL(5,4) DEFAULT 1.0,

    -- タイムスタンプ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- 外部キー制約
    FOREIGN KEY (kb_id) REFERENCES knowledge_base(id) ON DELETE CASCADE
);

-- HNSWインデックス（高速コサイン類似度検索）
-- m: ビルド時の最大接続数（16推奨、16-64で調整可能）
-- ef_construction: インデックス構築時の探索幅（64推奨、高精度なら100-200）
CREATE INDEX IF NOT EXISTS idx_embedding_hnsw ON embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- コメント
COMMENT ON TABLE embeddings IS 'Embeddingベクトルデータ（2048次元）';
COMMENT ON COLUMN embeddings.kb_id IS 'ナレッジID（knowledge_base.id）';
COMMENT ON COLUMN embeddings.embedding IS 'Embeddingベクトル（2048次元）';
COMMENT ON COLUMN embeddings.embedding_model IS 'Embeddingモデル';
COMMENT ON COLUMN embeddings.confidence_score IS '信頼度スコア（0-1）';

-- -----------------------------------------------------------------------------
-- 3. clients テーブル（利用者マスタ）
-- -----------------------------------------------------------------------------
-- 利用者の基本情報と医療情報を管理

CREATE TABLE IF NOT EXISTS clients (
    -- 主キー
    client_id VARCHAR(255) PRIMARY KEY,

    -- 基本情報
    client_name VARCHAR(255) NOT NULL,
    client_name_kana VARCHAR(255),
    birth_date DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),

    -- 医療・介護情報
    care_level VARCHAR(50),
    primary_disease VARCHAR(500),
    allergies TEXT,
    medications TEXT,

    -- 連絡先・その他
    emergency_contact JSONB,
    notes TEXT,

    -- ステータス
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),

    -- タイムスタンプ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(client_name);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

-- コメント
COMMENT ON TABLE clients IS '利用者マスタ';
COMMENT ON COLUMN clients.client_id IS '利用者ID (CL-00001等)';
COMMENT ON COLUMN clients.client_name IS '利用者名';
COMMENT ON COLUMN clients.status IS 'ステータス (active, inactive, archived)';

-- -----------------------------------------------------------------------------
-- 4. chat_sessions テーブル（チャットセッション）
-- -----------------------------------------------------------------------------
-- ユーザーとのチャットセッションを管理

CREATE TABLE IF NOT EXISTS chat_sessions (
    -- 主キー
    session_id VARCHAR(255) PRIMARY KEY,

    -- ユーザー・利用者情報
    user_id VARCHAR(255) NOT NULL,
    client_id VARCHAR(255),

    -- セッション情報
    title VARCHAR(500),

    -- タイムスタンプ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- 外部キー制約
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE SET NULL
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON chat_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_message ON chat_sessions(last_message_at);

-- コメント
COMMENT ON TABLE chat_sessions IS 'チャットセッション';
COMMENT ON COLUMN chat_sessions.session_id IS 'セッションID（ユニーク）';
COMMENT ON COLUMN chat_sessions.user_id IS 'ユーザーID（Firebase UID等）';
COMMENT ON COLUMN chat_sessions.client_id IS '関連利用者ID（任意）';

-- -----------------------------------------------------------------------------
-- 5. chat_messages テーブル（チャットメッセージ）
-- -----------------------------------------------------------------------------
-- チャットセッション内のメッセージを格納

CREATE TABLE IF NOT EXISTS chat_messages (
    -- 主キー（自動インクリメント）
    message_id BIGSERIAL PRIMARY KEY,

    -- セッション・ロール
    session_id VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),

    -- メッセージ内容
    content TEXT NOT NULL,

    -- メタデータ
    context_used JSONB,
    metadata JSONB,

    -- タイムスタンプ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- 外部キー制約
    FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON chat_messages(created_at);

-- コメント
COMMENT ON TABLE chat_messages IS 'チャットメッセージ';
COMMENT ON COLUMN chat_messages.message_id IS 'メッセージID';
COMMENT ON COLUMN chat_messages.session_id IS 'セッションID';
COMMENT ON COLUMN chat_messages.role IS 'ロール (user, assistant, system)';
COMMENT ON COLUMN chat_messages.content IS 'メッセージ内容';

-- -----------------------------------------------------------------------------
-- 6. vector_search_stats テーブル（ベクトル検索統計）
-- -----------------------------------------------------------------------------
-- ベクトル検索のパフォーマンスと使用状況を記録（分析用）

CREATE TABLE IF NOT EXISTS vector_search_stats (
    -- 主キー（自動インクリメント）
    id BIGSERIAL PRIMARY KEY,

    -- 検索情報
    query TEXT NOT NULL,
    user_id VARCHAR(255),
    client_id VARCHAR(255),

    -- パフォーマンス
    result_count INT NOT NULL,
    search_time_ms INT NOT NULL,

    -- タイムスタンプ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_stats_user ON vector_search_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_stats_client ON vector_search_stats(client_id);
CREATE INDEX IF NOT EXISTS idx_stats_created_at ON vector_search_stats(created_at);

-- コメント
COMMENT ON TABLE vector_search_stats IS 'ベクトル検索統計（分析用）';
COMMENT ON COLUMN vector_search_stats.query IS '検索クエリ';
COMMENT ON COLUMN vector_search_stats.search_time_ms IS '検索時間（ミリ秒）';

-- =============================================================================
-- トリガー: updated_at 自動更新
-- =============================================================================
-- PostgreSQLではON UPDATE CURRENT_TIMESTAMPがサポートされていないため、
-- トリガーで実装

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- knowledge_base テーブルのトリガー
CREATE TRIGGER update_kb_updated_at BEFORE UPDATE ON knowledge_base
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- embeddings テーブルのトリガー
CREATE TRIGGER update_embeddings_updated_at BEFORE UPDATE ON embeddings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- clients テーブルのトリガー
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 初期データ・制約チェック
-- =============================================================================

-- pgvectorバージョン確認
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- テーブル一覧確認
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- =============================================================================
-- 注意事項
-- =============================================================================
-- 1. pgvector (vector(2048)) は PostgreSQL 11+ でサポート
-- 2. HNSW インデックスはpgvector 0.5.0+でサポート
-- 3. m=16, ef_construction=64 はバランスの取れた設定（調整可能）
-- 4. Firestore Vector Search からの移行時は embedding_dimension=2048 を維持
-- 5. 外部キー制約により、親レコード削除時に自動的に関連データも削除される
-- 6. PostgreSQL Full-Text Search は 'japanese' 辞書を使用
-- 7. JSONB型はJSON型より高速（インデックス対応）
-- 8. updated_at自動更新はトリガーで実装
-- =============================================================================
