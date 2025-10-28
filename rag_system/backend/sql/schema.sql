-- RAG System MySQL Schema
-- Created: 2025-10-28
-- Version: 2.0.0
-- Embedding Dimension: 3072

-- ナレッジベーステーブル
CREATE TABLE IF NOT EXISTS knowledge_base (
  id VARCHAR(255) PRIMARY KEY,
  domain VARCHAR(100) NOT NULL COMMENT 'ドメイン (nursing, clients, calls, etc.)',
  source_id VARCHAR(255) COMMENT 'ソースレコードID',
  source_type VARCHAR(50) COMMENT 'ソースタイプ (spreadsheet, firestore, etc.)',
  title TEXT COMMENT 'タイトル',
  content TEXT NOT NULL COMMENT 'コンテンツ本文',
  user_id VARCHAR(100) COMMENT '利用者ID (CL-00001等)',
  user_name VARCHAR(255) COMMENT '利用者名',
  created_at DATETIME NOT NULL COMMENT '作成日時',
  updated_at DATETIME NOT NULL COMMENT '更新日時',
  metadata JSON COMMENT 'メタデータ (JSON形式)',
  embedding_id VARCHAR(255) COMMENT 'Vertex AI Vector Search インデックスID',

  INDEX idx_domain (domain),
  INDEX idx_user_id (user_id),
  INDEX idx_source_id (source_id),
  INDEX idx_created_at (created_at),
  FULLTEXT INDEX ft_content (title, content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='ナレッジベース（ベクトル検索対象）';

-- 利用者マスタ
CREATE TABLE IF NOT EXISTS clients (
  client_id VARCHAR(100) PRIMARY KEY COMMENT '利用者ID (CL-00001等)',
  client_name VARCHAR(255) NOT NULL COMMENT '利用者名',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
  metadata JSON COMMENT 'メタデータ (JSON形式)',

  INDEX idx_name (client_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='利用者マスタ';

-- チャット履歴テーブル
CREATE TABLE IF NOT EXISTS chat_history (
  id VARCHAR(255) PRIMARY KEY COMMENT 'チャットメッセージID',
  session_id VARCHAR(255) NOT NULL COMMENT 'セッションID',
  user_id VARCHAR(100) COMMENT '利用者ID',
  role ENUM('user', 'assistant') NOT NULL COMMENT 'ロール (user/assistant)',
  content TEXT NOT NULL COMMENT 'メッセージ内容',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
  metadata JSON COMMENT 'メタデータ (JSON形式)',

  INDEX idx_session (session_id),
  INDEX idx_user (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='チャット履歴';

-- ベクトル検索統計テーブル（オプション）
CREATE TABLE IF NOT EXISTS vector_search_stats (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  query TEXT NOT NULL COMMENT '検索クエリ',
  user_id VARCHAR(100) COMMENT '利用者ID',
  result_count INT NOT NULL COMMENT '検索結果数',
  search_time_ms INT NOT NULL COMMENT '検索時間（ミリ秒）',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',

  INDEX idx_user (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='ベクトル検索統計（分析用）';
