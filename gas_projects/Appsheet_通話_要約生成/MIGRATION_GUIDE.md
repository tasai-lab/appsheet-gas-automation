
# Appsheet_通話_要約生成 - 重複防止実装ガイド

## 自動検出情報
- Webhook ファイル: core_webhook.gs
- 推定レコードIDフィールド: callId

## 実装手順

### 1. ライブラリの追加
✅ 完了: `utils_duplicationPrevention.gs` が追加されました

### 2. doPost関数の修正

#### 修正前のコード:
```javascript
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    // 処理...
  } catch (error) {
    // エラー処理...
  }
}
```

#### 修正後のコード（推奨）:
```javascript
function doPost(e) {
  return executeWebhookWithDuplicationPrevention(e, processWebhook, {
    recordIdField: 'callId',
    enableFingerprint: true
  });
}

function processWebhook(params) {
  // 既存の処理ロジックをここに移動
  const callId = params.callId;
  
  // Gemini API呼び出しなどの処理...
  
  return {
    success: true,
    callId: callId
  };
}
```

### 3. テスト方法

1. Apps Scriptエディタでコードを保存
2. Webアプリとして再デプロイ
3. 同じリクエストを複数回送信してテスト
4. ログで重複検知を確認:
   ```
   🔒 重複検知: xxx - 状態: processing
   ```

### 4. 確認事項

- [ ] レコードIDフィールド名が正しいか確認
- [ ] Gemini API呼び出しが1回のみか確認  
- [ ] エラー時のリトライが動作するか確認
- [ ] ログに重複防止メッセージが出力されるか確認

## 詳細ドキュメント

`DUPLICATION_PREVENTION_GUIDE.md` を参照してください。
