# API使用量記録機能 テスト実行ガイド

## テスト対象
API使用量（トークン数・料金）が実行ログスプレッドシートに正しく記録されることを確認

## テスト実行手順

### 1. 通話_質疑応答プロジェクト（Gemini API）

#### GASエディタを開く
```bash
cd "/Users/t.asai/code/appsheet-gas-automation/gas_projects/projects/calls/Appsheet_通話_質疑応答"
clasp open
```

または、直接URLを開く:
```
https://script.google.com/home/projects/1pWf6b_L9-NQ0nAnxSq9WcJNyh_DZvCm5Ny5uZxz2J0PsaFfMDXWlNxHV
```

#### テスト関数を実行

1. **Flashモデルのテスト**
   - 関数: `testProcessRequestFlash`
   - 選択して実行ボタン（▶）をクリック
   - 実行ログで以下を確認:
     - `[テスト] Gemini Flash モード`
     - `使用モデル: gemini-2.5-flash`
     - `API使用量情報を記録しました`
     - `実行ログをスプレッドシートに保存しました`

2. **Proモデルのテスト**
   - 関数: `testProcessRequestPro`
   - 選択して実行ボタン（▶）をクリック
   - 実行ログで以下を確認:
     - `[テスト] Gemini Pro モード`
     - `使用モデル: gemini-2.5-pro`
     - `API使用量情報を記録しました`
     - `実行ログをスプレッドシートに保存しました`

#### 実行ログスプレッドシートで検証

実行ログスプレッドシート:
```
https://docs.google.com/spreadsheets/d/16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA
```

**確認項目:**
- [ ] モデル列に「gemini-2.5-flash」または「gemini-2.5-pro」が記録されている
- [ ] Input Tokens列に数値が記録されている（例: 1000-5000）
- [ ] Output Tokens列に数値が記録されている（例: 500-2000）
- [ ] Input料金(円)に金額が記録されている（小数点2桁、例: 0.45）
- [ ] Output料金(円)に金額が記録されている（小数点2桁、例: 3.75）
- [ ] 合計料金(円)に合計金額が記録されている（小数点2桁、例: 4.20）

**価格の検証:**
- Flashモデル: Input $0.30/1M tokens, Output $2.50/1M tokens
- Proモデル: Input $1.25/1M tokens, Output $10.0/1M tokens
- 為替レート: $1 = ¥150

例（Flashモデル、1000 input tokens, 500 output tokens）:
- Input料金(円) = (1000 / 1000000) × 0.30 × 150 = 0.045 → 0.05円
- Output料金(円) = (500 / 1000000) × 2.50 × 150 = 0.1875 → 0.19円
- 合計料金(円) = 0.24円

---

### 2. 通話_要約生成プロジェクト（Vertex AI音声）

**注意:** 実際の音声ファイルが必要なため、ダミーテストは不可。
AppSheetから実際のWebhookで実行する必要があります。

#### 確認事項
- モデル: `vertex-ai-gemini-2.5-flash`
- 音声入力価格: $1.00/1M tokens
- テキスト出力価格: $2.50/1M tokens

---

### 3. 利用者_質疑応答プロジェクト（Vertex AI Pro）

#### GASエディタを開く
```bash
cd "/Users/t.asai/code/appsheet-gas-automation/gas_projects/projects/clients/Appsheet_利用者_質疑応答"
clasp open
```

#### テスト関数を確認
- 既存のテスト関数があれば実行
- なければ、通話_質疑応答と同様のテスト関数を作成

#### 確認事項
- モデル: `gemini-2.5-pro`（Vertex AI Pro）
- 価格: Input $1.25/1M tokens, Output $10.0/1M tokens

---

## トラブルシューティング

### 問題: API使用量情報が記録されない

**確認箇所:**
1. `response.usageMetadata` がnullでないか
2. `logger.setUsageMetadata()` が呼ばれているか
3. `logger.saveToSpreadsheet()` が呼ばれているか

**デバッグ方法:**
```javascript
Logger.log('usageMetadata:', JSON.stringify(response.usageMetadata));
```

### 問題: 料金計算が間違っている

**確認箇所:**
1. `gemini_client.gs` の価格表
2. `EXCHANGE_RATE_USD_TO_JPY = 150` が正しいか
3. 計算式: `(tokens / 1000000) * pricePerMillion * exchangeRate`

### 問題: スプレッドシートにログが書き込まれない

**確認箇所:**
1. スプレッドシートID: `16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA`
2. シート名: `実行履歴`
3. OAuth権限: `https://www.googleapis.com/auth/spreadsheets`

---

## テスト完了確認

- [ ] Gemini Flash モデルで正常動作
- [ ] Gemini Pro モデルで正常動作
- [ ] API使用量（トークン数）が記録される
- [ ] API料金（日本円）が正しく計算・記録される
- [ ] 実行ログスプレッドシートに全項目が記録される

---

## 次のステップ

テスト完了後:
1. 全プロジェクトに更新をコミット
2. 本番環境でのモニタリング開始
3. 月次コストレポートの作成
