# 書類OCR - Script Properties 設定手順

## 🚨 重要: 初回セットアップ必須

書類OCRプロジェクトを実行する前に、以下のScript Propertiesを設定する必要があります。

---

## 📋 設定手順

### 方法1: 初期化関数を使用（推奨）

GASエディタで以下の関数を実行してください：

```javascript
function setupScriptPropertiesForDocumentOCR() {
  initializeScriptPropertiesForProject({
    // GCP設定（必須）
    GCP_PROJECT_ID: 'macro-shadow-458705-v8',  // あなたのGCPプロジェクトID
    GCP_LOCATION: 'us-central1',
    VERTEX_AI_MODEL: 'gemini-2.5-flash',
    VERTEX_AI_TEMPERATURE: '0.1',
    VERTEX_AI_MAX_OUTPUT_TOKENS: '20000',
    USE_VERTEX_AI: 'true',

    // 重複回避機能
    ENABLE_DUPLICATION_PREVENTION: 'true',

    // その他の設定
    LOG_LEVEL: 'INFO',
    TIMEZONE: 'Asia/Tokyo'
  });
}
```

**実行方法**:
1. GASエディタを開く
2. `script_properties_manager.gs` を開く
3. 上記の関数をファイルの最後に追加
4. 関数を選択して「実行」ボタンをクリック
5. 実行ログで設定内容を確認

---

### 方法2: 手動で設定

**GASエディタ > プロジェクト設定 > スクリプト プロパティ**

以下のキーと値を追加：

| キー | 値 | 説明 |
|------|-----|------|
| `GCP_PROJECT_ID` | `macro-shadow-458705-v8` | GCPプロジェクトID（必須）|
| `GCP_LOCATION` | `us-central1` | GCPロケーション |
| `VERTEX_AI_MODEL` | `gemini-2.5-flash` | 使用するモデル |
| `VERTEX_AI_TEMPERATURE` | `0.1` | Temperature設定 |
| `VERTEX_AI_MAX_OUTPUT_TOKENS` | `20000` | 最大出力トークン数 |
| `USE_VERTEX_AI` | `true` | Vertex AI使用フラグ |
| `ENABLE_DUPLICATION_PREVENTION` | `true` | 重複回避有効化 |
| `LOG_LEVEL` | `INFO` | ログレベル |
| `TIMEZONE` | `Asia/Tokyo` | タイムゾーン |

---

## ✅ 設定確認

設定後、以下の関数を実行して確認：

```javascript
// 設定一覧を表示
listScriptProperties();

// GCP設定を確認
function checkGCPConfig() {
  const config = getGCPConfig();
  Logger.log('=== GCP設定 ===');
  Logger.log(`Project ID: ${config.projectId}`);
  Logger.log(`Location: ${config.location}`);
  Logger.log(`Model: ${config.model}`);
  Logger.log(`Temperature: ${config.temperature}`);
  Logger.log(`Max Tokens: ${config.maxOutputTokens}`);
  Logger.log(`Use Vertex AI: ${config.useVertexAI}`);
}
```

**期待される出力**:
```
=== GCP設定 ===
Project ID: macro-shadow-458705-v8
Location: us-central1
Model: gemini-2.5-flash
Temperature: 0.1
Max Tokens: 20000
Use Vertex AI: true
```

---

## 🔧 トラブルシューティング

### エラー: `Cannot read properties of undefined (reading 'match')`

**原因**: `VERTEX_AI_MODEL` が設定されていない

**解決策**:
1. 上記の初期化関数を実行
2. または手動で `VERTEX_AI_MODEL` を設定

### エラー: `GCP_PROJECT_IDが設定されていません`

**原因**: `GCP_PROJECT_ID` が設定されていない

**解決策**:
1. Script Propertiesに `GCP_PROJECT_ID` を追加
2. 値: `macro-shadow-458705-v8`

---

## 📞 サポート

設定に問題がある場合は、実行ログを確認してください。

**デバッグ用関数**:
```javascript
function debugScriptProperties() {
  Logger.log('=== デバッグ情報 ===');

  const allProps = getAllScriptProperties();
  Logger.log(`設定済みプロパティ数: ${Object.keys(allProps).length}`);

  const requiredKeys = [
    'GCP_PROJECT_ID',
    'VERTEX_AI_MODEL',
    'USE_VERTEX_AI'
  ];

  requiredKeys.forEach(key => {
    const value = getScriptProperty(key);
    Logger.log(`${key}: ${value ? '✅ 設定済み' : '❌ 未設定'}`);
  });
}
```

---

**最終更新**: 2025-10-20
