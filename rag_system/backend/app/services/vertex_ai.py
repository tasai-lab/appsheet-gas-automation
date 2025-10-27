"""
Vertex AI サービス

Embeddings生成とRanking APIを提供します。
"""

import logging
from typing import List, Optional

from google.auth import default
from google.cloud import aiplatform
from vertexai.language_models import TextEmbeddingInput, TextEmbeddingModel

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class VertexAIClient:
    """Vertex AI クライアント"""

    def __init__(self):
        """初期化"""
        # Google Cloud認証
        credentials, project = default()

        # Vertex AI初期化
        aiplatform.init(
            project=settings.gcp_project_id,
            location=settings.gcp_location,
            credentials=credentials
        )

        # Embeddings モデル
        self.embedding_model = TextEmbeddingModel.from_pretrained(
            settings.vertex_ai_embeddings_model
        )

        logger.info(
            f"Vertex AI initialized - Project: {settings.gcp_project_id}, "
            f"Location: {settings.gcp_location}, "
            f"Embeddings Model: {settings.vertex_ai_embeddings_model}"
        )

    def generate_embeddings(
        self,
        texts: List[str],
        task_type: str = "RETRIEVAL_DOCUMENT",
        output_dimensionality: Optional[int] = None
    ) -> List[List[float]]:
        """
        テキストのEmbeddingsを生成

        Args:
            texts: テキストのリスト
            task_type: タスクタイプ
                - RETRIEVAL_QUERY: クエリ用
                - RETRIEVAL_DOCUMENT: ドキュメント用
                - SEMANTIC_SIMILARITY: 類似度計算用
                - CLASSIFICATION: 分類用
            output_dimensionality: 出力次元数 (768 or 3072, Noneの場合はモデルデフォルト)

        Returns:
            Embeddingsのリスト
        """
        try:
            # 入力の準備
            inputs = [
                TextEmbeddingInput(text=text, task_type=task_type)
                for text in texts
            ]

            # Embeddings生成
            kwargs = {}
            if output_dimensionality:
                kwargs['output_dimensionality'] = output_dimensionality

            embeddings = self.embedding_model.get_embeddings(inputs, **kwargs)

            # ベクトルを抽出
            vectors = [embedding.values for embedding in embeddings]

            logger.debug(
                f"Generated {len(vectors)} embeddings - "
                f"Task: {task_type}, Dim: {output_dimensionality or 'default'}"
            )

            return vectors

        except Exception as e:
            logger.error(f"Embeddings generation failed: {e}", exc_info=True)
            raise

    def generate_query_embedding(
        self,
        query: str,
        output_dimensionality: Optional[int] = None
    ) -> List[float]:
        """
        クエリ用のEmbeddingを生成

        Args:
            query: クエリテキスト
            output_dimensionality: 出力次元数

        Returns:
            Embeddingベクトル
        """
        vectors = self.generate_embeddings(
            texts=[query],
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=output_dimensionality
        )
        return vectors[0]

    def generate_document_embeddings(
        self,
        documents: List[str],
        output_dimensionality: Optional[int] = None
    ) -> List[List[float]]:
        """
        ドキュメント用のEmbeddingsを生成（バッチ処理）

        Args:
            documents: ドキュメントテキストのリスト
            output_dimensionality: 出力次元数

        Returns:
            Embeddingsのリスト
        """
        # バッチサイズで分割処理（APIの制限に対応）
        batch_size = 250  # Vertex AI Embeddings APIの制限
        all_embeddings = []

        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            batch_embeddings = self.generate_embeddings(
                texts=batch,
                task_type="RETRIEVAL_DOCUMENT",
                output_dimensionality=output_dimensionality
            )
            all_embeddings.extend(batch_embeddings)

        logger.info(f"Generated embeddings for {len(documents)} documents")
        return all_embeddings


# モジュールレベルのシングルトン
_vertex_ai_client: Optional[VertexAIClient] = None


def get_vertex_ai_client() -> VertexAIClient:
    """
    Vertex AIクライアントを取得（シングルトン）

    Returns:
        VertexAIClient: Vertex AIクライアント
    """
    global _vertex_ai_client
    if _vertex_ai_client is None:
        _vertex_ai_client = VertexAIClient()
    return _vertex_ai_client
