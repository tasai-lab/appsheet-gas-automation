---
description: GASプロジェクトのテスト関数を実行する
---

指定されたGASプロジェクトのテスト関数を分析し、実行方法を説明してください。

## 実行手順

1. プロジェクトの `scripts/test_functions.gs` を確認
2. 利用可能なテスト関数をリストアップ
3. 各テスト関数の目的を説明
4. GASエディタでの実行方法を案内
5. 期待される結果を説明

## テスト関数の例

```javascript
function testProcessRequest() {
  const testParams = {
    record_id: 'test-123',
    // その他のテストデータ
  };
  const result = processRequest(testParams);
  console.log(result);
}
```

## 注意事項

- テスト関数はWebhookをトリガーせず直接実行
- GASエディタで実行ログを確認
- 本番データへの影響に注意
