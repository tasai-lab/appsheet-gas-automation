# GCP設定ガイド - Appsheet_通話_要約生成

## 概要
このプロジェクトは以下のGCPサービスを使用します：
- **Vertex AI API**: Gemini 2.5で音声解析
- **Cloud Storage API**: 大容量音声ファイルのアップロード

## 前提条件
- GCPプロジェクト: `macro-shadow-458705-v8`
- Cloud Storageバケット: `macro-shadow-458705-v8-call-logs`
- リージョン: `us-central1`

## 必要な設定手順

### 1. GCP APIの有効化

GCP Console (https://console.cloud.google.com/) で以下のAPIを有効化：

```bash
# Cloud Storageが有効か確認
gcloud services list --enabled --project=macro-shadow-458705-v8 | grep storage

# 有効化されていない場合
gcloud services enable storage-component.googleapis.com --project=macro-shadow-458705-v8
gcloud services enable storage-api.googleapis.com --project=macro-shadow-458705-v8
```

### 2. Apps ScriptプロジェクトとGCPプロジェクトの紐付け

1. Apps Scriptエディタを開く
2. 左メニューの「プロジェクトの設定」（歯車アイコン）をクリック
3. 「Google Cloud Platform（GCP）プロジェクト」セクションで「プロジェクトを変更」をクリック
4. GCPプロジェクト番号を入力:
   ```
   894359947651
   ```
   ※ プロジェクトID `macro-shadow-458705-v8` のプロジェクト番号
5. 「プロジェクトを設定」をクリック

### 3. Cloud Storageバケットの権限設定

Apps ScriptのサービスアカウントにCloud Storageへの書き込み権限を付与：

```bash
# Apps Scriptのサービスアカウントのメールアドレス
# プロジェクトID: macro-shadow-458705-v8
# サービスアカウント: macro-shadow-458705-v8@appspot.gserviceaccount.com

# バケットへの権限付与
gsutil iam ch serviceAccount:macro-shadow-458705-v8@appspot.gserviceaccount.com:roles/storage.objectAdmin \
  gs://macro-shadow-458705-v8-call-logs
```

または、GCP Consoleから：
1. Cloud Storage > バケット > `macro-shadow-458705-v8-call-logs`
2. 「権限」タブ
3. 「アクセス権を付与」をクリック
4. 新しいプリンシパル: `macro-shadow-458705-v8@appspot.gserviceaccount.com`
5. ロール: `ストレージ オブジェクト管理者` を選択
6. 「保存」

### 4. OAuth認証の再承認

appsscript.jsonに新しいスコープを追加したため、再認証が必要：

1. Apps Scriptエディタで任意の関数（例: `testConfig`）を実行
2. 「承認が必要です」ダイアログが表示される
3. 「権限を確認」をクリック
4. Googleアカウントを選択
5. 「詳細」をクリック → 「安全ではないページに移動」をクリック
6. すべての権限を確認して「許可」をクリック

**必要な権限:**
- ✅ Google ドライブのファイルの表示、編集、作成、削除
- ✅ Google スプレッドシートの表示、編集、作成、削除
- ✅ メールアドレスの表示
- ✅ Google Cloud Platform サービスの管理
- ✅ Cloud Storage の読み取りと書き込み

### 5. Script Propertiesの設定確認

Apps Scriptエディタで `setupScriptProperties()` を実行して設定を確認：

必須設定項目：
- `GCP_PROJECT_ID`: `macro-shadow-458705-v8`
- `GCP_LOCATION`: `us-central1`
- `GCP_BUCKET_NAME`: `macro-shadow-458705-v8-call-logs`
- `USE_CLOUD_STORAGE`: `true`

## トラブルシューティング

### エラー: "Insufficient Permission" (403)

**原因**: Apps ScriptのサービスアカウントにCloud Storageへの権限がない

**解決策**:
1. GCPプロジェクトの紐付けを確認（手順2）
2. Cloud Storageバケットの権限を確認（手順3）
3. OAuth認証を再実行（手順4）

### エラー: "The caller does not have permission"

**原因**: Vertex AI APIが有効化されていない、またはサービスアカウントに権限がない

**解決策**:
```bash
# Vertex AI APIを有効化
gcloud services enable aiplatform.googleapis.com --project=macro-shadow-458705-v8
```

### GCPプロジェクト番号の確認方法

```bash
# gcloud CLIで確認
gcloud projects describe macro-shadow-458705-v8 --format="value(projectNumber)"

# または GCP Console
# ダッシュボード > プロジェクト情報 > プロジェクト番号
```

## 確認コマンド

すべての設定が正しいか確認：

```bash
# APIの有効化状況
gcloud services list --enabled --project=macro-shadow-458705-v8

# バケットの存在確認
gsutil ls gs://macro-shadow-458705-v8-call-logs

# バケットのIAM権限確認
gsutil iam get gs://macro-shadow-458705-v8-call-logs
```

## 参考リンク

- [Apps Script OAuth Scopes](https://developers.google.com/apps-script/guides/services/authorization)
- [Cloud Storage API Documentation](https://cloud.google.com/storage/docs/json_api)
- [Vertex AI API Documentation](https://cloud.google.com/vertex-ai/docs/reference)
