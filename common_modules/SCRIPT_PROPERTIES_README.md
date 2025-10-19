# スクリプトプロパティ管理モジュール - 使用ガイド

**バージョン**: 1.0.0
**最終更新**: 2025-10-20

---

## 📋 概要

すべてのGASプロジェクトで共通のスクリプトプロパティ管理機能を提供するモジュールです。

### 主な機能

1. **スクリプトプロパティの設定・取得・削除**
   - 簡単なAPI で ScriptProperties を操作
   - 一括設定・取得機能

2. **重複回避機能のon/off切り替え**
   - `ENABLE_DUPLICATION_PREVENTION` プロパティで制御
   - プロジェクトごとに有効/無効を設定可能

3. **GCP / Vertex AI設定の管理**
   - GCPプロジェクト設定の一括保存・取得
   - Vertex AIモデル設定の管理

4. **セキュリティ**
   - APIキーやパスワードなどの機密情報を自動マスク
   - listScriptProperties()で安全に一覧表示

---

## 🚀 クイックスタート

### 1. 初期設定

GASエディタで以下の関数を実行してスクリプトプロパティを初期化:

```javascript
// 書類OCRプロジェクトの例
function initializeScriptPropertiesForDocumentOCR() {
  initializeScriptPropertiesForProject({
    // GCP設定
    GCP_PROJECT_ID: 'your-gcp-project-id',
    GCP_LOCATION: 'us-central1',
    VERTEX_AI_MODEL: 'gemini-2.5-flash',
    VERTEX_AI_TEMPERATURE: '0.1',
    VERTEX_AI_MAX_OUTPUT_TOKENS: '20000',
    USE_VERTEX_AI: 'true',

    // 重複回避機能（デフォルト: 有効）
    ENABLE_DUPLICATION_PREVENTION: 'true',

    // その他の設定
    LOG_LEVEL: 'INFO',
    TIMEZONE: 'Asia/Tokyo'
  });
}
```

### 2. プロパティの確認

```javascript
// 全プロパティを一覧表示
listScriptProperties();

// 出力例:
// === スクリプトプロパティ一覧 ===
// GCP_PROJECT_ID: your-gcp-project-id
// GCP_LOCATION: us-central1
// VERTEX_AI_MODEL: gemini-2.5-flash
// ENABLE_DUPLICATION_PREVENTION: true
// GOOGLE_AI_API_KEY: AIza...ZmTY (マスク表示)
```

### 3. 重複回避機能の切り替え

```javascript
// 無効化（テスト時など）
disableDuplicationPrevention();

// 有効化
enableDuplicationPrevention();

// 現在の状態を確認
showDuplicationPreventionStatus();
// 出力: [重複回避] 現在の状態: 有効
```

---

## 📚 API リファレンス

### 基本操作

#### setScriptProperty(key, value)
単一のスクリプトプロパティを設定

```javascript
setScriptProperty('API_KEY', 'your-api-key');
```

#### getScriptProperty(key, [defaultValue])
スクリプトプロパティを取得

```javascript
const apiKey = getScriptProperty('API_KEY');
const logLevel = getScriptProperty('LOG_LEVEL', 'INFO'); // デフォルト値付き
```

#### deleteScriptProperty(key)
スクリプトプロパティを削除

```javascript
deleteScriptProperty('OLD_CONFIG');
```

#### setScriptProperties(properties)
複数のプロパティを一括設定

```javascript
setScriptProperties({
  KEY1: 'value1',
  KEY2: 'value2',
  KEY3: 'value3'
});
```

#### getAllScriptProperties()
すべてのプロパティを取得

```javascript
const allProps = getAllScriptProperties();
console.log(allProps);
// { KEY1: 'value1', KEY2: 'value2', ... }
```

#### listScriptProperties()
プロパティ一覧を表示（機密情報はマスク）

```javascript
listScriptProperties();
```

---

### 重複回避機能

#### enableDuplicationPrevention()
重複回避機能を有効化

```javascript
enableDuplicationPrevention();
// [重複回避] 機能を有効化しました
```

#### disableDuplicationPrevention()
重複回避機能を無効化

```javascript
disableDuplicationPrevention();
// [重複回避] 機能を無効化しました
```

#### isDuplicationPreventionEnabled()
重複回避機能の状態を確認

```javascript
if (isDuplicationPreventionEnabled()) {
  console.log('重複回避機能は有効です');
}
```

#### showDuplicationPreventionStatus()
現在の状態を表示

```javascript
showDuplicationPreventionStatus();
// [重複回避] 現在の状態: 有効
```

---

### GCP / Vertex AI設定

#### setGCPConfig(gcpConfig)
GCP設定を一括保存

```javascript
setGCPConfig({
  projectId: 'your-project-id',
  location: 'us-central1',
  model: 'gemini-2.5-flash',
  temperature: 0.1,
  maxOutputTokens: 20000
});
```

#### getGCPConfig()
GCP設定を取得

```javascript
const gcpConfig = getGCPConfig();
console.log(gcpConfig);
// {
//   projectId: 'your-project-id',
//   location: 'us-central1',
//   model: 'gemini-2.5-flash',
//   temperature: 0.1,
//   maxOutputTokens: 20000,
//   useVertexAI: true
// }
```

#### setGoogleAIApiKey(apiKey)
Google AI Studio APIキーを設定

```javascript
setGoogleAIApiKey('AIzaSyD...');
```

#### getGoogleAIApiKey()
Google AI Studio APIキーを取得

```javascript
const apiKey = getGoogleAIApiKey();
```

---

### 初期化とセットアップ

#### initializeScriptPropertiesForProject(config)
プロジェクト固有の設定で初期化

```javascript
initializeScriptPropertiesForProject({
  GCP_PROJECT_ID: 'your-project-id',
  VERTEX_AI_MODEL: 'gemini-2.5-flash',
  ENABLE_DUPLICATION_PREVENTION: 'true',
  // ... その他の設定
});
```

#### clearAllScriptProperties()
すべてのプロパティを削除（安全のため無効化）

```javascript
// ⚠️ この関数は安全のため無効化されています
clearAllScriptProperties();
// エラー: 安全のため無効化されています

// 全削除を実行するには以下を使用:
confirmClearAllScriptProperties();
// 全てのスクリプトプロパティが削除されます
```

---

## 🔧 プロジェクトごとのカスタマイズ

### 書類OCRプロジェクト

```javascript
function initializeForDocumentOCR() {
  initializeScriptPropertiesForProject({
    GCP_PROJECT_ID: 'your-gcp-project-id',
    VERTEX_AI_MODEL: 'gemini-2.5-flash',
    VERTEX_AI_TEMPERATURE: '0.1',
    ENABLE_DUPLICATION_PREVENTION: 'true'
  });
}
```

### 通話要約プロジェクト

```javascript
function initializeForCallSummary() {
  initializeScriptPropertiesForProject({
    GCP_PROJECT_ID: 'your-gcp-project-id',
    VERTEX_AI_MODEL: 'gemini-2.5-flash',
    VERTEX_AI_TEMPERATURE: '0.0',
    ENABLE_TRANSCRIPT: 'false',  // コスト削減
    ENABLE_DUPLICATION_PREVENTION: 'true'
  });
}
```

### 営業音声記録プロジェクト

```javascript
function initializeForSalesAudio() {
  initializeScriptPropertiesForProject({
    GCP_PROJECT_ID: 'your-gcp-project-id',
    VERTEX_AI_MODEL: 'gemini-2.5-pro',  // 高精度モデル
    VERTEX_AI_TEMPERATURE: '0.0',
    ENABLE_DUPLICATION_PREVENTION: 'true'
  });
}
```

---

## 🧪 テストとデバッグ

### テスト関数の実行

```javascript
// 機能全体のテスト
testScriptPropertiesManager();

// 出力例:
// === スクリプトプロパティ管理のテスト ===
//
// [テスト1] 単一プロパティの設定・取得
// [Script Property] 設定成功: TEST_KEY = test_value
// 取得した値: test_value
//
// [テスト2] デフォルト値
// デフォルト値: default
//
// [テスト3] 一括設定
// [Script Property] 一括設定成功: 3件
//
// [テスト4] 全プロパティの一覧
// === スクリプトプロパティ一覧 ===
// TEST_KEY: test_value
// TEST_KEY1: value1
// ...
//
// === テスト完了 ===
```

---

## 💡 ベストプラクティス

### 1. 初期化は1回だけ

プロジェクトのセットアップ時に1回だけ `initializeScriptPropertiesForProject()` を実行してください。

### 2. 機密情報の扱い

- APIキーやパスワードは `listScriptProperties()` で自動的にマスクされます
- スクリプトエディタ外では絶対に表示しないでください

### 3. 重複回避機能

- **本番環境**: 常に有効 (`ENABLE_DUPLICATION_PREVENTION: 'true'`)
- **テスト環境**: 必要に応じて無効化可能

### 4. モデル選択

| プロジェクト | 推奨モデル | Temperature |
|------------|------------|-------------|
| 書類OCR | gemini-2.5-flash | 0.1 |
| 通話要約 | gemini-2.5-flash | 0.0 |
| 質疑応答 | gemini-2.5-pro | 0.1 |
| 営業音声 | gemini-2.5-pro | 0.0 |

---

## 🔒 セキュリティ

### 機密情報のマスク

以下のキーワードを含むプロパティは自動的にマスクされます:

- `API_KEY`
- `APIKEY`
- `PASSWORD`
- `SECRET`
- `TOKEN`
- `ACCESS_KEY`
- `PRIVATE_KEY`

### マスク表示例

```
GOOGLE_AI_API_KEY: AIza...ZmTY
GCP_PROJECT_ID: your-project-id (マスクなし)
```

---

## 📦 全プロジェクトへの展開

### 自動展開スクリプト

```bash
# 全プロジェクトに展開
python3 ツール/deploy_script_properties_manager.py

# 特定のプロジェクトのみ
python3 ツール/deploy_script_properties_manager.py --filter "通話"

# dry-runモード
python3 ツール/deploy_script_properties_manager.py --dry-run
```

### デプロイ後の確認

各プロジェクトで:

```bash
cd gas_projects/projects/.../プロジェクト名
clasp push
```

GASエディタで:

```javascript
// プロパティを確認
listScriptProperties();

// 初期化（必要に応じて）
initializeScriptPropertiesForProject({ ... });
```

---

## ❓ FAQ

### Q1: 重複回避を無効にするとどうなる？

A: Webhookの重複実行チェックがスキップされます。同じリクエストでも複数回処理されます。

### Q2: プロパティが多すぎる場合は？

A: ScriptPropertiesには約9KBの制限があります。`listScriptProperties()`で確認し、不要なプロパティは削除してください。

### Q3: 既存のプロパティは上書きされる？

A: `setScriptProperty()` や `setScriptProperties()` は既存の値を上書きします。注意してください。

### Q4: プロパティが消えてしまった場合は？

A: `initializeScriptPropertiesForProject()` を再実行して再設定してください。

---

## 🆘 トラブルシューティング

### エラー: "Script property is too large"

**原因**: プロパティの合計サイズが9KBを超えています

**解決策**:
```javascript
// 不要なプロパティを削除
deleteScriptProperty('LARGE_UNUSED_PROPERTY');

// または全削除して再初期化
clearAllScriptProperties();
initializeScriptPropertiesForProject({ ... });
```

### エラー: "Property not found"

**原因**: プロパティが設定されていません

**解決策**:
```javascript
// デフォルト値を使用
const value = getScriptProperty('MISSING_KEY', 'default_value');

// またはプロパティを設定
setScriptProperty('MISSING_KEY', 'value');
```

### 重複回避が動作しない

**確認事項**:
```javascript
// 1. 重複回避が有効か確認
showDuplicationPreventionStatus();

// 2. 有効化する
enableDuplicationPrevention();

// 3. DuplicationPreventionクラスが正しく使用されているか確認
const dupPrevention = new DuplicationPrevention('ScriptName');
console.log(dupPrevention.isEnabled());
```

---

## 📞 サポート

**担当**: Fractal Group 開発チーム
**Email**: t.asai@fractal-group.co.jp

**ドキュメント**:
- `/common_modules/script_properties_manager.gs` - ソースコード
- `/common_modules/duplication_prevention.gs` - 重複防止モジュール
- `/CLAUDE.md` - プロジェクト全体のガイド

---

**最終更新**: 2025-10-20
**バージョン**: 1.0.0
