"""
RAG Hybrid Search エンジン

5段階のHybrid Search (BM25 + Dense Retrieval + RRF + Vertex AI Ranking)を実装します。
"""

import logging
import time
from typing import List, Dict, Any, Optional

from app.config import get_settings
from app.services.vertex_ai import get_vertex_ai_client
from app.services.reranker import get_ranker
from app.services.spreadsheet import get_spreadsheet_client
from app.services.firestore_vector_service import get_firestore_vector_client
from app.services.medical_terms import get_medical_terms_service
from app.utils.cosine import calculate_cosine_similarity
from app.utils.bm25 import simple_tokenize, score_documents_bm25

logger = logging.getLogger(__name__)
settings = get_settings()


class HybridSearchEngine:
    """Hybrid Search エンジン"""

    def __init__(self):
        """初期化"""
        self.vertex_ai_client = get_vertex_ai_client()
        self.ranker = get_ranker()
        self.spreadsheet_client = get_spreadsheet_client()
        self.firestore_vector_client = get_firestore_vector_client() if settings.use_firestore_vector_search else None
        self.medical_terms_service = get_medical_terms_service()

        if settings.use_firestore_vector_search:
            logger.info("Hybrid Search Engine initialized (Firestore Vector Search enabled)")
        else:
            logger.info("Hybrid Search Engine initialized (Spreadsheet Vector Search)")

    async def search(
        self,
        query: str,
        domain: Optional[str] = None,
        client_id: Optional[str] = None,
        top_k: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Hybrid Search実行

        Args:
            query: クエリテキスト
            domain: ドメインフィルタ（例: "nursing"）
            client_id: 利用者IDフィルタ（指定された利用者のデータのみに絞り込む）
            top_k: 返す結果数

        Returns:
            検索結果と統計情報
        """
        start_time = time.time()

        if top_k is None:
            top_k = settings.search_final_top_k

        logger.info(f"Starting Hybrid Search - Query: {query[:50]}..., Domain: {domain}, Client ID: {client_id}, Top-K: {top_k}")

        try:
            # Stage 0: Query Preprocessing
            preprocessed = self._preprocess_query(query)

            # Stage 1 & 2: Parallel Search (BM25 + Dense Retrieval)
            candidates = await self._parallel_search(
                preprocessed['enriched_query'],
                domain=domain,
                client_id=client_id
            )

            if not candidates:
                logger.warning("No candidates found")
                return self._empty_result(query, time.time() - start_time, preprocessed)

            # Stage 3: RRF Fusion (すでに並列検索で実施済み)

            # Stage 4: Vertex AI Ranking API Re-ranking
            reranked_results = self.ranker.rerank(
                query=query,
                documents=candidates[:50],  # Top 50を送信
                top_n=top_k
            )

            # Stage 5: Result Validation
            validated_result = self._validate_results(
                results=reranked_results,
                query=query,
                preprocessed=preprocessed
            )

            processing_time = (time.time() - start_time) * 1000  # ms

            logger.info(
                f"Hybrid Search completed - "
                f"Results: {len(validated_result['results'])}, "
                f"Time: {processing_time:.2f}ms"
            )

            return {
                'query': query,
                'results': validated_result['results'],
                'total_count': len(validated_result['results']),
                'processing_time_ms': processing_time,
                'reranked': True,
                'suggested_terms': validated_result.get('suggested_terms', []),
                'metadata': {
                    'extracted_terms': preprocessed['extracted_terms'],
                    'expanded_terms_count': len(preprocessed['expanded_terms']),
                    'candidates_count': len(candidates)
                }
            }

        except Exception as e:
            logger.error(f"Hybrid Search failed: {e}", exc_info=True)
            processing_time = (time.time() - start_time) * 1000
            return {
                'query': query,
                'results': [],
                'total_count': 0,
                'processing_time_ms': processing_time,
                'reranked': False,
                'suggested_terms': [],
                'error': str(e)
            }

    def _preprocess_query(self, query: str) -> Dict[str, Any]:
        """
        Stage 0: Query Preprocessing

        Args:
            query: 元のクエリ

        Returns:
            前処理済みクエリ情報
        """
        logger.debug("Stage 0: Query Preprocessing")

        # 医療用語を抽出・展開
        enriched = self.medical_terms_service.enrich_query(query)

        logger.debug(
            f"Extracted {len(enriched['extracted_terms'])} terms, "
            f"Expanded to {len(enriched['expanded_terms'])} terms"
        )

        return enriched

    async def _parallel_search(
        self,
        query: str,
        domain: Optional[str] = None,
        client_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Stage 1 & 2: BM25 + Dense Retrieval (Parallel)

        Args:
            query: 拡張済みクエリ
            domain: ドメインフィルタ
            client_id: 利用者IDフィルタ

        Returns:
            候補ドキュメントリスト（RRF統合済み）
        """
        if settings.use_firestore_vector_search:
            logger.debug("Stage 1 & 2: Parallel Search (BM25 + Firestore Vector Search)")

            # Firestore Vector Search使用時
            # Stage 1: BM25はSpreadsheetから実行（全文検索が必要なため）
            kb_records = self.spreadsheet_client.read_knowledge_base()

            # ドメインフィルタ
            if domain:
                kb_records = [r for r in kb_records if r.get('domain') == domain]

            # 利用者IDフィルタ
            if client_id:
                kb_records = [
                    r for r in kb_records
                    if (client_id in str(r.get('id', '')) or
                        client_id in str(r.get('source_id', '')) or
                        client_id in str(r.get('title', '')) or
                        client_id in str(r.get('content', '')))
                ]
                logger.info(f"Client ID filter applied - {len(kb_records)} records remaining")

            if not kb_records:
                logger.warning("No records in KnowledgeBase")
                return []

            logger.debug(f"Loaded {len(kb_records)} KB records for BM25")

            # Stage 1: BM25 Search
            bm25_results = self._bm25_search(query, kb_records)

            # Stage 2: Dense Retrieval (Firestore)
            dense_results = await self._dense_retrieval_firestore(query, domain, client_id)

        else:
            logger.debug("Stage 1 & 2: Parallel Search (BM25 + Spreadsheet Dense Retrieval)")

            # Spreadsheet使用時（従来のロジック）
            # KnowledgeBaseを読み込み
            kb_records = self.spreadsheet_client.read_knowledge_base()

            # ドメインフィルタ
            if domain:
                kb_records = [r for r in kb_records if r.get('domain') == domain]

            # 利用者IDフィルタ
            if client_id:
                kb_records = [
                    r for r in kb_records
                    if (client_id in str(r.get('id', '')) or
                        client_id in str(r.get('source_id', '')) or
                        client_id in str(r.get('title', '')) or
                        client_id in str(r.get('content', '')))
                ]
                logger.info(f"Client ID filter applied - {len(kb_records)} records remaining")

            if not kb_records:
                logger.warning("No records in KnowledgeBase")
                return []

            logger.debug(f"Loaded {len(kb_records)} KB records")

            # Stage 1: BM25 Search
            bm25_results = self._bm25_search(query, kb_records)

            # Stage 2: Dense Retrieval (Spreadsheet)
            dense_results = self._dense_retrieval(query, kb_records)

        # Stage 3: RRF Fusion
        fused_results = self._rrf_fusion(bm25_results, dense_results)

        logger.debug(f"RRF Fusion completed - {len(fused_results)} candidates")

        return fused_results

    def _bm25_search(
        self,
        query: str,
        documents: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Stage 1: BM25 Keyword Search

        Args:
            query: クエリ
            documents: ドキュメントリスト

        Returns:
            BM25スコア付きドキュメント（Top-K）
        """
        try:
            # BM25スコアリング
            scored_docs = score_documents_bm25(
                query=query,
                documents=documents,
                k1=1.5,
                b=0.75
            )

            # Top-K取得
            top_k = settings.search_bm25_top_k
            bm25_results = scored_docs[:top_k]

            logger.debug(f"BM25 Search completed - Top {len(bm25_results)} results")

            return bm25_results

        except Exception as e:
            logger.error(f"BM25 Search failed: {e}", exc_info=True)
            return []

    def _dense_retrieval(
        self,
        query: str,
        documents: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Stage 2: Dense Vector Retrieval

        Args:
            query: クエリ
            documents: ドキュメントリスト

        Returns:
            類似度スコア付きドキュメント（Top-K）
        """
        try:
            # クエリEmbeddingを生成
            query_embedding = self.vertex_ai_client.generate_query_embedding(
                query=query,
                output_dimensionality=settings.vertex_ai_embeddings_dimension
            )

            # Embeddingsシートを読み込み
            embeddings_records = self.spreadsheet_client.read_embeddings()

            # KB IDでマッピング
            embeddings_map = {
                r.get('kb_id'): r.get('embedding', [])
                for r in embeddings_records
            }

            # 各ドキュメントとの類似度を計算
            scored_docs = []
            for doc in documents:
                kb_id = doc.get('id')
                doc_embedding = embeddings_map.get(kb_id)

                if doc_embedding and len(doc_embedding) > 0:
                    similarity = calculate_cosine_similarity(query_embedding, doc_embedding)
                    scored_docs.append({
                        **doc,
                        'vector_score': similarity
                    })

            # スコア降順でソート
            scored_docs.sort(key=lambda x: x['vector_score'], reverse=True)

            # Top-K取得
            top_k = settings.search_dense_top_k
            dense_results = scored_docs[:top_k]

            logger.debug(f"Dense Retrieval completed - Top {len(dense_results)} results")

            return dense_results

        except Exception as e:
            logger.error(f"Dense Retrieval failed: {e}", exc_info=True)
            return []

    async def _dense_retrieval_firestore(
        self,
        query: str,
        domain: Optional[str] = None,
        client_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Stage 2: Dense Vector Retrieval (Firestore Vector Search)

        Args:
            query: クエリ
            domain: ドメインフィルタ
            client_id: 利用者IDフィルタ

        Returns:
            類似度スコア付きドキュメント（Top-K）
        """
        try:
            # クエリEmbeddingを生成（2048次元）
            query_embedding = self.vertex_ai_client.generate_query_embedding(
                query=query,
                output_dimensionality=settings.vertex_ai_embeddings_dimension
            )

            # フィルタ構築
            filters = {}
            if domain:
                filters['domain'] = domain
            if client_id:
                filters['user_id'] = client_id

            # Firestore Vector Search実行
            top_k = settings.search_dense_top_k
            results = await self.firestore_vector_client.vector_search(
                query_vector=query_embedding,
                limit=top_k,
                filters=filters
            )

            # vector_scoreフィールドを追加（互換性のため）
            for result in results:
                # Firestoreから返される類似度スコア（_similarityフィールド）をvector_scoreに変換
                result['vector_score'] = result.get('_similarity', 0.0)

            logger.debug(f"Firestore Dense Retrieval completed - Top {len(results)} results")

            return results

        except Exception as e:
            logger.error(f"Firestore Dense Retrieval failed: {e}", exc_info=True)
            return []

    def _rrf_fusion(
        self,
        bm25_results: List[Dict[str, Any]],
        dense_results: List[Dict[str, Any]],
        k: int = 60
    ) -> List[Dict[str, Any]]:
        """
        Stage 3: Reciprocal Rank Fusion (RRF)

        Args:
            bm25_results: BM25検索結果
            dense_results: Dense Retrieval結果
            k: RRF定数

        Returns:
            RRF統合済みドキュメント
        """
        rrf_scores = {}

        # BM25結果のRRFスコア
        for rank, doc in enumerate(bm25_results):
            doc_id = doc.get('id')
            rrf = 1 / (k + rank + 1)

            if doc_id not in rrf_scores:
                rrf_scores[doc_id] = {
                    'doc': doc,
                    'bm25_rrf': 0,
                    'dense_rrf': 0
                }
            rrf_scores[doc_id]['bm25_rrf'] = rrf

        # Dense結果のRRFスコア
        for rank, doc in enumerate(dense_results):
            doc_id = doc.get('id')
            rrf = 1 / (k + rank + 1)

            if doc_id not in rrf_scores:
                rrf_scores[doc_id] = {
                    'doc': doc,
                    'bm25_rrf': 0,
                    'dense_rrf': 0
                }
            rrf_scores[doc_id]['dense_rrf'] = rrf

        # 重み付き統合
        bm25_weight = settings.search_bm25_weight
        dense_weight = settings.search_dense_weight

        fused_results = []
        for doc_id, scores in rrf_scores.items():
            fused_score = (
                bm25_weight * scores['bm25_rrf'] +
                dense_weight * scores['dense_rrf']
            )

            fused_doc = {
                **scores['doc'],
                'rrf_score': fused_score,
                'bm25_contribution': scores['bm25_rrf'],
                'dense_contribution': scores['dense_rrf']
            }
            fused_results.append(fused_doc)

        # 統合スコア降順でソート
        fused_results.sort(key=lambda x: x['rrf_score'], reverse=True)

        return fused_results

    def _validate_results(
        self,
        results: List[Dict[str, Any]],
        query: str,
        preprocessed: Dict[str, Any],
        threshold: int = 2
    ) -> Dict[str, Any]:
        """
        Stage 5: Result Validation & Term Suggestion

        Args:
            results: リランキング済み結果
            query: 元のクエリ
            preprocessed: 前処理情報
            threshold: 成功判定閾値

        Returns:
            検証結果と提案
        """
        if len(results) >= threshold:
            return {
                'success': True,
                'results': results,
                'suggested_terms': []
            }

        # 検索失敗 → 代替用語提案
        logger.warning(f"Search failed - Only {len(results)} results (threshold: {threshold})")

        suggested_terms = self.medical_terms_service.suggest_alternative_terms(
            query=query,
            top_k=5
        )

        return {
            'success': False,
            'results': results,
            'suggested_terms': suggested_terms
        }

    def _empty_result(
        self,
        query: str,
        processing_time: float,
        preprocessed: Dict[str, Any]
    ) -> Dict[str, Any]:
        """空の結果を返す"""
        return {
            'query': query,
            'results': [],
            'total_count': 0,
            'processing_time_ms': processing_time * 1000,
            'reranked': False,
            'suggested_terms': self.medical_terms_service.suggest_alternative_terms(query),
            'metadata': {
                'extracted_terms': preprocessed['extracted_terms'],
                'expanded_terms_count': len(preprocessed['expanded_terms']),
                'candidates_count': 0
            }
        }


# モジュールレベルのシングルトン
_hybrid_search_engine: Optional[HybridSearchEngine] = None


def get_hybrid_search_engine() -> HybridSearchEngine:
    """
    Hybrid Search エンジンを取得（シングルトン）

    Returns:
        HybridSearchEngine: Hybrid Search エンジン
    """
    global _hybrid_search_engine
    if _hybrid_search_engine is None:
        _hybrid_search_engine = HybridSearchEngine()
    return _hybrid_search_engine
