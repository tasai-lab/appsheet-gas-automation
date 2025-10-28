-- =============================================================================
-- RAG System V3 - MySQL Database Schema
-- =============================================================================
-- Created: 2025-10-28
-- Version: 3.0.0
-- Database: Cloud SQL for MySQL 9.0
-- Embedding Dimension: 2048 (Firestore Vector Search互換)
--
-- 主要な変更点（V2 → V3）:
-- - embeddings テーブル追加（VECTOR(2048)型使用）
-- - chat_sessions, chat_messages テーブル追加
-- - knowledge_base テーブル構造を V3 仕様に統一
-- - clients テーブルに詳細情報カラム追加
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. knowledge_base テーブル（ナレッジベース）
-- -----------------------------------------------------------------------------
-- 医療・看護記録、利用者情報等のテキストデータを格納
-- Vertex AI Embeddings による検索対象データ

CREATE TABLE IF NOT EXISTS knowledge_base (
    -- 主キー
    id VARCHAR(255) PRIMARY KEY COMMENT 'ナレッジID（ユニーク）',

    -- 分類・メタデータ
    domain VARCHAR(50) NOT NULL COMMENT 'ドメイン (nursing, clients, calls, etc.)',
    source_type VARCHAR(50) NOT NULL COMMENT 'ソースタイプ (spreadsheet, firestore, etc.)',
    source_table VARCHAR(100) COMMENT 'ソーステーブル名',
    source_id VARCHAR(255) COMMENT 'ソースレコードID',

    -- 利用者情報
    user_id VARCHAR(255) COMMENT '利用者ID (CL-00001等)',
    user_name VARCHAR(255) COMMENT '利用者名（検索最適化用）',

    -- コンテンツ
    title VARCHAR(500) NOT NULL COMMENT 'タイトル',
    content TEXT NOT NULL COMMENT 'コンテンツ本文',

    -- 構造化データ
    structured_data JSON COMMENT '構造化データ (JSON形式)',
    metadata JSON COMMENT 'メタデータ (JSON形式)',
    tags VARCHAR(1000) COMMENT 'タグ（カンマ区切り）',
    date DATE COMMENT '記録日付',

    -- RAGベストプラクティス: チャンク管理
    chunk_id VARCHAR(255) COMMENT 'チャンクID（文書分割時のユニークID）',
    chunk_index INT DEFAULT 0 COMMENT 'チャンクインデックス（文書内の順序）',
    total_chunks INT DEFAULT 1 COMMENT '総チャンク数（同一文書の分割数）',
    parent_doc_id VARCHAR(255) COMMENT '親文書ID（分割元文書）',

    -- RAGベストプラクティス: 文書分類
    document_type VARCHAR(100) COMMENT '文書タイプ（report, record, profile, etc.）',
    language VARCHAR(10) DEFAULT 'ja' COMMENT '言語コード（ja, en, etc.）',

    -- RAGベストプラクティス: 品質・重要度
    quality_score DECIMAL(5,4) DEFAULT 1.0 COMMENT '品質スコア（0-1）',
    importance_weight DECIMAL(5,4) DEFAULT 1.0 COMMENT '重要度重み（0-1、検索時の調整用）',

    -- タイムスタンプ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',

    -- インデックス（標準検索用）
    INDEX idx_domain (domain),
    INDEX idx_user_id (user_id),
    INDEX idx_source (source_type, source_table),
    INDEX idx_date (date),
    INDEX idx_chunk (parent_doc_id, chunk_index),
    INDEX idx_document_type (document_type),
    INDEX idx_language (language),

    -- Hybrid Retrieval: Full-text Search用（Sparse Retrieval）
    FULLTEXT INDEX idx_content_fulltext (title, content, tags) WITH PARSER ngram
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='ナレッジベース（ベクトル検索対象データ）';

-- -----------------------------------------------------------------------------
-- 2. embeddings テーブル（ベクトルデータ）
-- -----------------------------------------------------------------------------
-- Vertex AI Embeddings (gemini-embedding-001) による 2048次元ベクトル
-- MySQL 9.0+ Vector Type を使用
--
-- ⚠️ VECTOR INDEXは別途作成が必要（このCREATE TABLEステートメント内では作成不可）
-- Google Cloud SQL: 専用のCREATE VECTOR INDEXステートメントを使用
-- 詳細: backend/sql/migrations/002_create_vector_index.sql

CREATE TABLE IF NOT EXISTS embeddings (
    -- 外部キー（knowledge_base.idと1:1関係）
    kb_id VARCHAR(255) PRIMARY KEY COMMENT 'ナレッジID（knowledge_base.id）',

    -- ベクトルデータ（2048次元）
    embedding VECTOR(2048) NOT NULL COMMENT 'Embeddingベクトル（2048次元）',

    -- メタデータ
    embedding_model VARCHAR(100) DEFAULT 'gemini-embedding-001' COMMENT 'Embeddingモデル',
    embedding_version VARCHAR(50) DEFAULT '1.0' COMMENT 'Embeddingバージョン',

    -- 品質スコア（RAGベストプラクティス）
    confidence_score DECIMAL(5,4) DEFAULT 1.0 COMMENT '信頼度スコア（0-1）',

    -- タイムスタンプ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',

    -- 外部キー制約
    FOREIGN KEY (kb_id) REFERENCES knowledge_base(id) ON DELETE CASCADE

    -- ⚠️ VECTOR INDEXはこの後、別途CREATE VECTOR INDEXステートメントで作成
    -- Google Cloud SQL for MySQLの場合:
    -- CREATE VECTOR INDEX idx_embedding ON embeddings(embedding)
    -- DISTANCE_TYPE = 'COSINE' OPTIONS(tree_ah_params = '{"..."}');
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='Embeddingベクトルデータ（2048次元）';

-- -----------------------------------------------------------------------------
-- 3. clients テーブル（利用者マスタ）
-- -----------------------------------------------------------------------------
-- 利用者の基本情報と医療情報を管理

CREATE TABLE IF NOT EXISTS clients (
    -- 主キー
    client_id VARCHAR(255) PRIMARY KEY COMMENT '利用者ID (CL-00001等)',

    -- 基本情報
    client_name VARCHAR(255) NOT NULL COMMENT '利用者名',
    client_name_kana VARCHAR(255) COMMENT '利用者名（カナ）',
    birth_date DATE COMMENT '生年月日',
    gender ENUM('male', 'female', 'other') COMMENT '性別',

    -- 医療・介護情報
    care_level VARCHAR(50) COMMENT '介護度',
    primary_disease VARCHAR(500) COMMENT '主病名',
    allergies TEXT COMMENT 'アレルギー情報',
    medications TEXT COMMENT '服薬情報',

    -- 連絡先・その他
    emergency_contact JSON COMMENT '緊急連絡先 (JSON形式)',
    notes TEXT COMMENT '備考',

    -- ステータス
    status ENUM('active', 'inactive', 'archived') DEFAULT 'active' COMMENT 'ステータス',

    -- タイムスタンプ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',

    -- インデックス
    INDEX idx_name (client_name),
    INDEX idx_status (status)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='利用者マスタ';

-- -----------------------------------------------------------------------------
-- 4. chat_sessions テーブル（チャットセッション）
-- -----------------------------------------------------------------------------
-- ユーザーとのチャットセッションを管理

CREATE TABLE IF NOT EXISTS chat_sessions (
    -- 主キー
    session_id VARCHAR(255) PRIMARY KEY COMMENT 'セッションID（ユニーク）',

    -- ユーザー・利用者情報
    user_id VARCHAR(255) NOT NULL COMMENT 'ユーザーID（Firebase UID等）',
    client_id VARCHAR(255) COMMENT '関連利用者ID（任意）',

    -- セッション情報
    title VARCHAR(500) COMMENT 'セッションタイトル（最初のメッセージ等）',

    -- タイムスタンプ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最終メッセージ日時',

    -- インデックス
    INDEX idx_user_id (user_id),
    INDEX idx_client_id (client_id),
    INDEX idx_last_message (last_message_at),

    -- 外部キー制約
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='チャットセッション';

-- -----------------------------------------------------------------------------
-- 5. chat_messages テーブル（チャットメッセージ）
-- -----------------------------------------------------------------------------
-- チャットセッション内のメッセージを格納

CREATE TABLE IF NOT EXISTS chat_messages (
    -- 主キー（自動インクリメント）
    message_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'メッセージID',

    -- セッション・ロール
    session_id VARCHAR(255) NOT NULL COMMENT 'セッションID',
    role ENUM('user', 'assistant', 'system') NOT NULL COMMENT 'ロール',

    -- メッセージ内容
    content TEXT NOT NULL COMMENT 'メッセージ内容',

    -- メタデータ
    context_used JSON COMMENT '使用したコンテキスト（検索結果等）',
    metadata JSON COMMENT 'その他メタデータ (JSON形式)',

    -- タイムスタンプ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',

    -- インデックス
    INDEX idx_session (session_id),
    INDEX idx_created_at (created_at),

    -- 外部キー制約
    FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='チャットメッセージ';

-- -----------------------------------------------------------------------------
-- 6. vector_search_stats テーブル（ベクトル検索統計）
-- -----------------------------------------------------------------------------
-- ベクトル検索のパフォーマンスと使用状況を記録（分析用）

CREATE TABLE IF NOT EXISTS vector_search_stats (
    -- 主キー（自動インクリメント）
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '統計ID',

    -- 検索情報
    query TEXT NOT NULL COMMENT '検索クエリ',
    user_id VARCHAR(255) COMMENT 'ユーザーID',
    client_id VARCHAR(255) COMMENT '利用者ID（フィルタ）',

    -- パフォーマンス
    result_count INT NOT NULL COMMENT '検索結果数',
    search_time_ms INT NOT NULL COMMENT '検索時間（ミリ秒）',

    -- タイムスタンプ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',

    -- インデックス
    INDEX idx_user (user_id),
    INDEX idx_client (client_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COMMENT='ベクトル検索統計（分析用）';

-- =============================================================================
-- 初期データ・制約チェック
-- =============================================================================

-- Vector Type のサポート確認（MySQL 9.0+）
-- SHOW VARIABLES LIKE 'version';  -- 手動実行推奨

-- =============================================================================
-- 注意事項
-- =============================================================================
-- 1. Vector Type (VECTOR(2048)) は MySQL 9.0+ でサポート
-- 2. VECTOR INDEX は IVF-Flat アルゴリズムを使用
-- 3. NLIST パラメータは100に設定（データ量に応じて調整可能）
-- 4. Firestore Vector Search からの移行時は embedding_dimension=2048 を維持
-- 5. 外部キー制約により、親レコード削除時に自動的に関連データも削除される
-- =============================================================================