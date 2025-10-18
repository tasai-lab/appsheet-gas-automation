# 共有リソース (Shared Resources)

**カテゴリ**: 共通モジュール・ライブラリ
**最終更新**: 2025-10-18

---

## 📋 概要

すべてのプロジェクトで共有される再利用可能なモジュール、ライブラリ、ユーティリティを管理します。

---

## 🗂️ ディレクトリ構成

```
shared/
├── README.md          # このファイル
├── modules/           # 共通モジュール
│   └── common/        # 旧「共通モジュール」フォルダー
└── lib/               # ライブラリ・ユーティリティ
```

---

## 📦 共通モジュール (modules/)

### [modules/common/](./modules/common/)

旧「共通モジュール」フォルダーから移動。複数のプロジェクトで使用される共通処理を提供します。

**主なモジュール**:

#### 1. API呼び出し制限モジュール
**ファイル**: `ApiCallLimiter.gs`

**機能**:
- API呼び出し回数の追跡
- 制限超過の検出
- 統計情報の出力

**使用方法**:
```javascript
// メイン処理開始時
resetApiCallCounter();
setApiCallLimit(3);

// API呼び出し前
incrementApiCallCounter('Vertex_AI', '処理名');

// 処理終了時
logApiCallSummary();
```

**使用プロジェクト**:
- 訪問看護_通常記録
- 訪問看護_書類OCR
- その他複数プロジェクト

---

#### 2. Webhook共通処理モジュール
**ファイル**: `CommonWebhook.gs`

**機能**:
- AppSheet Webhookの標準化されたハンドリング
- エラーハンドリング
- JSON レスポンス生成

**使用方法**:
```javascript
function doPost(e) {
  return CommonWebhook.handleDoPost(e, function(params) {
    params.scriptName = 'プロジェクト名';
    return processRequest(params.param1, params.param2);
  });
}
```

---

#### 3. テスト共通モジュール
**ファイル**: `CommonTest.gs`

**機能**:
- テストデータ管理
- テスト実行フレームワーク
- モックデータ生成

**使用方法**:
```javascript
function testProcessRequest() {
  const testParams = {
    userId: 'test-user',
    data: 'sample'
  };

  return CommonTest.runTest(
    (params) => processRequest(params.userId, params.data),
    testParams,
    'プロジェクト名'
  );
}
```

---

## 📚 ライブラリ (lib/)

**今後追加予定**:

- OAuth2 認証ヘルパー
- Vertex AI クライアント
- AppSheet APIラッパー
- ロギング・モニタリング
- エラーハンドリング

---

## 🔄 使用方法

### モジュールのインポート

Google Apps Scriptでは、同じプロジェクト内のファイルは自動的に読み込まれます。

**プロジェクト間で共有する場合**:

1. **ライブラリとして公開**:
   ```
   GASプロジェクト → デプロイ → ライブラリ
   ```

2. **他のプロジェクトで使用**:
   ```javascript
   // リソース → ライブラリ → ライブラリIDを追加
   CommonModule.resetApiCallCounter();
   ```

3. **コピー&ペースト**:
   - 小規模なユーティリティは直接コピー

---

## 🛠️ 開発ガイドライン

### 新しいモジュールの追加

1. **命名規則**:
   - PascalCase (例: `ApiCallLimiter.gs`)
   - 機能が明確な名前

2. **ドキュメント**:
   - JSDoc コメント必須
   - 使用例を含める

3. **テスト**:
   - ユニットテスト関数を含める
   - エッジケースをカバー

### コーディング規約

```javascript
/**
 * 関数の説明
 * @param {string} param1 - パラメータの説明
 * @param {Object} param2 - オブジェクトの説明
 * @returns {boolean} - 戻り値の説明
 */
function exampleFunction(param1, param2) {
  // 実装
  return true;
}
```

---

## 📊 使用統計

| モジュール | 使用プロジェクト数 | 状態 |
|-----------|-----------------|------|
| ApiCallLimiter | 5+ | ✅ Active |
| CommonWebhook | 18+ | ✅ Active |
| CommonTest | 18+ | ✅ Active |

---

## 🔐 セキュリティ

共通モジュールは複数のプロジェクトで使用されるため、特に注意が必要:

- ✅ 機密情報を含めない
- ✅ 入力検証を徹底
- ✅ エラーハンドリングを堅牢に
- ✅ ログに機密情報を出力しない

---

## 📝 TODO

- [ ] OAuth2ヘルパーモジュールの作成
- [ ] Vertex AIクライアントラッパーの作成
- [ ] エラーハンドリング標準化
- [ ] ロギングフレームワークの統一
- [ ] 共通設定管理システム

---

## 🤝 貢献

新しい共通モジュールの提案は歓迎します:

1. 複数プロジェクトで使用される機能
2. 十分にテストされたコード
3. 明確なドキュメント

**連絡先**: t.asai@fractal-group.co.jp

---

**メンテナ**: Fractal Group 開発チーム
**ライセンス**: © 2025 Fractal Group. All rights reserved.
