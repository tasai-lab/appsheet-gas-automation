# Spreadsheet権限共有ガイド

**最重要タスク**: Google Sheets API 403エラーを解決するために、ベクトルDBスプレッドシートをCloud Runサービスアカウントと共有する必要があります。

---

## 🚨 必須作業: スプレッドシート共有

### 対象スプレッドシート

**スプレッドシートID**: `1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA`

**URL**: https://docs.google.com/spreadsheets/d/1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA/edit

### 共有する相手

**サービスアカウントメールアドレス**:
```
411046620715-compute@developer.gserviceaccount.com
```

### 必要な権限レベル

**編集者** (Editor)

---

## 📋 手順（所要時間: 1分）

### ステップ1: スプレッドシートを開く

1. 以下のリンクをクリックして、スプレッドシートを開きます：

   https://docs.google.com/spreadsheets/d/1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA/edit

### ステップ2: 共有ボタンをクリック

2. 右上の「**共有**」ボタン（人のアイコン）をクリック

### ステップ3: サービスアカウントを追加

3. 「ユーザーやグループを追加」フィールドに以下を**正確に**貼り付け：
   ```
   411046620715-compute@developer.gserviceaccount.com
   ```

4. Enter キーを押す

### ステップ4: 権限を設定

5. ドロップダウンメニューから「**編集者**」を選択

6. 「**送信**」または「**完了**」ボタンをクリック

---

## ✅ 確認方法

共有が正しく設定されたかを確認：

### 方法1: スプレッドシートUI

1. スプレッドシート画面右上の「共有」ボタンをクリック
2. 「アクセス権を持つユーザー」リストに以下が表示されることを確認：
   - `411046620715-compute@developer.gserviceaccount.com` (編集者)

### 方法2: Cloud Runログ確認

**デプロイ直後にテスト**:

1. ブラウザで https://fractal-ecosystem.web.app を開く
2. ログインして、任意のチャットメッセージを送信
3. Cloud Runログで以下を確認：

**成功ログ（期待される結果）**:
```
🔵 [DEBUG] Event generator started
🟢 [DEBUG] About to yield search status...
✅ [DEBUG] Search status yielded successfully
```

**失敗ログ（権限未設定の場合）**:
```
HttpError 403: "The caller does not have permission"
requesting spreadsheets/1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA/values/MedicalTerms
```

### Cloud Runログの確認手順:

```bash
# 最新のログを確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=rag-backend" \
  --project=fractal-ecosystem \
  --limit=50 \
  --format="table(timestamp, textPayload)" \
  --freshness=10m
```

または、Cloud Console:
https://console.cloud.google.com/run/detail/us-central1/rag-backend/logs?project=fractal-ecosystem

---

## 🔍 トラブルシューティング

### エラー: 「このメールアドレスは無効です」

**原因**: サービスアカウントメールアドレスが正しくコピーされていない

**解決策**:
- スペースや改行がないことを確認
- 以下を再度コピー＆ペースト:
  ```
  411046620715-compute@developer.gserviceaccount.com
  ```

### エラー: 「アクセス権がありません」（自分がスプレッドシートを開けない場合）

**原因**: スプレッドシートのオーナーではない、または閲覧権限がない

**解決策**:
1. スプレッドシートのオーナーに連絡
2. オーナーに以下を依頼：
   - 自分のGoogleアカウントに「編集者」権限を付与
   - または、サービスアカウントを直接共有してもらう

### 共有後も403エラーが出る場合

**原因1**: 権限反映の遅延（まれに発生）

**解決策**:
```bash
# Cloud Runを再起動（新しいインスタンスで権限を再読み込み）
gcloud run services update rag-backend \
  --region=us-central1 \
  --project=fractal-ecosystem \
  --set-env-vars="FORCE_RESTART=$(date +%s)"
```

**原因2**: 間違ったスプレッドシートを共有した

**解決策**:
- スプレッドシートIDを再確認: `1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA`
- URLが以下と一致することを確認:
  https://docs.google.com/spreadsheets/d/1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA/edit

---

## 📊 なぜこの作業が必要なのか？

### 技術的背景

RAGシステムは医療用語データベースをGoogle Spreadsheetに保存しています。

**権限の種類**:

1. **IAMロール（roles/sheets.developer）** ← すでに付与済み ✅
   - GCPプロジェクトレベルの権限
   - **Sheets APIへのアクセス**を許可

2. **スプレッドシート個別の共有** ← **これが未設定** ❌
   - 特定のスプレッドシートファイルへのアクセス
   - **実際のデータ読み書き**を許可

### 現在の状況

```
✅ IAMロール: 付与済み（Google Sheets API呼び出しOK）
❌ スプレッドシート共有: 未設定（403エラー発生中）
```

**つまり**: API自体は使えるが、**特定のスプレッドシートファイルに対する権限がない**状態。

ファイルレベルの共有を追加することで、サービスアカウントがスプレッドシートのデータを読み書きできるようになります。

---

## 🎓 Google Sheets権限の仕組み

### アナロジー: 建物のセキュリティ

| レベル | Google Sheets | 建物の例 |
|--------|--------------|---------|
| **Level 1** | IAMロール（roles/sheets.developer） | ビルの入館証 |
| **Level 2** | スプレッドシート共有 | 特定の部屋の鍵 |

**IAMロールだけ付与した状態** = ビルには入れるが、部屋のドアが開かない

**スプレッドシート共有を追加** = 部屋の鍵も受け取り、データにアクセス可能

---

## 📈 作業完了後の期待される効果

### Before（現在）

```
Frontend → Backend → Sheets API (✅ IAM権限OK)
                   ↓
                 403 Permission Denied (❌ ファイル権限NG)
                   ↓
                 RAG検索失敗 → コンテキスト取得0件
                   ↓
                 Gemini API実行されるが...
                   ↓
                 SSEストリーム0チャンク (Frontend側で totalChunks: 0)
```

### After（共有設定後）

```
Frontend → Backend → Sheets API (✅ IAM権限OK)
                   ↓
                 200 OK (✅ ファイル権限OK)
                   ↓
                 RAG検索成功 → コンテキスト取得5件
                   ↓
                 Gemini API実行 + コンテキスト提供
                   ↓
                 SSEストリーム正常配信 (Frontendで totalChunks: 5+)
                   ↓
                 ✅ チャット回答表示成功！
```

---

## 🔗 関連ドキュメント

- [Google Sheets API 権限設定](https://developers.google.com/sheets/api/guides/authorizing)
- [サービスアカウント共有ベストプラクティス](https://cloud.google.com/iam/docs/best-practices-service-accounts)
- [Cloud Run サービスアカウント設定](https://cloud.google.com/run/docs/securing/service-identity)

---

## 📞 サポート

作業中に問題が発生した場合:

1. このドキュメントの「トラブルシューティング」セクションを確認
2. Cloud Runログで詳細なエラーメッセージを確認
3. `docs/PRODUCTION_ISSUES_ROOT_CAUSE_ANALYSIS_2025-10-27.md` を参照

---

**作成日**: 2025-10-28
**最終更新**: 2025-10-28
**ステータス**: アクティブ（要対応）
