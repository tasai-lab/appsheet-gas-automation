"""
Firestore Vector Search サービス

Firestore Vector Searchを使用した高速ベクトル検索を提供します。
"""

import logging
from typing import List, Dict, Any, Optional
import json

from google.cloud import firestore
from google.cloud.firestore_v1.vector import Vector
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class FirestoreVectorClient:
    """Firestore Vector Search クライアント"""

    def __init__(self):
        """初期化"""
        # Firestore クライアント（非同期）
        self.db = firestore.AsyncClient(project=settings.gcp_project_id)

        # コレクション名
        self.collection_name = "knowledge_base"

        # Vector Search設定
        self.vector_field = "embedding"
        self.distance_measure = DistanceMeasure.COSINE  # コサイン類似度
        self.max_results = 1000  # Firestore制限

        logger.info(
            f"Firestore Vector client initialized - Collection: {self.collection_name}"
        )

    async def vector_search(
        self,
        query_vector: List[float],
        limit: int = 10,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        ベクトル類似度検索

        Args:
            query_vector: クエリベクトル（2048次元）
            limit: 取得件数（最大1000）
            filters: フィルタ条件（domain, user_id など）

        Returns:
            検索結果リスト（類似度順）

        Example:
            results = await client.vector_search(
                query_vector=[0.1, 0.2, ...],
                limit=10,
                filters={"domain": "nursing", "user_id": "CL-00001"}
            )
        """
        try:
            # クエリベクトルをVector型に変換
            vector_query_obj = Vector(query_vector)

            # ベクトル検索クエリ構築
            collection_ref = self.db.collection(self.collection_name)
            vector_query = collection_ref.find_nearest(
                vector_field=self.vector_field,
                query_vector=vector_query_obj,
                distance_measure=self.distance_measure,
                limit=min(limit, self.max_results)
            )

            # フィルタ適用
            if filters:
                for key, value in filters.items():
                    if value:  # 空でないフィルタのみ適用
                        vector_query = vector_query.where(key, "==", value)

            # クエリ実行
            logger.info(f"🔍 Firestore Vector Search: limit={limit}, filters={filters}")
            docs = vector_query.stream()

            # 結果を取得
            results = []
            async for doc in docs:
                data = doc.to_dict()

                # Vectorフィールドを除外（大きすぎるため）
                if self.vector_field in data:
                    del data[self.vector_field]

                # ドキュメントIDを追加
                data['_firestore_id'] = doc.id

                results.append(data)

            logger.info(f"✅ Firestore Vector Search: {len(results)} results")
            return results

        except Exception as e:
            logger.error(f"❌ Firestore Vector Search failed: {e}", exc_info=True)
            raise

    async def get_by_id(self, document_id: str) -> Optional[Dict[str, Any]]:
        """
        IDでドキュメントを取得

        Args:
            document_id: ドキュメントID

        Returns:
            ドキュメント（存在しない場合はNone）
        """
        try:
            doc_ref = self.db.collection(self.collection_name).document(document_id)
            doc = await doc_ref.get()

            if not doc.exists:
                logger.warning(f"Document not found: {document_id}")
                return None

            data = doc.to_dict()

            # Vectorフィールドを除外
            if self.vector_field in data:
                del data[self.vector_field]

            data['_firestore_id'] = doc.id

            return data

        except Exception as e:
            logger.error(f"Failed to get document {document_id}: {e}", exc_info=True)
            return None

    async def query_with_filters(
        self,
        filters: Dict[str, Any],
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        フィルタ条件のみでクエリ（ベクトル検索なし）

        Args:
            filters: フィルタ条件
            limit: 取得件数

        Returns:
            クエリ結果リスト
        """
        try:
            collection_ref = self.db.collection(self.collection_name)
            query = collection_ref

            # フィルタ適用
            for key, value in filters.items():
                if value:
                    query = query.where(key, "==", value)

            # リミット適用
            if limit:
                query = query.limit(limit)

            # クエリ実行
            docs = query.stream()

            # 結果を取得
            results = []
            async for doc in docs:
                data = doc.to_dict()

                # Vectorフィールドを除外
                if self.vector_field in data:
                    del data[self.vector_field]

                data['_firestore_id'] = doc.id

                results.append(data)

            logger.info(f"Query with filters: {len(results)} results")
            return results

        except Exception as e:
            logger.error(f"Failed to query with filters: {e}", exc_info=True)
            raise

    async def hybrid_search(
        self,
        query_vector: List[float],
        bm25_candidates: List[str],
        limit: int = 10,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        ハイブリッド検索（BM25候補 + ベクトル類似度）

        Args:
            query_vector: クエリベクトル
            bm25_candidates: BM25でフィルタリングされた候補ID リスト
            limit: 取得件数
            filters: 追加フィルタ

        Returns:
            検索結果リスト（類似度順）
        """
        try:
            # BM25候補がない場合は通常のベクトル検索
            if not bm25_candidates:
                logger.info("No BM25 candidates, fallback to vector search")
                return await self.vector_search(query_vector, limit, filters)

            # BM25候補をFirestoreで取得
            logger.info(f"Fetching {len(bm25_candidates)} BM25 candidates from Firestore")

            # バッチ取得（最大500件ずつ）
            batch_size = 500
            all_candidates = []

            for i in range(0, len(bm25_candidates), batch_size):
                batch = bm25_candidates[i:i+batch_size]

                # 候補ドキュメントを取得
                for doc_id in batch:
                    doc = await self.get_by_id(doc_id)
                    if doc:
                        all_candidates.append(doc)

            if not all_candidates:
                logger.warning("No valid candidates found in Firestore")
                return []

            # Firestoreのベクトル検索を候補に対して実行
            # ※ Firestoreはin句でのベクトル検索をサポートしていないため、
            # 候補を取得後、Pythonでベクトル類似度を計算
            from app.services.vertex_ai import compute_cosine_similarity

            # 各候補のベクトルを取得してスコア計算
            scored_candidates = []
            for candidate in all_candidates:
                # Firestoreから完全なドキュメント（ベクトル含む）を取得
                doc_ref = self.db.collection(self.collection_name).document(
                    candidate.get('id') or candidate.get('_firestore_id')
                )
                full_doc = await doc_ref.get()

                if not full_doc.exists:
                    continue

                full_data = full_doc.to_dict()
                doc_vector = full_data.get(self.vector_field)

                if not doc_vector:
                    logger.warning(f"No vector for document: {candidate.get('id')}")
                    continue

                # ベクトルがVector型の場合、リストに変換
                if isinstance(doc_vector, Vector):
                    doc_vector = list(doc_vector)

                # コサイン類似度計算
                similarity = compute_cosine_similarity(query_vector, doc_vector)

                # ベクトルフィールドを除外
                if self.vector_field in candidate:
                    del candidate[self.vector_field]

                candidate['_similarity'] = similarity
                scored_candidates.append(candidate)

            # 類似度でソート
            scored_candidates.sort(key=lambda x: x['_similarity'], reverse=True)

            # 上位limit件を返す
            results = scored_candidates[:limit]

            logger.info(f"✅ Hybrid search: {len(results)} results (from {len(bm25_candidates)} candidates)")
            return results

        except Exception as e:
            logger.error(f"❌ Hybrid search failed: {e}", exc_info=True)
            raise


def get_firestore_vector_client() -> FirestoreVectorClient:
    """Firestore Vector クライアントを取得（シングルトン）"""
    if not hasattr(get_firestore_vector_client, "_instance"):
        get_firestore_vector_client._instance = FirestoreVectorClient()

    return get_firestore_vector_client._instance
