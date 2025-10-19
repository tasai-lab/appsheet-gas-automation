# 🚨 書類OCR - 最初に読んでください

**作成日**: 2025-10-20
**対象**: 書類OCRプロジェクトを初めて使用する方

---

## ❌ 現在のエラーについて

以下のエラーが発生しています：

```
TypeError: Cannot read properties of undefined (reading 'match')
normalizeModelNameOCR @ modules_geminiClient.gs:632
```

**原因**: Script Propertiesが設定されていません

---

## ✅ 解決方法（3ステップ）

### ステップ1: GASエディタを開く

1. Google Apps Scriptエディタを開く
2. プロジェクト: **Appsheet_訪問看護_書類OCR**

### ステップ2: Script Propertiesを初期化

**方法A: 自動セットアップ（推奨）**

1. `test_functions.gs` を開く
2. 関数を選択: `setupScriptPropertiesForDocumentOCR`
3. 「実行」ボタンをクリック
4. 実行ログで設定内容を確認

実行ログに以下のように表示されれば成功：
```
============================================================
書類OCR - Script Properties 初期化
============================================================
[Script Property] 一括設定成功: 9件
=== スクリプトプロパティ一覧 ===
GCP_PROJECT_ID: macro-shadow-458705-v8
GCP_LOCATION: us-central1
VERTEX_AI_MODEL: gemini-2.5-flash
...

✅ 初期化完了！
```

**方法B: 手動セットアップ**

GASエディタ > プロジェクト設定 > スクリプト プロパティ

以下を追加：

| キー | 値 |
|------|-----|
| `GCP_PROJECT_ID` | `macro-shadow-458705-v8` |
| `GCP_LOCATION` | `us-central1` |
| `VERTEX_AI_MODEL` | `gemini-2.5-flash` |
| `VERTEX_AI_TEMPERATURE` | `0.1` |
| `VERTEX_AI_MAX_OUTPUT_TOKENS` | `20000` |
| `USE_VERTEX_AI` | `true` |
| `ENABLE_DUPLICATION_PREVENTION` | `true` |

### ステップ3: 設定を確認

1. `test_functions.gs` を開く
2. 関数を選択: `checkScriptPropertiesSetup`
3. 「実行」ボタンをクリック

期待される出力：
```
============================================================
Script Properties 設定確認
============================================================

【必須プロパティのチェック】
✅ GCP_PROJECT_ID: macro-shadow-458705-v8
✅ GCP_LOCATION: us-central1
✅ VERTEX_AI_MODEL: gemini-2.5-flash
✅ VERTEX_AI_TEMPERATURE: 0.1
✅ VERTEX_AI_MAX_OUTPUT_TOKENS: 20000
✅ USE_VERTEX_AI: true
✅ ENABLE_DUPLICATION_PREVENTION: true

【GCP設定の詳細】
Project ID: macro-shadow-458705-v8
Location: us-central1
Model: gemini-2.5-flash
Temperature: 0.1
Max Tokens: 20000
Use Vertex AI: true

============================================================
✅ 全ての設定が完了しています！
テスト関数を実行できます。
============================================================
```

---

## 🧪 テスト実行

設定完了後、以下のテスト関数を実行できます：

### テスト前の準備

1. Google Driveにテスト用PDFをアップロード
2. `test_functions.gs` のテスト関数を開く
3. `TEST_FILE_PATH` を実際のファイル名に変更

例：
```javascript
function testMedicalInsurance() {
  // ⚠️ この行を変更
  const TEST_FILE_PATH = '2025-09-07_医療保険証資格確認_伊藤進.pdf';

  // ... 以下省略
}
```

### 利用可能なテスト関数

- `testMedicalInsurance()` - 医療保険証
- `testLTCIInsurance()` - 介護保険証
- `testPublicSubsidy()` - 公費受給者証
- `testBankAccount()` - 口座情報
- `testInstruction()` - 指示書
- `testCopayCert()` - 負担割合証
- `testServiceProvisionForm()` - 提供票

---

## 📊 処理フロー

```
setupScriptPropertiesForDocumentOCR()
  ↓ Script Propertiesに設定を保存
checkScriptPropertiesSetup()
  ↓ 設定内容を確認
testMedicalInsurance() など
  ↓ ファイルパスからファイルIDを取得
  ↓ Vertex AI APIでOCR処理
  ↓ 構造化データ抽出
  ↓ AppSheet APIでレコード作成
  ✅ 完了
```

---

## ❓ よくある質問

### Q1: `Cannot read properties of undefined (reading 'match')` エラーが出る

**A**: Script Propertiesが未設定です。ステップ2を実行してください。

### Q2: `GCP_PROJECT_IDが設定されていません` エラーが出る

**A**: `setupScriptPropertiesForDocumentOCR()` を実行してください。

### Q3: テストファイルが見つからない

**A**: `TEST_FILE_PATH` を以下のいずれかの形式で指定してください：
- ファイル名: `"医療保険証.pdf"`
- パス: `"テスト書類/医療保険証.pdf"`
- URL: `"https://drive.google.com/file/d/1a2b.../view"`

### Q4: `Browser.msgBox() cannot be called from this context` エラーが出る

**A**: `clearAllScriptProperties()` は無効化されています。全削除が必要な場合は `confirmClearAllScriptProperties()` を使用してください（注意：全削除されます）。

---

## 📞 サポート

**担当**: Fractal Group 開発チーム
**Email**: t.asai@fractal-group.co.jp

**詳細ドキュメント**:
- `SETUP_SCRIPT_PROPERTIES.md` - 詳細なセットアップ手順
- `README.md` - プロジェクト概要
- `SPECIFICATIONS.md` - 技術仕様
- `FLOW.md` - 処理フロー図

---

## ✅ チェックリスト

初回セットアップ:
- [ ] `setupScriptPropertiesForDocumentOCR()` を実行
- [ ] `checkScriptPropertiesSetup()` で確認（全て✅であること）
- [ ] テスト用PDFをDriveにアップロード
- [ ] テスト関数の `TEST_FILE_PATH` を変更
- [ ] テスト関数を実行して動作確認

**全て完了したらテスト実行できます！**

---

**最終更新**: 2025-10-20
