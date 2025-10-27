# 本番環境問題の根本原因分析レポート

**日時**: 2025-10-27 18:30 JST
**問題**: チャット応答が表示されない（totalChunks: 0）
**ステータス**: 根本原因特定完了 - 修正実施中

---

## 🎯 問題の症状

### ユーザー報告
```
[API] streamChatMessage 開始 { hasToken: true, apiUrl: 'https://rag-backend-411046620715.us-central1.run.app' }
[API] Authorization header added
[API] Response status: 200 OK
[API] ストリーム読み込み開始
[API] ストリーム完了 {totalChunks: 0}  ❌ ← 空のレスポンス
```

- ✅ 認証は成功（hasToken: true, Authorization header added）
- ✅ HTTPステータスは200 OK
- ❌ しかし、ストリームが空（totalChunks: 0）
- ❌ 画面にチャット応答が表示されない

---

## 🔍 根本原因の特定

### 調査手法
1. Cloud Runログの詳細分析
2. Backend側のエラーログ確認
3. 権限設定の確認
4. 環境変数の確認
5. コードレビュー

### 発見された5つの致命的な問題

---

## 🔴 問題1: Vertex AI API権限エラー（最重要）

### エラーログ
```
google.api_core.exceptions.PermissionDenied: 403 Permission 'aiplatform.endpoints.predict'
denied on resource '//aiplatform.googleapis.com/projects/fractal-ecosystem/locations/us-central1/
publishers/google/models/gemini-2.5-flash' (or it may not exist).
[reason: "IAM_PERMISSION_DENIED"]
```

### 原因
Cloud Runサービスアカウント（`411046620715-compute@developer.gserviceaccount.com`）に
Vertex AI Gemini APIを呼び出す権限がなかった。

### 影響
- **Gemini APIが呼び出せないため、応答が生成されない**
- Backend側では処理が進むが、AIからの応答が空になる
- Frontend側は空のストリームを受け取る

### 修正方法
```bash
gcloud projects add-iam-policy-binding fractal-ecosystem \
  --member="serviceAccount:411046620715-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user" \
  --condition=None
```

### 修正日時
2025-10-27 18:20 JST

### ステータス
✅ 修正完了

---

## 🔴 問題2: ベクトルDB Spreadsheet ID未設定

### エラーログ
```
googleapiclient.errors.HttpError: <HttpError 404 when requesting
https://sheets.googleapis.com/v4/spreadsheets//values/MedicalTerms?alt=json
returned "Requested entity was not found.". Details: "Requested entity was not found.">
```

### 原因
Cloud Runの環境変数 `VECTOR_DB_SPREADSHEET_ID` が設定されていなかった。

デフォルト値（空文字列）のまま、Spreadsheet APIを呼び出していた。

### 影響
- **RAG検索でコンテキストを取得できない**
- 医療用語データベースにアクセスできない
- コンテキストが空のまま、Gemini APIに送信される
- AI応答が不正確になる

### 修正方法
```bash
gcloud run services update rag-backend \
  --region=us-central1 \
  --project=fractal-ecosystem \
  --set-env-vars="VECTOR_DB_SPREADSHEET_ID=1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA,..."
```

### 修正日時
2025-10-27 18:25 JST

### ステータス
🔄 実行中

---

## 🟡 問題3: Thinking Mode設定エラー

### 問題内容
`backend/app/config.py`で `vertex_ai_enable_thinking: bool = True` がデフォルトで有効化されているが、
`google-generativeai`パッケージがインストールされていない。

### コードの問題箇所
`backend/app/services/gemini_service.py:218-242`

```python
# ★★★ Google Gen AI API呼び出し: 1回のみ実行 ★★★
if stream:
    def _stream_generate():
        return self.genai_client.models.generate_content_stream(
            model=settings.vertex_ai_generation_model,
            contents=prompt,
            config=config
        )
    # ...
```

**しかし、`self.genai_client = None`になっている！**

### 原因
`backend/app/services/gemini_service.py:18-27`で条件付きインポートを実装したが、
パッケージがないため `self.genai_client = None` に設定される。

しかし、`_generate_with_thinking()`メソッド内で`self.genai_client.models.generate_content_stream()`
を呼び出そうとするため、`AttributeError: 'NoneType' object has no attribute 'models'`エラーが発生する。

### 影響
- **Thinking Modeが有効な場合、応答生成が失敗する**
- エラーが発生しても、適切にハンドリングされず、空のレスポンスが返される
- Frontend側は空のストリームを受け取る

### 修正方法（2つの選択肢）

**選択肢1: Thinking Modeを無効化（推奨）**
```bash
--set-env-vars="VERTEX_AI_ENABLE_THINKING=False,..."
```

**選択肢2: google-generativeai パッケージをインストール**
```
requirements.txt に追加:
google-generativeai==0.8.3
```

### 修正日時
2025-10-27 18:25 JST（選択肢1を採用）

### ステータス
🔄 実行中

---

## 🟢 問題4: Frontend環境変数の誤設定（修正済み）

### 原因
`frontend/.env.local`が`NEXT_PUBLIC_API_URL=http://localhost:8000`を指定していた。

Next.jsは `.env.local` > `.env.production` の優先順位のため、本番環境でもlocalhostに接続していた。

### 影響
- **Frontendが本番Backendに接続できない**
- ユーザーのブラウザからlocalhostへのリクエストが発生
- Network エラー（ERR_CONNECTION_REFUSED）

### 修正方法
`frontend/.env.local`を以下に変更：
```bash
NEXT_PUBLIC_API_URL=https://rag-backend-411046620715.us-central1.run.app
```

### 修正日時
2025-10-27 17:40 JST

### ステータス
✅ 修正完了

---

## 🟢 問題5: Backend ImportError（修正済み）

### エラーログ
```
ImportError: cannot import name 'genai' from 'google' (unknown location)
```

### 原因
`backend/app/services/gemini_service.py`で`from google import genai`をモジュールトップレベルで
インポートしていたが、`google-generativeai`パッケージが`requirements.txt`に含まれていなかった。

### 影響
- **Backend起動時にImportErrorが発生**
- Backendが起動できない、または起動に失敗する

### 修正方法
条件付きインポートを実装（gemini_service.py:17-27）:
```python
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    logger.warning("google-generativeai package not available. Thinking mode will be disabled.")
    genai = None
    types = None
    GENAI_AVAILABLE = False
```

### 修正日時
2025-10-27 18:00 JST

### ステータス
✅ 修正完了

---

## 🟢 問題6: Firestore権限エラー（修正済み）

### エラーログ
```
google.api_core.exceptions.PermissionDenied: 403 Missing or insufficient permissions.
```

### 原因
Cloud Runサービスアカウントに Firestore 書き込み権限がなかった。

### 影響
- **会話履歴がFirestoreに保存されない**
- セッション管理が機能しない
- ユーザーが前の会話を参照できない

### 修正方法
```bash
gcloud projects add-iam-policy-binding fractal-ecosystem \
  --member="serviceAccount:411046620715-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user" \
  --condition=None
```

### 修正日時
2025-10-27 18:10 JST

### ステータス
✅ 修正完了

---

## 📊 問題の重要度と優先度

| 問題 | 重要度 | 影響範囲 | 修正優先度 | ステータス |
|------|--------|----------|-----------|----------|
| Vertex AI権限エラー | 🔴 最高 | 全機能停止 | 最優先 | ✅ 完了 |
| Spreadsheet ID未設定 | 🔴 高 | RAG検索不可 | 高 | 🔄 実行中 |
| Thinking Mode設定エラー | 🟡 中 | 応答生成失敗 | 高 | 🔄 実行中 |
| Frontend環境変数 | 🔴 高 | 接続不可 | 最優先 | ✅ 完了 |
| Backend ImportError | 🔴 高 | 起動失敗 | 最優先 | ✅ 完了 |
| Firestore権限エラー | 🟡 中 | 履歴保存不可 | 中 | ✅ 完了 |

---

## 🔧 修正の時系列

1. **17:40** - Frontend環境変数修正（`.env.local`）
2. **18:00** - Backend ImportError修正（条件付きインポート）
3. **18:06** - Backend再デプロイ（Cloud Run revision 00008-dc4）
4. **18:10** - Firestore権限付与（roles/datastore.user）
5. **18:10** - 環境変数設定（REQUIRE_AUTHENTICATION, USE_FIRESTORE_CHAT_HISTORY）
6. **18:20** - Vertex AI権限付与（roles/aiplatform.user）
7. **18:25** - 環境変数設定（VECTOR_DB_SPREADSHEET_ID, VERTEX_AI_ENABLE_THINKING）🔄

---

## 🎓 学んだ教訓

### 1. 権限設定の重要性
- **Cloud Runサービスアカウントには適切なIAMロールが必須**
- Vertex AI、Firestore、Spreadsheet API など、すべてのGCPサービスに権限が必要
- デプロイ前に権限チェックリストを作成する

### 2. 環境変数の一元管理
- **`.env`ファイルとCloud Run環境変数の同期が重要**
- ローカル開発と本番環境で設定が異なることを忘れない
- デプロイ時に環境変数チェックを自動化する

### 3. 条件付きインポートのベストプラクティス
- **オプショナルなパッケージは条件付きインポートで対応**
- デフォルト設定は「無効」にして、明示的に有効化する
- パッケージがない場合のフォールバック処理を実装する

### 4. ロギングの重要性
- **詳細なログは問題特定の鍵**
- Cloud Runログ、ブラウザコンソール、両方を確認する
- エラーメッセージには具体的な情報を含める

### 5. テストの重要性
- **本番環境デプロイ前に統合テストを実施**
- 権限、環境変数、APIアクセスをすべて確認
- ステージング環境での事前検証が重要

---

## 📋 次のステップ

### 即座に実施
1. ✅ Vertex AI権限付与
2. ✅ Firestore権限付与
3. 🔄 環境変数設定完了を確認
4. 🔄 Cloud Run再起動
5. ⏳ ユーザーによる動作確認

### 短期的（1週間以内）
1. **ステージング環境の構築** - 本番デプロイ前のテスト環境
2. **CI/CDパイプラインの改善** - デプロイ時の自動チェック
3. **モニタリングの強化** - Cloud Logging、Error Reporting、Monitoring
4. **ドキュメント整備** - デプロイ手順書、トラブルシューティングガイド

### 中期的（1ヶ月以内）
1. **自動テストの充実** - 統合テスト、E2Eテスト
2. **ヘルスチェックエンドポイントの強化** - 権限チェック、依存関係チェック
3. **アラート設定** - エラー率、レスポンスタイム、API使用量
4. **パフォーマンス最適化** - キャッシュ、コネクションプール

---

## 📖 参考ドキュメント

- [Vertex AI権限設定](https://cloud.google.com/vertex-ai/docs/general/access-control)
- [Cloud Run環境変数](https://cloud.google.com/run/docs/configuring/environment-variables)
- [Firestore権限管理](https://cloud.google.com/firestore/docs/security/iam)
- [Next.js環境変数](https://nextjs.org/docs/basic-features/environment-variables)
- [FastAPI Configuration](https://fastapi.tiangolo.com/advanced/settings/)

---

**作成者**: Claude Code
**最終更新**: 2025-10-27 18:30 JST
