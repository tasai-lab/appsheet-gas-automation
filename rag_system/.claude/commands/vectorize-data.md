# 既存データのベクトル化

AppSheet/GASプロジェクトの既存データをVertex AI Embeddingsでベクトル化し、Vector DB Spreadsheetに書き込む。

## 前提条件

- Python 3.11以上
- GCP認証設定済み
- Vector DB Spreadsheet作成済み
- データソース設定ファイル作成済み

## セットアップ

### 1. 依存ライブラリインストール

```bash
cd /Users/t.asai/code/appsheet-gas-automation/rag_system

pip install google-auth google-auth-oauthlib google-auth-httplib2
pip install google-api-python-client google-cloud-aiplatform tqdm python-dotenv
```

### 2. データソース設定

```bash
cd scripts

# テンプレートをコピー
cp data_sources.example.json data_sources.json

# 各AppSheetアプリのSpreadsheet IDを設定
# vi data_sources.json
```

### 3. GCP認証

```bash
# サービスアカウントキー
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"

# または gcloud認証
gcloud auth application-default login
```

## 使用方法

### データソース一覧表示

```bash
python scripts/vectorize_existing_data.py --list-sources
```

### Dry Run（テスト実行）

```bash
# 全データソースをテスト（Vector DBには書き込まない）
python scripts/vectorize_existing_data.py --all --dry-run

# 特定データソースのみテスト
python scripts/vectorize_existing_data.py --source nursing_regular --dry-run
```

### 本番実行

#### 1データソースずつ実行（推奨）

```bash
# 訪問看護_通常記録のみ
python scripts/vectorize_existing_data.py --source nursing_regular

# 利用者_基本情報のみ
python scripts/vectorize_existing_data.py --source clients_basic

# 複数指定（カンマ区切り）
python scripts/vectorize_existing_data.py --source nursing_regular,clients_basic,calls_summary
```

#### 全データソース一括実行

```bash
# 全15プロジェクトを処理
python scripts/vectorize_existing_data.py --all
```

### オプション

```bash
# バッチサイズ指定（デフォルト: 50）
python scripts/vectorize_existing_data.py --source nursing_regular --batch-size 100

# Dry Run（書き込みしない）
python scripts/vectorize_existing_data.py --source nursing_regular --dry-run
```

## 実行フロー

```
1. データソースSpreadsheetから読み込み
   ↓
2. フルテキスト構築（各レコードのカラムを結合）
   ↓
3. Vertex AI Embeddings API呼び出し（3072次元）
   ↓
4. Vector DB Spreadsheetに書き込み
   - KnowledgeBaseシート
   - Embeddingsシート
   ↓
5. 1秒待機（レート制限対応: 60 RPM）
   ↓
6. 次のレコードへ
```

## パフォーマンス目安

| データ量 | 処理時間 | API呼び出し数 |
|---------|---------|-------------|
| 100件 | ~2分 | 100回 |
| 1,000件 | ~17分 | 1,000回 |
| 10,000件 | ~3時間 | 10,000回 |
| 13,500件 | ~4時間 | 13,500回 |

**制約**:
- Vertex AI Embeddings API: 60 RPM
- 1レコード = 1 API呼び出し（リトライなし）

## コスト

| データ量 | コスト |
|---------|--------|
| 1,000件 | $0.00（無料枠内） |
| 10,000件 | $0.00（無料枠内） |
| 13,500件 | $0.00（無料枠内） |

**注**: Vertex AI Embeddings APIは月間5M tokensまで無料

## トラブルシューティング

### 認証エラー

```bash
# サービスアカウントキー設定
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"

# または gcloud認証
gcloud auth application-default login
```

### Spreadsheet ID未設定

```bash
# Vector DB Spreadsheet ID確認
grep VECTOR_DB_SPREADSHEET_ID backend/.env

# データソース設定確認
cat scripts/data_sources.json
```

### API レート制限

スクリプトが自動的に1秒間隔で実行するため、通常は発生しない。

### 中断と再開

```bash
# Ctrl+C で中断可能
# 統計が表示される

# 再開方法:
# 1. Vector DB Spreadsheetで最後に書き込まれたレコードを確認
# 2. 該当データソースを再実行
```

## データソース設定例

`scripts/data_sources.json`:

```json
{
  "nursing_regular": {
    "name": "訪問看護_通常記録",
    "spreadsheet_id": "1ABC...XYZ",
    "sheet_name": "Care_Records",
    "domain": "nursing",
    "source_type": "care_record"
  }
}
```

## 注意事項

- **API呼び出し**: 1レコード = 1 API呼び出し
- **重複**: 同じレコードを複数回実行すると重複
- **初回実行前**: 必ず `--dry-run` でテスト
- **大量データ**: バッチサイズを調整（`--batch-size 100`）

---

**最終更新**: 2025-10-27
