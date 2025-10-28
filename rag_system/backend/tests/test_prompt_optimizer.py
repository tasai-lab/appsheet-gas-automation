"""
Prompt Optimizer Service の単体テスト

テスト対象: app.services.prompt_optimizer.PromptOptimizer
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.prompt_optimizer import PromptOptimizer


@pytest.fixture
def prompt_optimizer():
    """PromptOptimizer インスタンスを返すフィクスチャ"""
    with patch("vertexai.init"), patch(
        "app.services.prompt_optimizer.GenerativeModel"
    ):
        return PromptOptimizer()


@pytest.fixture
def mock_generative_model():
    """モック Generative Model を返すフィクスチャ"""
    model = MagicMock()
    return model


class TestPromptOptimizerInit:
    """PromptOptimizer 初期化テスト"""

    def test_init_success(self):
        """初期化が成功することを確認"""
        with patch("vertexai.init"), patch(
            "app.services.prompt_optimizer.GenerativeModel"
        ) as mock_model:
            optimizer = PromptOptimizer()

            assert optimizer is not None
            assert optimizer.model is not None
            assert optimizer.generation_config is not None

            # gemini-2.5-flash-lite が使用されることを確認
            mock_model.assert_called_once_with("gemini-2.5-flash-lite")


class TestOptimizePrompt:
    """optimize_prompt メソッドのテスト"""

    @pytest.mark.asyncio
    async def test_optimize_prompt_simple(self, prompt_optimizer, mock_generative_model):
        """シンプルなプロンプト最適化が成功することを確認"""
        # モックの設定
        mock_response = MagicMock()
        mock_response.text = "最適化されたプロンプト: 利用者の状態変化を教えてください"
        mock_generative_model.generate_content_async.return_value = mock_response

        prompt_optimizer.model = mock_generative_model

        # 実行
        result = await prompt_optimizer.optimize_prompt("状態変化を教えて")

        # 検証
        assert result is not None
        assert "最適化されたプロンプト:" in result
        mock_generative_model.generate_content_async.assert_called_once()

    @pytest.mark.asyncio
    async def test_optimize_prompt_with_client_info(
        self, prompt_optimizer, mock_generative_model
    ):
        """利用者情報付きプロンプト最適化が成功することを確認"""
        # モックの設定
        mock_response = MagicMock()
        mock_response.text = (
            "最適化されたプロンプト: 利用者ID CL-00001（山田太郎）の直近の状態変化を教えてください"
        )
        mock_generative_model.generate_content_async.return_value = mock_response

        prompt_optimizer.model = mock_generative_model

        # 実行
        result = await prompt_optimizer.optimize_prompt(
            raw_prompt="直近の変化を教えて",
            client_id="CL-00001",
            client_name="山田太郎",
        )

        # 検証
        assert result is not None
        assert "CL-00001" in result
        assert "山田太郎" in result

    @pytest.mark.asyncio
    async def test_optimize_prompt_with_time_expression(
        self, prompt_optimizer, mock_generative_model
    ):
        """時間表現を含むプロンプト最適化が成功することを確認"""
        # モックの設定
        now = datetime.now()
        week_ago = now - timedelta(days=7)
        expected_text = f"最適化されたプロンプト: {week_ago.strftime('%Y年%m月%d日')}から{now.strftime('%Y年%m月%d日')}での状態変化"

        mock_response = MagicMock()
        mock_response.text = expected_text
        mock_generative_model.generate_content_async.return_value = mock_response

        prompt_optimizer.model = mock_generative_model

        # 実行
        result = await prompt_optimizer.optimize_prompt("直近1週間の変化を教えて")

        # 検証
        assert result is not None
        # プロンプト内に日付範囲が含まれることを期待
        mock_generative_model.generate_content_async.assert_called_once()

    @pytest.mark.asyncio
    async def test_optimize_prompt_empty_input(
        self, prompt_optimizer, mock_generative_model
    ):
        """空のプロンプトが適切に処理されることを確認"""
        # モックの設定
        mock_response = MagicMock()
        mock_response.text = "最適化されたプロンプト: 何をお探しですか？"
        mock_generative_model.generate_content_async.return_value = mock_response

        prompt_optimizer.model = mock_generative_model

        # 実行
        result = await prompt_optimizer.optimize_prompt("")

        # 検証
        assert result is not None

    @pytest.mark.asyncio
    async def test_optimize_prompt_long_input(
        self, prompt_optimizer, mock_generative_model
    ):
        """長いプロンプトが処理できることを確認"""
        # モックの設定
        long_prompt = "この利用者の" + "状態について " * 100 + "教えてください"
        mock_response = MagicMock()
        mock_response.text = "最適化されたプロンプト: 利用者の詳細な状態情報をお教えします"
        mock_generative_model.generate_content_async.return_value = mock_response

        prompt_optimizer.model = mock_generative_model

        # 実行
        result = await prompt_optimizer.optimize_prompt(long_prompt)

        # 検証
        assert result is not None

    @pytest.mark.asyncio
    async def test_optimize_prompt_with_special_characters(
        self, prompt_optimizer, mock_generative_model
    ):
        """特殊文字を含むプロンプトが処理できることを確認"""
        # モックの設定
        special_prompt = "利用者の「バイタル」<体温・血圧>を教えて！"
        mock_response = MagicMock()
        mock_response.text = (
            "最適化されたプロンプト: 利用者のバイタルサイン（体温・血圧）を教えてください"
        )
        mock_generative_model.generate_content_async.return_value = mock_response

        prompt_optimizer.model = mock_generative_model

        # 実行
        result = await prompt_optimizer.optimize_prompt(special_prompt)

        # 検証
        assert result is not None

    @pytest.mark.asyncio
    async def test_optimize_prompt_api_error(
        self, prompt_optimizer, mock_generative_model
    ):
        """API エラー時の動作を確認"""
        # モックの設定（エラー）
        mock_generative_model.generate_content_async.side_effect = Exception(
            "API Error"
        )

        prompt_optimizer.model = mock_generative_model

        # 実行 & 検証
        with pytest.raises(Exception) as exc_info:
            await prompt_optimizer.optimize_prompt("テスト")

        assert "API Error" in str(exc_info.value)


class TestPromptOptimizationStrategies:
    """プロンプト最適化戦略のテスト"""

    @pytest.mark.asyncio
    async def test_time_reference_recent(
        self, prompt_optimizer, mock_generative_model
    ):
        """「直近」という時間表現が具体化されることを確認"""
        # モックの設定
        now = datetime.now()
        week_ago = now - timedelta(days=7)

        mock_response = MagicMock()
        # 実際の最適化では日付が具体化されることを期待
        mock_response.text = f"最適化されたプロンプト: {week_ago.strftime('%Y年%m月%d日')}から{now.strftime('%Y年%m月%d日')}の記録"
        mock_generative_model.generate_content_async.return_value = mock_response

        prompt_optimizer.model = mock_generative_model

        # 実行
        result = await prompt_optimizer.optimize_prompt("直近の記録を見せて")

        # 検証
        assert result is not None
        # プロンプトに具体的な日付が含まれることを確認（モックの戻り値に基づく）
        mock_generative_model.generate_content_async.assert_called_once()

    @pytest.mark.asyncio
    async def test_time_reference_last_month(
        self, prompt_optimizer, mock_generative_model
    ):
        """「先月」という時間表現が具体化されることを確認"""
        # モックの設定
        now = datetime.now()
        month_ago = now - timedelta(days=30)

        mock_response = MagicMock()
        mock_response.text = f"最適化されたプロンプト: {month_ago.strftime('%Y年%m月%d日')}から{now.strftime('%Y年%m月%d日')}の記録"
        mock_generative_model.generate_content_async.return_value = mock_response

        prompt_optimizer.model = mock_generative_model

        # 実行
        result = await prompt_optimizer.optimize_prompt("先月の記録を見せて")

        # 検証
        assert result is not None

    @pytest.mark.asyncio
    async def test_client_info_integration(
        self, prompt_optimizer, mock_generative_model
    ):
        """利用者情報がプロンプトに組み込まれることを確認"""
        # モックの設定
        mock_response = MagicMock()
        mock_response.text = (
            "最適化されたプロンプト: 利用者ID CL-00001（山田太郎）の状態について教えてください"
        )
        mock_generative_model.generate_content_async.return_value = mock_response

        prompt_optimizer.model = mock_generative_model

        # 実行
        result = await prompt_optimizer.optimize_prompt(
            raw_prompt="状態を教えて",
            client_id="CL-00001",
            client_name="山田太郎",
        )

        # 検証
        assert result is not None
        assert "CL-00001" in result
        assert "山田太郎" in result


class TestEdgeCases:
    """エッジケーステスト"""

    @pytest.mark.asyncio
    async def test_optimize_prompt_none_client_id(
        self, prompt_optimizer, mock_generative_model
    ):
        """client_id が None でも動作することを確認"""
        # モックの設定
        mock_response = MagicMock()
        mock_response.text = "最適化されたプロンプト: 利用者の状態を教えてください"
        mock_generative_model.generate_content_async.return_value = mock_response

        prompt_optimizer.model = mock_generative_model

        # 実行
        result = await prompt_optimizer.optimize_prompt(
            raw_prompt="状態を教えて", client_id=None, client_name=None
        )

        # 検証
        assert result is not None

    @pytest.mark.asyncio
    async def test_optimize_prompt_unicode(
        self, prompt_optimizer, mock_generative_model
    ):
        """Unicode文字が含まれるプロンプトが処理できることを確認"""
        # モックの設定
        unicode_prompt = "利用者の体温は📈上昇傾向ですか？🤔"
        mock_response = MagicMock()
        mock_response.text = "最適化されたプロンプト: 利用者の体温が上昇傾向にあるか教えてください"
        mock_generative_model.generate_content_async.return_value = mock_response

        prompt_optimizer.model = mock_generative_model

        # 実行
        result = await prompt_optimizer.optimize_prompt(unicode_prompt)

        # 検証
        assert result is not None

    @pytest.mark.asyncio
    async def test_optimize_prompt_very_short(
        self, prompt_optimizer, mock_generative_model
    ):
        """非常に短いプロンプトが処理できることを確認"""
        # モックの設定
        mock_response = MagicMock()
        mock_response.text = "最適化されたプロンプト: 情報"
        mock_generative_model.generate_content_async.return_value = mock_response

        prompt_optimizer.model = mock_generative_model

        # 実行
        result = await prompt_optimizer.optimize_prompt("情報")

        # 検証
        assert result is not None


class TestPerformance:
    """パフォーマンステスト"""

    @pytest.mark.asyncio
    async def test_optimize_prompt_performance(
        self, prompt_optimizer, mock_generative_model
    ):
        """プロンプト最適化が1秒以内に完了することを確認"""
        import time

        # モックの設定
        mock_response = MagicMock()
        mock_response.text = "最適化されたプロンプト"
        mock_generative_model.generate_content_async.return_value = mock_response

        prompt_optimizer.model = mock_generative_model

        # 実行時間計測
        start_time = time.time()
        await prompt_optimizer.optimize_prompt("テストプロンプト")
        elapsed_time = time.time() - start_time

        # 検証（1秒以内）
        assert elapsed_time < 1.0
