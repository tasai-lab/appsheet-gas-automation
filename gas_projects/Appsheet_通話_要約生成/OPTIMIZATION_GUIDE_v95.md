# 通話要約プロジェクト 最適化ガイド (v95)

## 📊 最適化の概要

**実施日**: 2025年10月17日  
**バージョン**: v95  
**目的**: API呼び出し回数の削減とコスト最適化

## 🎯 最適化内容

### 1. API呼び出しの統合

**変更前 (v94まで)**:
```
1. 音声解析API呼び出し (core_vertexai.gs)
   → 要約、全文、アクションを取得
   
2. 依頼情報抽出API呼び出し (core_request_creation.gs)
   → 要約と全文から依頼情報を抽出
```

**変更後 (v95)**:
```
1. 統合API呼び出し (core_vertexai_v2.gs)
   → 要約、全文、アクション、依頼情報を1回で取得
```

### 2. Cloud Storage → base64 inlineData

**変更前**:
- Cloud Storageに音声ファイルをアップロード
- Vertex AIがCloud Storage URIを参照
- 処理後にファイルを削除

**変更後**:
- 音声ファイルをbase64エンコード
- リクエストボディに直接含める（inlineData）
- ファイルサイズ制限: 20MB

**メリット**:
- Cloud Storage料金: $0
- アップロード/削除処理の削減
- コードがシンプル

## 💰 コスト比較

### 1回あたりのコスト（5-10分の通話）

| 項目 | v94 | v95 | 削減額 |
|------|-----|-----|--------|
| 音声解析API | $0.0191 | $0.0191 | $0 |
| 依頼作成API | $0.0005 | **$0** | **$0.0005** |
| Cloud Storage | $0.0002 | **$0** | **$0.0002** |
| **合計** | **$0.0198** | **$0.0191** | **$0.0007 (3.5%)** |

### 月間コスト試算

#### ケース1: 月100通話

| 項目 | v94 | v95 | 削減額 |
|------|-----|-----|--------|
| API料金 | $1.96 | $1.91 | $0.05 |
| Storage料金 | $0.02 | $0.00 | $0.02 |
| **合計** | **$1.98** | **$1.91** | **$0.07 (3.5%)** |

#### ケース2: 月1000通話

| 項目 | v94 | v95 | 削減額 |
|------|-----|-----|--------|
| API料金 | $19.60 | $19.10 | $0.50 |
| Storage料金 | $0.20 | $0.00 | $0.20 |
| **合計** | **$19.80** | **$19.10** | **$0.70 (3.5%)** |

## ⚡ パフォーマンス改善

### 実行時間の短縮

| 処理 | v94 | v95 | 短縮 |
|------|-----|-----|------|
| 音声解析 | 10-12秒 | 10-12秒 | 0秒 |
| 依頼情報抽出 | 3-5秒 | **0秒** | **3-5秒** |
| Cloud Storage処理 | 2-3秒 | **0秒** | **2-3秒** |
| **合計** | **15-20秒** | **10-12秒** | **5-8秒 (30%)** |

## 📁 変更ファイル

### 新規作成

1. **`core_vertexai_v2.gs`**
   - 統合プロンプト生成 (`generateUnifiedPrompt`)
   - base64 inlineData使用 (`callVertexAIAPIWithInlineData`)
   - 依頼情報を含むJSON検証 (`validateAndFixJSONStructure`)

2. **`core_webhook_v4.gs`**
   - 依頼情報をAIレスポンスから直接取得
   - `core_request_creation.gs`の呼び出しを廃止
   - 簡素化された依頼作成/更新ロジック

### 非推奨化

1. **`core_vertexai.gs`** → `core_vertexai_v2.gs`に置換
2. **`core_webhook_v3.gs`** → `core_webhook_v4.gs`に置換
3. **`core_request_creation.gs`** → 使用しない（将来削除予定）

## 🔧 技術仕様

### 統合JSONスキーマ

```json
{
  "summary": "Markdown形式の要約",
  "transcript": "話者別の全文文字起こし",
  "actions": [
    {
      "title": "タスク名",
      "details": "詳細",
      "action_type": "タスク",
      "assignee_id": null,
      "start_datetime": "2025-10-17T10:00:00Z",
      "duration_minutes": 30
    }
  ],
  "request_details": {
    "priority": "高",
    "request_type": "新規依頼",
    "request_reason": "依頼の経緯",
    "client_name_temp": "利用者名",
    "client_info_temp": "利用者情報",
    "next_action_date": "2025-10-18",
    "next_action_details": "次回アクション",
    "service_start_date": "2025-10-20"
  }
}
```

### API呼び出し詳細

**エンドポイント**:
```
https://us-central1-aiplatform.googleapis.com/v1/
projects/tasai-project-443908/locations/us-central1/
publishers/google/models/gemini-2.5-flash:generateContent
```

**リクエストボディ**:
```javascript
{
  "contents": [{
    "role": "user",
    "parts": [
      { "text": "統合プロンプト（要約+全文+アクション+依頼情報の指示）" },
      { 
        "inlineData": { 
          "mimeType": "audio/mp4",
          "data": "base64エンコードされた音声データ"
        } 
      }
    ]
  }],
  "generationConfig": {
    "responseMimeType": "application/json",
    "temperature": 0.2,
    "topP": 1.0,
    "topK": 32,
    "maxOutputTokens": 20000
  }
}
```

## 🚀 デプロイ手順

### 1. ファイル名変更

```bash
# 旧ファイルをバックアップ
mv core_vertexai.gs core_vertexai_v1_backup.gs
mv core_webhook_v3.gs core_webhook_v3_backup.gs

# 新ファイルをリネーム
mv core_vertexai_v2.gs core_vertexai.gs
mv core_webhook_v4.gs core_webhook_v3.gs
```

### 2. clasp push

```bash
cd gas_projects/Appsheet_通話_要約生成
clasp push
```

### 3. バージョン作成とデプロイ

```bash
python deploy_single_project.py \
  "1PK1RNjLaA7g-1-JrJ-AFn1S0D_nL5cGHNJeDtyhIap_otDnYsUAquSz6" \
  "Appsheet_通話_要約生成"
```

## ⚠️ 注意事項

### ファイルサイズ制限

**base64 inlineData**: 最大20MB

5-10分の通話音声（m4a形式）は通常2-5MBなので問題ありませんが、20MBを超える場合は以下の対応が必要:

1. **音声圧縮**: ビットレートを下げる
2. **Cloud Storage併用**: 20MB超の場合のみCloud Storage経由
3. **エラーハンドリング**: ファイルサイズチェックを追加済み

### 既存依頼の更新

既存依頼を更新する場合、以下のパラメータが必要:

```javascript
{
  "request_ids": "CLRQ-202510171030",
  "existing_request_reason": "既存の依頼理由",
  "existing_client_info": "既存の利用者情報",
  "existing_next_action": "既存の次回アクション"
}
```

## 📈 期待される効果

### 短期的効果（1ヶ月）

- コスト削減: 約$0.70（月1000通話の場合）
- 実行時間短縮: 5-8秒/通話
- GAS実行時間削減: 月1.4時間（1000通話）

### 長期的効果（1年）

- コスト削減: 約$8.40
- ユーザー体験向上: 通話後の結果取得が30%高速化
- システム安定性向上: API呼び出し回数半減

## 🔍 モニタリング

### ログ確認ポイント

```
[Vertex AI] base64 inlineData で処理開始
[Vertex AI] 解析完了 - アクション: X件, 依頼情報: あり
[依頼情報] AIから抽出した依頼情報を処理
[依頼情報] 新規依頼を作成完了 - Request ID: CLRQ-XXXX
```

### エラーパターン

1. **ファイルサイズ超過**: 
   ```
   ファイルサイズが大きすぎます: 25.3MB（上限20MB）
   ```
   → 音声圧縮または Cloud Storage併用

2. **依頼情報の欠損**:
   ```
   [JSON修復] request_details を補完
   ```
   → プロンプトを確認、AIモデルの出力を検証

## 📚 関連ドキュメント

- [Gemini vs Vertex AI 比較](../../GEMINI_VS_VERTEX_COMPARISON.md)
- [Vertex AI 価格](https://cloud.google.com/vertex-ai/pricing)
- [Gemini 2.5 Flash ドキュメント](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/gemini)

## ✅ チェックリスト

デプロイ前:
- [ ] `core_vertexai_v2.gs` 作成完了
- [ ] `core_webhook_v4.gs` 作成完了
- [ ] ファイル名変更完了
- [ ] clasp push 実行
- [ ] Script Properties 確認（`ENABLE_REQUEST_CREATION=true`）

デプロイ後:
- [ ] v95 デプロイ完了
- [ ] テスト実行（processCallSummaryDirect）
- [ ] ログ確認（統合API呼び出し成功）
- [ ] AppSheet確認（Call_Logs、Call_Actions、Client_Requests）
- [ ] コスト監視（GCP請求レポート）

---

**最終更新**: 2025年10月17日  
**作成者**: Fractal Group  
**バージョン**: v95
