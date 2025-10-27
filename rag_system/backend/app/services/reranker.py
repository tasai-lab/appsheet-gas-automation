"""
Re-ranking サービス

Vertex AI Ranking APIを使用してドキュメントをリランキングします。
"""

import logging
from typing import List, Dict, Any

from google.auth import default
from google.cloud import discoveryengine_v1alpha as discoveryengine

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class VertexAIRanker:
    """Vertex AI Ranking API クライアント"""

    def __init__(self):
        """初期化"""
        # Google Cloud認証
        credentials, project = default()

        # Ranking Service クライアント
        self.client = discoveryengine.RankServiceClient(credentials=credentials)

        # Ranking Config パス
        self.ranking_config = (
            f"projects/{settings.gcp_project_id}/locations/{settings.gcp_location}/"
            f"rankingConfigs/default_ranking_config"
        )

        logger.info(
            f"Vertex AI Ranker initialized - "
            f"Project: {settings.gcp_project_id}, "
            f"Location: {settings.gcp_location}, "
            f"Model: {settings.reranker_model}"
        )

    def rerank(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_n: int = None
    ) -> List[Dict[str, Any]]:
        """
        ドキュメントをリランキング

        Args:
            query: クエリテキスト
            documents: ドキュメントのリスト
                各ドキュメントは以下のキーを含む:
                - id: ドキュメントID
                - title: タイトル
                - content: コンテンツ
            top_n: 返すドキュメント数（Noneの場合は設定値を使用）

        Returns:
            リランキングされたドキュメントのリスト（スコア付き）

        Raises:
            ValueError: ドキュメントが200件を超える場合
            Exception: Ranking API呼び出しエラー
        """
        if not documents:
            logger.warning("No documents to rerank")
            return []

        if len(documents) > 200:
            logger.error(f"Too many documents: {len(documents)} (max: 200)")
            raise ValueError("Vertex AI Ranking API supports max 200 records per request")

        if top_n is None:
            top_n = settings.reranker_top_n

        try:
            # Ranking Records を作成
            records = []
            for doc in documents:
                # ドキュメントコンテンツを結合
                # title + content を使用して関連性を最大化
                doc_text = f"{doc.get('title', '')}\n{doc.get('content', '')}"

                record = discoveryengine.RankingRecord(
                    id=str(doc.get('id', '')),
                    title=doc.get('title', ''),
                    content=doc_text
                )
                records.append(record)

            # Ranking リクエスト
            request = discoveryengine.RankRequest(
                ranking_config=self.ranking_config,
                model=settings.reranker_model,
                query=query,
                records=records,
                top_n=top_n
            )

            logger.debug(
                f"Ranking request - Query: {query[:50]}..., "
                f"Records: {len(records)}, Top_n: {top_n}"
            )

            # API呼び出し
            response = self.client.rank(request)

            # 結果を処理
            reranked_docs = []
            for ranked_record in response.records:
                # 元のドキュメントを取得
                doc_id = ranked_record.id
                original_doc = next(
                    (doc for doc in documents if str(doc.get('id', '')) == doc_id),
                    None
                )

                if original_doc:
                    # スコアを追加
                    reranked_doc = {
                        **original_doc,
                        'rank_score': ranked_record.score,
                        'reranked': True
                    }
                    reranked_docs.append(reranked_doc)

            logger.info(
                f"Reranking completed - Input: {len(documents)}, "
                f"Output: {len(reranked_docs)}"
            )

            return reranked_docs

        except Exception as e:
            logger.error(f"Reranking failed: {e}", exc_info=True)
            # エラー時は元のドキュメントをそのまま返す（フォールバック）
            logger.warning("Falling back to original document order")
            return documents[:top_n]


# モジュールレベルのシングルトン
_ranker: VertexAIRanker = None


def get_ranker() -> VertexAIRanker:
    """
    Rankerを取得（シングルトン）

    Returns:
        VertexAIRanker: Rankerインスタンス
    """
    global _ranker
    if _ranker is None:
        _ranker = VertexAIRanker()
    return _ranker
