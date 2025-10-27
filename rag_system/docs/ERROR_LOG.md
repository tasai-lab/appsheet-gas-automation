# エラーログ & トラブルシューティング

## 概要

このドキュメントは、RAGシステム開発中および運用中に発生した全てのエラー、その解決経緯、結論を記録します。

**記録方針:**
- エラー発生日時を明記
- 完全なエラーメッセージを記録
- 解決に至った手順を詳細に記述
- 再発防止策を必ず記載
- 関連するコミットハッシュやPR番号を記載

---

## エラーログフォーマット

```markdown
### [YYYY-MM-DD HH:MM] エラータイトル

**エラーコード**: ERROR_CODE

**発生箇所**: ファイル名:行数

**エラーメッセージ**:
```
完全なエラーメッセージをここに記載
```

**発生状況**:
- 何をしていた時に発生したか
- 再現手順

**原因**:
根本原因の分析

**解決手順**:
1. 試した対策1
2. 試した対策2
3. 最終的な解決策

**結論**:
- 修正内容
- コミットハッシュ: `abc1234`
- 再発防止策

**関連リンク**:
- Issue #123
- PR #456
```

---

## 2025-10-27: 初期セットアップ期間

### [2025-10-27 14:30] Vertex AI gemini-embedding-001次元数エラー

**エラーコード**: DIMENSION_MISMATCH

**発生箇所**: `common_modules/embeddings_service.gs:37`

**エラーメッセージ**:
```
次元数が期待値と異なります: 期待=768, 実際=3072
```

**発生状況**:
- `testEmbeddingsService()` 実行時に発生
- 計画書では768次元と記載していたが、実際のモデルは3072次元だった

**原因**:
- Vertex AI gemini-embedding-001のデフォルト次元数は3072次元
- Matryoshka Representation Learningにより768, 1536, 3072が選択可能
- 初期設計時に768次元と記載したが、実際には`outputDimensionality`パラメータで指定する必要があった

**解決手順**:
1. Google Cloud公式ドキュメント確認
   - https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings
2. WebSearchで最新仕様確認
3. `EMBEDDINGS_CONFIG.outputDimensionality`を3072に変更
4. `parameters.outputDimensionality`をAPIリクエストに追加

**結論**:
- **修正内容**: `common_modules/embeddings_service.gs`のモデル名を`text-embedding-005`→`gemini-embedding-001`に変更、`outputDimensionality: 3072`に設定
- **コミットハッシュ**: (次回コミット時に記載)
- **再発防止策**:
  - 公式ドキュメントを必ず最初に確認
  - WebSearchで最新情報を取得してから実装
  - テスト関数で次元数を検証

**関連リンク**:
- [Vertex AI Embeddings API Documentation](https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings)

---

## 運用フェーズのエラー (本番稼働後に記録)

_(この下に運用開始後のエラーを追記)_

---

## よくあるエラーと対処法 (FAQ)

### Q1: "Vertex AI API Error: 403 - Permission denied"

**原因**: サービスアカウントにVertex AI APIの権限がない

**解決策**:
```bash
gcloud projects add-iam-policy-binding $GCP_PROJECT_ID \
  --member="serviceAccount:rag-backend@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

### Q2: "Spreadsheet not found"

**原因**: VECTOR_DB_SPREADSHEET_IDが正しく設定されていない、または権限がない

**解決策**:
1. `vector_db_sync.gs`のスプレッドシートID確認
2. サービスアカウントに編集権限付与
3. OAuth2承認を再実行

### Q3: "Rate Limit Exceeded"

**原因**: API呼び出し回数が制限を超過

**解決策**:
1. ログで呼び出し回数確認
2. リトライループがないか確認（**絶対に実装しない**）
3. バッチ処理に変更
4. クォータ増加リクエスト

### Q4: "EventSource connection failed"

**原因**: SSEストリーミング接続が失敗

**解決策**:
1. CORSヘッダー確認
2. Content-Type: text/event-stream設定確認
3. ネットワークタイムアウト延長
4. ブラウザ開発ツールでNetwork確認

---

## エラー統計 (月次更新)

| 月 | エラー総数 | Critical | High | Medium | Low |
|----|-----------|----------|------|--------|-----|
| 2025-10 | 1 | 0 | 0 | 1 | 0 |
| 2025-11 | - | - | - | - | - |

---

## インシデントレポートテンプレート

重大なインシデント発生時は以下のテンプレートを使用:

```markdown
# インシデントレポート: [タイトル]

**発生日時**: YYYY-MM-DD HH:MM - HH:MM
**影響範囲**: ユーザー数、機能
**重要度**: Critical / High / Medium / Low

## タイムライン

| 時刻 | イベント |
|------|---------|
| HH:MM | 初期検知 |
| HH:MM | 調査開始 |
| HH:MM | 原因特定 |
| HH:MM | 修正完了 |
| HH:MM | サービス復旧 |

## 根本原因分析 (RCA)

### 直接原因


### 根本原因


### 寄与要因


## 対応内容

### 即時対応


### 恒久対策


## 学んだ教訓


## 再発防止策


**担当者**:
**承認者**:
```

---

**最終更新**: 2025-10-27
**次回レビュー**: 毎週月曜日
