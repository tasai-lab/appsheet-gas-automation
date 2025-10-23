# Appsheet_名刺取り込み - OAuth2認証ガイド

## 📚 参考プロジェクト

このプロジェクトのOAuth2実装は以下のプロジェクトを参考にしています:
- `Appsheet_訪問看護_通常記録` (CLAUDE.md)
- `Appsheet_営業_音声記録` (vertex_ai_service.gs, config.gs)

---

## 🔐 OAuth2認証について

### 基本原理

Google Apps ScriptからVertex AI APIを呼び出すには、**OAuth2認証**が必要です。

```javascript
// OAuth2トークンの取得方法
const token = ScriptApp.getOAuthToken();

// Vertex AI API呼び出し時にヘッダーに含める
const options = {
  method: 'post',
  contentType: 'application/json',
  payload: JSON.stringify(requestBody),
  headers: {
    'Authorization': `Bearer ${ScriptApp.getOAuthToken()}`
  },
  muteHttpExceptions: true
};

const response = UrlFetchApp.fetch(endpoint, options);
```

### 必要なOAuth2スコープ

`appsscript.json`に以下のスコープを定義:

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/cloud-platform"
  ]
}
```

**重要**: `cloud-platform`スコープがVertex AI APIに必須です!

---

## ✅ OAuth2承認手順（初回実行時）

### 手順1: GASエディターを開く

```
https://script.google.com/d/1mwwFgGKKmFDw25xskQ_uRM8cTGNoEZYOqbJe1w6rlvru76vD02YG97Po/edit
```

### 手順2: テスト関数を実行

1. `test_functions.gs`を開く
2. 関数リストから`testOAuth2Authorization`を選択
3. 「実行」ボタン（▶）をクリック

### 手順3: 権限確認ダイアログが表示される

```
承認が必要です
このプロジェクトには、お使いのアカウントに関する情報へのアクセス権限が必要です。
```

→ **「権限を確認」**をクリック

### 手順4: Googleアカウントを選択

アカウントを選択すると、以下のような警告が表示される場合があります:

```
このアプリは確認されていません
```

→ **「詳細」**をクリック  
→ **「～（安全ではないページ）に移動」**をクリック

### 手順5: スコープを確認して許可

以下のスコープが表示されます:

```
このアプリには以下のアクセス権限が必要です:

✓ Google スプレッドシートの表示と管理
✓ Google ドライブのファイルの表示と管理  
✓ 外部サービスへの接続
✓ Google Cloud Platform サービスへのアクセス ← これが重要!
```

→ **「許可」**をクリック

### 手順6: 承認完了を確認

実行ログに以下のメッセージが表示されればOK:

```
✅ OAuth2トークン取得成功
トークン: ya29.a0AfB_byABC...
```

---

## 🚨 トラブルシューティング

### エラー1: 403 - Request had insufficient authentication scopes

**原因**: OAuth2スコープが不足しています（特に`cloud-platform`）

**解決方法**:

1. `appsscript.json`を確認:
   ```json
   {
     "oauthScopes": [
       "https://www.googleapis.com/auth/cloud-platform"  ← これがあるか確認
     ]
   }
   ```

2. GASエディターで再承認:
   - `testOAuth2Authorization()`を実行
   - 全スコープを確認して「許可」

3. ブラウザのキャッシュをクリア:
   - Chromeの場合: `Ctrl+Shift+Delete` → キャッシュクリア
   - 再度GASエディターを開く

### エラー2: 承認ダイアログが表示されない

**原因**: 既に一部のスコープが承認されているため、新しいスコープが自動承認できない

**解決方法**:

```javascript
// GASエディターで以下の関数を実行（強制再承認）
function forceOAuth2Reauthorization() {
  // 全スコープを強制的に確認
  const token = ScriptApp.getOAuthToken();
  Logger.log('OAuth Token: ' + token.substring(0, 20) + '...');
  
  // Vertex AI APIを呼び出してスコープを検証
  const endpoint = getVertexAIEndpoint(VERTEX_AI_CONFIG.ocrModel);
  Logger.log('Vertex AI Endpoint: ' + endpoint);
}
```

### エラー3: Vertex AI API Error: 403

**原因1**: GCPプロジェクトでVertex AI APIが有効化されていない

**解決方法**:
1. GCP Console: https://console.cloud.google.com/
2. プロジェクト選択: `macro-shadow-458705-v8`
3. 「APIとサービス」→「ライブラリ」
4. 「Vertex AI API」を検索
5. 「有効にする」をクリック

**原因2**: GCPプロジェクトのIAM権限不足

**解決方法**:
1. GCP Console → IAM
2. 実行ユーザー（GASを実行しているGoogleアカウント）を確認
3. 以下のロールを付与:
   - `Vertex AI User`
   - `Service Usage Consumer`

---

## 📝 実装例

### config.gsでのOAuth2トークン取得

```javascript
/**
 * OAuth2トークンを取得
 * @returns {string} - アクセストークン
 */
function getOAuth2Token() {
  return ScriptApp.getOAuthToken();
}
```

### ocr_service.gsでのVertex AI呼び出し

```javascript
function callVertexAIForOCR(prompt, imageParts) {
  const endpoint = getVertexAIEndpoint(VERTEX_AI_CONFIG.ocrModel);
  
  const requestBody = {
    contents: [{ parts: [{ text: prompt }, ...imageParts] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: VERTEX_AI_CONFIG.ocrTemperature,
      maxOutputTokens: VERTEX_AI_CONFIG.ocrMaxOutputTokens
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    headers: {
      'Authorization': `Bearer ${getOAuth2Token()}`  // ← OAuth2トークン使用
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(endpoint, options);
  const responseCode = response.getResponseCode();
  
  // 403エラーの特別処理
  if (responseCode === 403) {
    const errorText = response.getContentText();
    if (errorText.includes('insufficient authentication scopes')) {
      throw new Error(
        'OAuth2認証エラー: cloud-platformスコープが不足しています。\n\n' +
        '解決方法:\n' +
        '1. GASエディターで testOAuth2Authorization() を実行\n' +
        '2. 「権限を確認」→「許可」をクリック\n' +
        '3. cloud-platformスコープを含む全権限を承認\n' +
        '4. 再度処理を実行'
      );
    }
  }
  
  return response;
}
```

---

## 🎯 チェックリスト

OAuth2認証が正しく動作するための確認項目:

### appsscript.json
- [ ] `cloud-platform`スコープが含まれている
- [ ] `spreadsheets`スコープが含まれている
- [ ] `drive`スコープが含まれている
- [ ] `script.external_request`スコープが含まれている

### GASエディター
- [ ] `testOAuth2Authorization()`が正常実行される
- [ ] OAuth2トークンが取得できる（ログ確認）
- [ ] 全スコープが承認されている

### GCPプロジェクト
- [ ] Vertex AI APIが有効化されている
- [ ] プロジェクトID: `macro-shadow-458705-v8`
- [ ] リージョン: `us-central1`
- [ ] IAM権限が正しく設定されている

### 実行テスト
- [ ] `testOCRExtraction()`が正常実行される
- [ ] Vertex AI APIからの応答が取得できる
- [ ] 403エラーが発生しない

---

## 📚 関連ドキュメント

- [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md) - リファクタリング完了報告
- [Vertex AI API Documentation](https://cloud.google.com/vertex-ai/docs/reference/rest)
- [Apps Script OAuth Scopes](https://developers.google.com/apps-script/guides/services/authorization)

---

**作成日**: 2025-10-23  
**バージョン**: 2.0.0  
**参考プロジェクト**: Appsheet_訪問看護_通常記録, Appsheet_営業_音声記録
