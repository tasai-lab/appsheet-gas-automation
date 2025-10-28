"""
MySQL Vector Search クライアント

Cloud SQL (MySQL 9.0+) のVector型を使用した高速ベクトル検索を提供します。
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.database import db_manager

logger = logging.getLogger(__name__)
settings = get_settings()


class MySQLVectorClient:
    """MySQL Vector Search クライアント"""

    def __init__(self):
        """初期化"""
        self.collection_name = "knowledge_base"

        logger.info("MySQL Vector client initialized")

    async def vector_search(
        self,
        query_vector: List[float],
        limit: int = 100,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        MySQL Vector Search実行

        Args:
            query_vector: クエリベクトル（2048次元）
            limit: 検索結果数（デフォルト: 100）
            filters: フィルタ条件（domain, user_id）

        Returns:
            検索結果リスト（類似度順）

        Example:
            results = await client.vector_search(
                query_vector=[0.1, 0.2, ...],  # 2048次元
                limit=100,
                filters={"domain": "nursing", "user_id": "CL-00001"}
            )
        """
        start_time = time.time()

        try:
            # クエリベクトルをJSON文字列に変換
            query_vector_str = json.dumps(query_vector)

            # フィルタ条件構築
            domain_filter = filters.get("domain") if filters else None
            user_id_filter = filters.get("user_id") if filters else None

            # ★★★ Vector Search SQL（1回のみ実行） ★★★
            logger.info(
                f"[MySQLVectorClient] Vector Search開始: limit={limit}, domain={domain_filter}, user_id={user_id_filter}"
            )

            # Vector Search SQL
            # MySQL 9.0+の VEC_DISTANCE 関数を使用
            # VECTOR型のembeddingフィールドと query_vector のコサイン距離を計算
            sql = text("""
                SELECT
                    kb.id,
                    kb.domain,
                    kb.source_type,
                    kb.source_table,
                    kb.source_id,
                    kb.user_id,
                    kb.user_name,
                    kb.title,
                    kb.content,
                    kb.structured_data,
                    kb.metadata,
                    kb.tags,
                    kb.date,
                    kb.created_at,
                    VEC_DISTANCE(e.embedding, CAST(:query_vector AS VECTOR(2048)), COSINE) as distance
                FROM knowledge_base kb
                JOIN embeddings e ON kb.id = e.kb_id
                WHERE 1=1
                    AND (:domain IS NULL OR kb.domain = :domain)
                    AND (:user_id IS NULL OR kb.user_id = :user_id)
                ORDER BY distance ASC
                LIMIT :limit
            """)

            async with db_manager.get_session() as session:
                result = await session.execute(
                    sql,
                    {
                        "query_vector": query_vector_str,
                        "domain": domain_filter,
                        "user_id": user_id_filter,
                        "limit": limit,
                    },
                )

                rows = result.fetchall()

                # 結果を辞書に変換
                results = []
                for row in rows:
                    doc = {
                        "id": row[0],
                        "domain": row[1],
                        "source_type": row[2],
                        "source_table": row[3],
                        "source_id": row[4],
                        "user_id": row[5],
                        "user_name": row[6],
                        "title": row[7],
                        "content": row[8],
                        "structured_data": json.loads(row[9]) if row[9] else None,
                        "metadata": json.loads(row[10]) if row[10] else None,
                        "tags": row[11],
                        "date": row[12].isoformat() if row[12] else None,
                        "created_at": row[13].isoformat() if row[13] else None,
                        "distance": float(row[14]),
                        "similarity": 1 - float(row[14]),  # コサイン距離 → 類似度
                    }
                    results.append(doc)

            elapsed_ms = (time.time() - start_time) * 1000

            logger.info(
                f"[MySQLVectorClient] Vector Search完了: {len(results)}件, {elapsed_ms:.2f}ms"
            )

            return results

        except SQLAlchemyError as e:
            logger.error(f"[MySQLVectorClient] Vector Search失敗: {e}", exc_info=True)
            raise
        except Exception as e:
            logger.error(
                f"[MySQLVectorClient] 予期しないエラー: {e}", exc_info=True
            )
            raise

    async def get_document_by_id(self, document_id: str) -> Optional[Dict[str, Any]]:
        """
        ドキュメントIDで取得

        Args:
            document_id: ドキュメントID

        Returns:
            ドキュメント（存在しない場合はNone）
        """
        try:
            logger.info(f"[MySQLVectorClient] ドキュメント取得: id={document_id}")

            sql = text("""
                SELECT
                    kb.id,
                    kb.domain,
                    kb.source_type,
                    kb.source_table,
                    kb.source_id,
                    kb.user_id,
                    kb.user_name,
                    kb.title,
                    kb.content,
                    kb.structured_data,
                    kb.metadata,
                    kb.tags,
                    kb.date,
                    kb.created_at
                FROM knowledge_base kb
                WHERE kb.id = :id
            """)

            async with db_manager.get_session() as session:
                result = await session.execute(sql, {"id": document_id})
                row = result.fetchone()

                if not row:
                    logger.warning(f"[MySQLVectorClient] ドキュメント未検出: id={document_id}")
                    return None

                doc = {
                    "id": row[0],
                    "domain": row[1],
                    "source_type": row[2],
                    "source_table": row[3],
                    "source_id": row[4],
                    "user_id": row[5],
                    "user_name": row[6],
                    "title": row[7],
                    "content": row[8],
                    "structured_data": json.loads(row[9]) if row[9] else None,
                    "metadata": json.loads(row[10]) if row[10] else None,
                    "tags": row[11],
                    "date": row[12].isoformat() if row[12] else None,
                    "created_at": row[13].isoformat() if row[13] else None,
                }

                logger.info(f"[MySQLVectorClient] ドキュメント取得完了: {doc['title'][:50]}...")
                return doc

        except SQLAlchemyError as e:
            logger.error(f"[MySQLVectorClient] ドキュメント取得失敗: {e}", exc_info=True)
            raise

    async def get_documents_by_user(
        self, user_id: str, limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        利用者IDで検索

        Args:
            user_id: 利用者ID
            limit: 検索結果数

        Returns:
            ドキュメントリスト
        """
        try:
            logger.info(f"[MySQLVectorClient] 利用者検索: user_id={user_id}, limit={limit}")

            sql = text("""
                SELECT
                    kb.id,
                    kb.domain,
                    kb.source_type,
                    kb.title,
                    kb.content,
                    kb.date,
                    kb.created_at
                FROM knowledge_base kb
                WHERE kb.user_id = :user_id
                ORDER BY kb.date DESC, kb.created_at DESC
                LIMIT :limit
            """)

            async with db_manager.get_session() as session:
                result = await session.execute(sql, {"user_id": user_id, "limit": limit})
                rows = result.fetchall()

                docs = []
                for row in rows:
                    doc = {
                        "id": row[0],
                        "domain": row[1],
                        "source_type": row[2],
                        "title": row[3],
                        "content": row[4],
                        "date": row[5].isoformat() if row[5] else None,
                        "created_at": row[6].isoformat() if row[6] else None,
                    }
                    docs.append(doc)

                logger.info(f"[MySQLVectorClient] 利用者検索完了: {len(docs)}件")
                return docs

        except SQLAlchemyError as e:
            logger.error(f"[MySQLVectorClient] 利用者検索失敗: {e}", exc_info=True)
            raise

    async def health_check(self) -> Dict[str, Any]:
        """
        ヘルスチェック

        Returns:
            ヘルスチェック結果
        """
        try:
            # knowledge_base テーブルのレコード数取得
            async with db_manager.get_session() as session:
                kb_result = await session.execute(text("SELECT COUNT(*) FROM knowledge_base"))
                kb_count = kb_result.scalar()

                emb_result = await session.execute(text("SELECT COUNT(*) FROM embeddings"))
                emb_count = emb_result.scalar()

            return {
                "status": "healthy",
                "knowledge_base_count": kb_count,
                "embeddings_count": emb_count,
            }

        except Exception as e:
            logger.error(f"[MySQLVectorClient] ヘルスチェック失敗: {e}", exc_info=True)
            return {"status": "unhealthy", "error": str(e)}


# グローバルインスタンス（シングルトン）
_mysql_client: Optional[MySQLVectorClient] = None


def get_mysql_client() -> MySQLVectorClient:
    """
    MySQLクライアント取得（シングルトン）

    Returns:
        MySQLVectorClient インスタンス
    """
    global _mysql_client

    if _mysql_client is None:
        _mysql_client = MySQLVectorClient()

    return _mysql_client
