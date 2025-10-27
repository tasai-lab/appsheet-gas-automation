# エラーログ

このファイルは、RAGシステム開発中に発生したエラーと解決策を記録します。

**最終更新**: 2025-10-27

---

## エラー一覧

### 🔴 **[2025-10-27] 致命的: Vertex AI API呼び出しのモック化**

#### 発生日時
2025-10-27（発見日）
※実際のモック化実装日は不明

#### 問題の内容

**症状:**
- ユーザーが質問を送信しても、AIによる回答が生成されない
- 検索結果のみが表示され、「AI生成回答は現在利用できません」という警告メッセージが表示される

**根本原因:**
`backend/app/services/gemini_service.py` の74-106行目で、Vertex AI Gemini APIの呼び出しが完全にモック化されていた。

```python
# 問題のあったコード
logger.warning("⚠️ Using context-based response (Vertex AI API timeout issue)")

# コンテキストを基にレスポンスを構築（モック）
if context:
    mock_response = f"# {query}\n\n"
    mock_response += f"検索により{len(context)}件の関連情報が見つかりました。\n\n"
    # ... 検索結果を表示するだけ ...
    mock_response += "\n\n> ⚠️ これは検索結果の表示です。Vertex AI APIの接続問題により、AI生成回答は現在利用できません。"

yield mock_response
```

**影響範囲:**
- 全チャット機能が影響を受けた
- RAGシステムの中核機能（回答生成）が無効化された
- ユーザーは検索結果を見ることはできるが、それらを統合した回答を得られない

#### 原因分析

**なぜモック化されたのか:**
- コメントによると「Vertex AI APIがタイムアウトするため」という理由
- 「TEMPORARY」（一時的な措置）という注釈があったが、そのまま放置されていた
- デバッグ用の代替実装が本番環境で動作していた

**なぜ問題が発覚しなかったのか:**
1. 検索機能は正常に動作していた
2. UIにはエラーメッセージではなく「警告メッセージ」が表示されていた
3. 検索結果が表示されるため、一見正常に見えた

#### 解決策

**実施した修正:**

1. **Vertex AI API呼び出しの復旧** (`gemini_service.py` 74-125行目)
   - モックレスポンス生成コードを削除
   - 実際のVertex AI API呼び出しを実装（ストリーミング/非ストリーミング両対応）

2. **タイムアウト対策の実装**
   - `asyncio.wait_for()` を使用してタイムアウトを明示的に設定（120秒）
   - タイムアウト時の適切なエラーメッセージを実装

3. **エラーハンドリングの改善**
   - `asyncio.TimeoutError` を明示的にキャッチ
   - 詳細なログ出力（API呼び出し回数、応答サイズ等）

**修正後のコード:**

```python
# ★★★ Vertex AI API呼び出し: 1回のみ実行 ★★★
timeout_seconds = 120

try:
    if stream:
        response = await asyncio.wait_for(
            self.model.generate_content_async(
                prompt,
                generation_config=generation_config,
                stream=True
            ),
            timeout=timeout_seconds
        )
        # ストリーミングレスポンス処理
        async for chunk in response:
            if chunk.text:
                yield chunk.text
    else:
        response = await asyncio.wait_for(
            self.model.generate_content_async(
                prompt,
                generation_config=generation_config
            ),
            timeout=timeout_seconds
        )
        if response.text:
            yield response.text

except asyncio.TimeoutError:
    logger.error(f"❌ Vertex AI API timeout after {timeout_seconds}s")
    yield f"申し訳ございません。応答の生成に時間がかかりすぎています（{timeout_seconds}秒でタイムアウト）。もう一度お試しください。"
```

#### 再発防止策

1. **コードレビューの強化**
   - 「TEMPORARY」「TODO」「FIXME」コメントを定期的にチェック
   - モック実装は明確にマークし、本番環境では使用しない

2. **統合テストの追加**
   - チャット機能のエンドツーエンドテスト
   - Vertex AI API呼び出しの単体テスト
   - タイムアウト処理のテスト

3. **モニタリングの強化**
   - API呼び出し回数の監視
   - 応答時間の監視
   - エラーメッセージの内容分析

4. **ドキュメント更新**
   - ERROR_LOG.md の作成と定期更新
   - API呼び出しのベストプラクティスを CLAUDE.md に明記

#### 教訓

- ✅ **一時的な措置は期限を設定**: 「TEMPORARY」コメントには期限と担当者を明記
- ✅ **モック実装は本番環境で使用しない**: 環境変数で制御するか、テストコードに分離
- ✅ **エラーメッセージは明確に**: 「警告」ではなく「エラー」として扱うべき
- ✅ **統合テストの重要性**: 各コンポーネントが個別に動作しても、統合動作が失敗する可能性がある

#### 関連ファイル

- `backend/app/services/gemini_service.py` (74-125行目)
- `backend/app/routers/chat.py` (131-142行目)
- `backend/.env` (Vertex AI設定)

#### ステータス

**✅ 修正済み** (2025-10-27)

---

## 今後のエラー記録テンプレート

### 🔴/🟡/🟢 **[日付] エラータイトル**

#### 発生日時
YYYY-MM-DD HH:MM:SS

#### 問題の内容
- 症状
- 根本原因
- 影響範囲

#### 原因分析
- なぜ発生したのか
- なぜ問題が発覚しなかったのか

#### 解決策
- 実施した修正
- 修正後のコード（重要な部分のみ）

#### 再発防止策
1. 具体的な対策1
2. 具体的な対策2

#### 教訓
- ✅ 重要な学び
- ✅ ベストプラクティス

#### 関連ファイル
- ファイルパス (行番号)

#### ステータス
**✅ 修正済み** / **⚠️ 対応中** / **🔴 未対応**

---

**記録ルール:**
1. エラー発生時は必ずこのファイルに記録する
2. 一時的な解決策の場合は、期限を明記する
3. 修正完了後も記録を残し、教訓として活用する
4. 重大度は🔴（致命的）🟡（重要）🟢（軽微）で分類する
