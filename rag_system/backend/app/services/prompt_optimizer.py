"""
Prompt Optimizer Service

gemini-2.5-flash-lite を使用してユーザープロンプトを最適化します。
- 利用者情報（client_id, client_name）の組み込み
- 時間表現の具体化（「直近」→「2025年10月21日〜2025年10月28日」）
- プロンプトの明確化・補完
"""

import logging
from datetime import datetime, timedelta
from typing import Optional
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig

from app.config import settings

logger = logging.getLogger(__name__)


class PromptOptimizer:
    """プロンプト最適化サービス"""

    def __init__(self):
        """
        初期化

        gemini-2.5-flash-lite モデルを使用:
        - 軽量・高速
        - プロンプト最適化に最適
        - コスト効率が高い
        """
        # Vertex AI 初期化
        vertexai.init(
            project=settings.GCP_PROJECT_ID,
            location=settings.GCP_LOCATION
        )

        # gemini-2.5-flash-lite モデル
        self.model = GenerativeModel("gemini-2.5-flash-lite")

        # 生成設定
        self.generation_config = GenerationConfig(
            temperature=0.2,  # 低温度: 安定した出力
            max_output_tokens=200,  # 短い最適化プロンプト
            top_p=0.8,
            top_k=20
        )

        logger.info("✅ PromptOptimizer initialized with gemini-2.5-flash-lite")

    async def optimize_prompt(
        self,
        raw_prompt: str,
        client_id: Optional[str] = None,
        client_name: Optional[str] = None
    ) -> str:
        """
        プロンプトを最適化

        Args:
            raw_prompt: ユーザーの生のプロンプト
            client_id: 利用者ID（例: CL-00001）
            client_name: 利用者名

        Returns:
            最適化されたプロンプト

        Example:
            Input: "直近の変化を教えて"
            Output: "利用者ID CL-00001（山田太郎）の2025年10月21日から2025年10月28日での状態変化を教えて"
        """
        logger.info(f"Optimizing prompt: {raw_prompt[:100]}...")

        # 現在日時と1週間前を計算
        now = datetime.now()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        # システムプロンプト構築
        system_prompt = self._build_system_prompt(
            client_id=client_id,
            client_name=client_name,
            current_date=now,
            week_ago=week_ago,
            month_ago=month_ago
        )

        # プロンプト最適化リクエスト
        full_prompt = f"{system_prompt}\n\n【ユーザープロンプト】\n{raw_prompt}"

        try:
            # Vertex AI API 呼び出し (★★★ 1回のみ実行 ★★★)
            logger.info("Calling Vertex AI gemini-2.5-flash-lite (prompt optimization)")

            response = self.model.generate_content(
                full_prompt,
                generation_config=self.generation_config
            )

            optimized = response.text.strip()

            logger.info(f"✅ Prompt optimized: {optimized[:100]}...")

            # 使用量記録
            if hasattr(response, 'usage_metadata'):
                usage = response.usage_metadata
                logger.info(
                    f"Usage: input={usage.prompt_token_count}, "
                    f"output={usage.candidates_token_count}, "
                    f"total={usage.total_token_count}"
                )

            return optimized

        except Exception as e:
            logger.error(f"❌ Prompt optimization failed: {e}")
            # フォールバック: 最低限の補完を行う
            return self._fallback_optimization(raw_prompt, client_id, client_name)

    def _build_system_prompt(
        self,
        client_id: Optional[str],
        client_name: Optional[str],
        current_date: datetime,
        week_ago: datetime,
        month_ago: datetime
    ) -> str:
        """システムプロンプト構築"""

        # 利用者情報部分
        client_info = ""
        if client_id and client_name:
            client_info = f"""
**利用者情報**:
- 利用者ID: {client_id}
- 利用者名: {client_name}
"""
        elif client_id:
            client_info = f"""
**利用者情報**:
- 利用者ID: {client_id}
"""

        # 日付情報部分
        date_info = f"""
**現在日時**: {current_date.strftime('%Y年%m月%d日')}
**1週間前**: {week_ago.strftime('%Y年%m月%d日')}
**1ヶ月前**: {month_ago.strftime('%Y年%m月%d日')}
"""

        # システムプロンプト
        system_prompt = f"""あなたはプロンプト最適化エージェントです。

**役割**:
ユーザーの曖昧なプロンプトを、RAG検索に最適化された明確なプロンプトに変換してください。

**最適化のルール**:
1. 利用者情報（ID・名前）を必ず組み込む
2. 時間表現を具体的な日付範囲に変換
   - 「直近」「最近」 → 1週間前〜現在
   - 「先月」「最近1ヶ月」 → 1ヶ月前〜現在
3. 曖昧な表現を明確化
   - 「変化」→「状態変化」「血圧変化」など具体化
   - 「状況」→「健康状況」「通話状況」など文脈に応じて補完
4. 検索キーワードが明確になるよう補完

**出力形式**:
最適化されたプロンプトのみを出力してください。説明や前置きは不要です。

{client_info}
{date_info}
"""

        return system_prompt

    def _fallback_optimization(
        self,
        raw_prompt: str,
        client_id: Optional[str],
        client_name: Optional[str]
    ) -> str:
        """
        フォールバック最適化

        Vertex AI 呼び出しが失敗した場合の最低限の補完
        """
        logger.warning("Using fallback prompt optimization")

        optimized = raw_prompt

        # 利用者情報の前置き追加
        if client_id and client_name:
            optimized = f"利用者ID {client_id}（{client_name}）について：{raw_prompt}"
        elif client_id:
            optimized = f"利用者ID {client_id}について：{raw_prompt}"

        # 時間表現の簡易補完
        now = datetime.now()
        week_ago = now - timedelta(days=7)

        if "直近" in optimized or "最近" in optimized:
            date_range = f"{week_ago.strftime('%Y年%m月%d日')}から{now.strftime('%Y年%m月%d日')}"
            optimized = optimized.replace("直近", f"{date_range}の期間での")
            optimized = optimized.replace("最近", f"{date_range}の期間での")

        return optimized


# シングルトンインスタンス
_optimizer_instance: Optional[PromptOptimizer] = None


def get_prompt_optimizer() -> PromptOptimizer:
    """プロンプト最適化サービスのシングルトン取得"""
    global _optimizer_instance
    if _optimizer_instance is None:
        _optimizer_instance = PromptOptimizer()
    return _optimizer_instance
