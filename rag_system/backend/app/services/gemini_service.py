"""
Gemini生成サービス

Vertex AI Gemini APIを使用してチャット応答を生成します。
"""

import logging
from typing import List, Dict, Any, AsyncGenerator, Optional

import vertexai
from vertexai.generative_models import GenerativeModel, Content, Part
from google.auth import default

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GeminiService:
    """Gemini生成サービス"""

    def __init__(self):
        """初期化"""
        # Google Cloud認証
        credentials, project = default()

        # Vertex AI初期化
        vertexai.init(
            project=settings.gcp_project_id,
            location=settings.gcp_location,
            credentials=credentials
        )

        # Gemini モデル
        self.model = GenerativeModel(settings.vertex_ai_generation_model)

        logger.info(
            f"Gemini Service initialized - "
            f"Model: {settings.vertex_ai_generation_model}"
        )

    async def generate_response(
        self,
        query: str,
        context: List[Dict[str, Any]],
        stream: bool = True
    ) -> AsyncGenerator[str, None]:
        """
        応答を生成（ストリーミング対応）

        Args:
            query: ユーザークエリ
            context: 検索コンテキスト（KnowledgeItemsのリスト）
            stream: ストリーミング有効化

        Yields:
            生成されたテキストチャンク
        """
        try:
            # プロンプトを構築
            prompt = self._build_prompt(query, context)

            logger.info(f"🚀 Starting Gemini generation - Query: {query[:50]}..., Context: {len(context)} items, Stream: {stream}")

            # 生成設定
            generation_config = {
                'temperature': settings.vertex_ai_temperature,
                'max_output_tokens': settings.vertex_ai_max_output_tokens,
                'top_p': settings.vertex_ai_top_p,
                'top_k': settings.vertex_ai_top_k
            }

            # ⚠️ TEMPORARY: Vertex AI APIがタイムアウトするため、コンテキストベースのレスポンスを返す
            logger.warning("⚠️ Using context-based response (Vertex AI API timeout issue)")

            # コンテキストを基にレスポンスを構築
            if context:
                mock_response = f"# {query}\n\n"
                mock_response += f"検索により{len(context)}件の関連情報が見つかりました。\n\n"

                for i, item in enumerate(context, 1):
                    title = item.get('title', '情報なし')
                    content = item.get('content', '')
                    source = item.get('source_type', '')
                    date = item.get('date', '')

                    mock_response += f"## {i}. {title}\n\n"

                    if date:
                        mock_response += f"**日付**: {date}\n\n"
                    if source:
                        mock_response += f"**ソース**: {source}\n\n"

                    # コンテンツを適切な長さに制限
                    if len(content) > 500:
                        content = content[:500] + "..."

                    mock_response += f"{content}\n\n"
                    mock_response += "---\n\n"

                mock_response += "\n\n> ⚠️ これは検索結果の表示です。Vertex AI APIの接続問題により、AI生成回答は現在利用できません。"
            else:
                mock_response = f"# {query}\n\n申し訳ございません。関連する情報が見つかりませんでした。\n\n> ⚠️ Vertex AI APIの接続問題により、検索結果のみを表示しています。"

            yield mock_response
            logger.info(f"✅ Context-based response sent - Length: {len(mock_response)} chars, Context items: {len(context)}")

            # 元のコード（コメントアウト）
            # if stream:
            #     logger.info("📡 Calling Gemini API with streaming...")
            #     response = await self.model.generate_content_async(
            #         prompt,
            #         generation_config=generation_config,
            #         stream=True
            #     )
            #     ...
            # else:
            #     logger.info("📡 Calling Gemini API (non-streaming)...")
            #     response = await self.model.generate_content_async(
            #         prompt,
            #         generation_config=generation_config
            #     )
            #     ...

        except Exception as e:
            logger.error(f"❌ Response generation failed: {e}", exc_info=True)
            error_message = f"申し訳ございません。応答の生成中にエラーが発生しました: {str(e)}"
            logger.error(f"Returning error message to client: {error_message}")
            yield error_message

    def _build_prompt(
        self,
        query: str,
        context: List[Dict[str, Any]]
    ) -> str:
        """
        プロンプトを構築

        Args:
            query: ユーザークエリ
            context: 検索コンテキスト

        Returns:
            構築されたプロンプト
        """
        # コンテキスト文字列を構築
        context_str = ""
        for i, item in enumerate(context, 1):
            title = item.get('title', '')
            content = item.get('content', '')
            source = item.get('source_type', '')
            date = item.get('date', '')

            context_str += f"\n【コンテキスト {i}】\n"
            if title:
                context_str += f"タイトル: {title}\n"
            if source:
                context_str += f"ソース: {source}\n"
            if date:
                context_str += f"日付: {date}\n"
            context_str += f"内容:\n{content}\n"

        # プロンプトテンプレート
        prompt = f"""あなたは医療・看護記録の専門アシスタントです。
以下の検索コンテキストを参考に、ユーザーの質問に正確かつ分かりやすく回答してください。

# 検索コンテキスト
{context_str}

# ユーザーの質問
{query}

# 回答の要件
- **Markdown形式**で回答を構造化してください（見出し、リスト、太字などを活用）
- 検索コンテキストの情報を基に回答してください
- コンテキストに情報がない場合は、その旨を伝えてください
- 医療用語は分かりやすく説明してください
- 具体的で実用的な回答を心がけてください
- 最も関連性の高いコンテキストから優先的に情報を抽出してください
- 日付や時系列が重要な場合は、最新の情報を優先してください
- 必要に応じてコンテキストの出典（タイトル、ソース、日付）を明記してください

# 回答"""

        return prompt

    async def generate_summary(
        self,
        text: str,
        max_length: int = 200
    ) -> str:
        """
        テキストの要約を生成

        Args:
            text: 要約するテキスト
            max_length: 最大文字数

        Returns:
            要約テキスト
        """
        try:
            prompt = f"""以下のテキストを{max_length}文字以内で要約してください。

# テキスト
{text}

# 要約"""

            generation_config = {
                'temperature': 0.3,
                'max_output_tokens': max_length * 2,  # トークン数は文字数の約2倍
                'top_p': 0.95,
                'top_k': 40
            }

            response = await self.model.generate_content_async(
                prompt,
                generation_config=generation_config
            )

            return response.text.strip()

        except Exception as e:
            logger.error(f"Summary generation failed: {e}", exc_info=True)
            return text[:max_length] + "..."


# モジュールレベルのシングルトン
_gemini_service: Optional[GeminiService] = None


def get_gemini_service() -> GeminiService:
    """
    Geminiサービスを取得（シングルトン）

    Returns:
        GeminiService: Geminiサービス
    """
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiService()
    return _gemini_service
