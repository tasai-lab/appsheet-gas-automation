"""
Gemini生成サービス

Vertex AI Gemini APIを使用してチャット応答を生成します。
思考モード（Thinking Mode）に対応。
"""

import asyncio
import logging
import os
from typing import List, Dict, Any, AsyncGenerator, Optional

import vertexai
from vertexai.generative_models import GenerativeModel, Content, Part
from google.auth import default

# Google Gen AI SDK (思考モード用)
from google import genai
from google.genai import types

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

        # Gemini モデル (従来のvertexai SDK)
        self.model = GenerativeModel(settings.vertex_ai_generation_model)

        # Google Gen AI Client (思考モード用)
        # Vertex AIモードで使用するため環境変数を設定
        os.environ['GOOGLE_CLOUD_PROJECT'] = settings.gcp_project_id
        os.environ['GOOGLE_CLOUD_LOCATION'] = settings.gcp_location
        os.environ['GOOGLE_GENAI_USE_VERTEXAI'] = 'True'

        try:
            self.genai_client = genai.Client(
                vertexai=True,
                project=settings.gcp_project_id,
                location=settings.gcp_location
            )
            logger.info(
                f"Gemini Service initialized - "
                f"Model: {settings.vertex_ai_generation_model}, "
                f"Thinking Mode: {settings.vertex_ai_enable_thinking}"
            )
        except Exception as e:
            logger.warning(f"Failed to initialize Gen AI client: {e}. Falling back to vertexai SDK only.")
            self.genai_client = None

    async def generate_response(
        self,
        query: str,
        context: List[Dict[str, Any]],
        history: Optional[List[Dict[str, Any]]] = None,
        stream: bool = True
    ) -> AsyncGenerator[str, None]:
        """
        応答を生成（ストリーミング対応 + 会話履歴対応）

        Args:
            query: ユーザークエリ
            context: 検索コンテキスト（KnowledgeItemsのリスト）
            history: 会話履歴（最新10件程度）
            stream: ストリーミング有効化

        Yields:
            生成されたテキストチャンク
        """
        try:
            # プロンプトを構築（履歴対応）
            prompt = self._build_prompt_with_history(query, context, history)

            logger.info(
                f"🚀 Starting Gemini generation - "
                f"Query: {query[:50]}..., Context: {len(context)} items, "
                f"Stream: {stream}, Thinking Mode: {settings.vertex_ai_enable_thinking}"
            )

            # 思考モードが有効で、Gen AI Clientが利用可能な場合
            if settings.vertex_ai_enable_thinking and self.genai_client is not None:
                async for chunk in self._generate_with_thinking(prompt, stream):
                    yield chunk
                return

            # 従来のVertex AI SDKを使用（思考モード無効またはフォールバック）
            # 生成設定
            generation_config = {
                'temperature': settings.vertex_ai_temperature,
                'max_output_tokens': settings.vertex_ai_max_output_tokens,
                'top_p': settings.vertex_ai_top_p,
                'top_k': settings.vertex_ai_top_k
            }

            # ★★★ Vertex AI API呼び出し: 1回のみ実行 ★★★
            # タイムアウト設定: 120秒（デフォルトより長めに設定）
            timeout_seconds = 120

            try:
                if stream:
                    logger.info("📡 Calling Gemini API with streaming...")

                    # タイムアウト付きでAPI呼び出し
                    response = await asyncio.wait_for(
                        self.model.generate_content_async(
                            prompt,
                            generation_config=generation_config,
                            stream=True
                        ),
                        timeout=timeout_seconds
                    )

                    # ストリーミングレスポンスを処理
                    chunk_count = 0
                    total_chars = 0
                    async for chunk in response:
                        if chunk.text:
                            yield chunk.text
                            chunk_count += 1
                            total_chars += len(chunk.text)

                    logger.info(f"✅ Gemini streaming completed - Chunks: {chunk_count}, Total chars: {total_chars}")

                else:
                    logger.info("📡 Calling Gemini API (non-streaming)...")

                    # タイムアウト付きでAPI呼び出し
                    response = await asyncio.wait_for(
                        self.model.generate_content_async(
                            prompt,
                            generation_config=generation_config
                        ),
                        timeout=timeout_seconds
                    )

                    if response.text:
                        yield response.text
                        logger.info(f"✅ Gemini response received - Length: {len(response.text)} chars")
                    else:
                        logger.warning("⚠️ Gemini returned empty response")
                        yield "申し訳ございません。応答の生成中に問題が発生しました。もう一度お試しください。"

            except asyncio.TimeoutError:
                logger.error(f"❌ Vertex AI API timeout after {timeout_seconds}s")
                yield f"申し訳ございません。応答の生成に時間がかかりすぎています（{timeout_seconds}秒でタイムアウト）。もう一度お試しください。"

        except Exception as e:
            logger.error(f"❌ Response generation failed: {e}", exc_info=True)
            error_message = f"申し訳ございません。応答の生成中にエラーが発生しました: {str(e)}"
            logger.error(f"Returning error message to client: {error_message}")
            yield error_message

    async def _generate_with_thinking(
        self,
        prompt: str,
        stream: bool = True
    ) -> AsyncGenerator[str, None]:
        """
        思考モードで応答を生成

        Args:
            prompt: プロンプト
            stream: ストリーミング有効化

        Yields:
            生成されたテキストチャンク
        """
        try:
            logger.info("📡 Calling Gemini API with Thinking Mode...")

            # ThinkingConfigを構築
            thinking_config = None
            if settings.vertex_ai_thinking_budget != 0:  # 0以外の場合は思考モード有効
                thinking_config = types.ThinkingConfig(
                    thinking_budget=settings.vertex_ai_thinking_budget,
                    include_thoughts=settings.vertex_ai_include_thoughts
                )

            # GenerateContentConfigを構築
            config = types.GenerateContentConfig(
                temperature=settings.vertex_ai_temperature,
                max_output_tokens=settings.vertex_ai_max_output_tokens,
                top_p=settings.vertex_ai_top_p,
                top_k=settings.vertex_ai_top_k,
                thinking_config=thinking_config
            )

            # ★★★ Google Gen AI API呼び出し: 1回のみ実行 ★★★
            if stream:
                # ストリーミングモード
                def _stream_generate():
                    return self.genai_client.models.generate_content_stream(
                        model=settings.vertex_ai_generation_model,
                        contents=prompt,
                        config=config
                    )

                # 同期ジェネレーターを非同期に変換
                chunk_count = 0
                total_chars = 0

                # asyncio.to_threadでストリーミングを非同期化
                loop = asyncio.get_event_loop()
                generator = await loop.run_in_executor(None, _stream_generate)

                for chunk in generator:
                    if hasattr(chunk, 'text') and chunk.text:
                        yield chunk.text
                        chunk_count += 1
                        total_chars += len(chunk.text)

                logger.info(f"✅ Gemini streaming (Thinking Mode) completed - Chunks: {chunk_count}, Total chars: {total_chars}")

            else:
                # 非ストリーミングモード
                def _generate():
                    return self.genai_client.models.generate_content(
                        model=settings.vertex_ai_generation_model,
                        contents=prompt,
                        config=config
                    )

                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(None, _generate)

                if hasattr(response, 'text') and response.text:
                    yield response.text
                    logger.info(f"✅ Gemini response (Thinking Mode) received - Length: {len(response.text)} chars")
                else:
                    logger.warning("⚠️ Gemini (Thinking Mode) returned empty response")
                    yield "申し訳ございません。応答の生成中に問題が発生しました。もう一度お試しください。"

        except Exception as e:
            logger.error(f"❌ Thinking Mode generation failed: {e}", exc_info=True)
            error_message = f"申し訳ございません。思考モードでの応答生成中にエラーが発生しました: {str(e)}"
            logger.error(f"Returning error message to client: {error_message}")
            yield error_message

    def _build_prompt_with_history(
        self,
        query: str,
        context: List[Dict[str, Any]],
        history: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """
        会話履歴を含むプロンプトを構築

        Args:
            query: 現在のユーザークエリ
            context: RAG検索コンテキスト
            history: 会話履歴（最新10件程度）

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

        # 会話履歴文字列を構築
        history_str = ""
        if history and len(history) > 0:
            history_str = "\n# 会話履歴\n"
            for msg in history[-10:]:  # 最新10件のみ
                role = "ユーザー" if msg.get('role') == 'user' else "AI"
                content = msg.get('content', '')
                history_str += f"{role}: {content}\n"
            history_str += "\n"

        # プロンプトテンプレート
        prompt = f"""あなたは医療・看護記録の専門アシスタントです。
以下の検索コンテキストと会話履歴を参考に、ユーザーの質問に正確かつ分かりやすく回答してください。
{history_str}
# 検索コンテキスト
{context_str}

# 現在のユーザーの質問
{query}

# 回答の要件
- **Markdown形式**で回答を構造化してください（見出し、リスト、太字などを活用）
- 検索コンテキストの情報を基に回答してください
- **会話履歴を踏まえ、文脈を理解した回答をしてください**
- 「彼」「それ」「その件」などの代名詞は、履歴から文脈を推測してください
- コンテキストに情報がない場合は、その旨を伝えてください
- 医療用語は分かりやすく説明してください
- 具体的で実用的な回答を心がけてください
- 最も関連性の高いコンテキストから優先的に情報を抽出してください
- 日付や時系列が重要な場合は、最新の情報を優先してください
- 必要に応じてコンテキストの出典（タイトル、ソース、日付）を明記してください

# 回答"""

        return prompt

    def _build_prompt(
        self,
        query: str,
        context: List[Dict[str, Any]]
    ) -> str:
        """
        プロンプトを構築（後方互換性のため保持）

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
