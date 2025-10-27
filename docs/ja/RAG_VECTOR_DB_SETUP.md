# Vector DBスプレッドシート セットアップガイド

## 概要

RAGシステムで使用する統合Vector DBスプレッドシートの作成手順です。

## スプレッドシート作成

### 1. 新規スプレッドシート作成

1. Google Driveで新規スプレッドシートを作成
2. 名前: `RAG_VectorDB_統合ナレッジベース`
3. 保存先: フォルダーID `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX`

### 2. シート構成

#### Sheet 1: KnowledgeBase

**ヘッダー行 (1行目):**
```
id | domain | source_type | source_table | source_id | user_id | title | content | structured_data | metadata | tags | bm25_keywords | date | created_at | updated_at
```

**列の説明:**

| 列名 | データ型 | 説明 | 例 |
|-----|---------|------|---|
| id | テキスト | KB_ドメイン_YYYYMMDD_連番 | KB_nursing_20251027_00001 |
| domain | テキスト | ドメイン区分 | nursing / clients / calls / sales |
| source_type | テキスト | ソースタイプ | care_record / call_summary / user_info |
| source_table | テキスト | AppSheetテーブル名 | Care_Records |
| source_id | テキスト | 元レコードID | rec_abc123 |
| user_id | テキスト | 利用者ID (フィルタ用) | user_001 |
| title | テキスト | 見出し (検索結果表示用) | 2025-10-27 訪問看護記録 |
| content | テキスト | 全文テキスト (埋込対象) | 訪問時の状態観察... |
| structured_data | JSON | 構造化データ | {"vital_signs": {...}} |
| metadata | JSON | メタデータ | {"audioFileId": "..."} |
| tags | テキスト | カンマ区切りタグ | バルーン交換,服薬確認 |
| bm25_keywords | テキスト | セミコロン区切りキーワード | バルーン;膀胱留置カテーテル;尿道カテーテル |
| date | 日付 | 記録日付 | 2025-10-27 |
| created_at | 日時 | 登録日時 | 2025-10-27 10:00:00 |
| updated_at | 日時 | 更新日時 | 2025-10-27 10:00:00 |

**データ検証:**
- id: 一意
- domain: リスト (nursing, clients, calls, sales)
- date: 日付形式

#### Sheet 2: Embeddings

**ヘッダー行 (1行目):**
```
kb_id | embedding | model | task_type | generated_at
```

**列の説明:**

| 列名 | データ型 | 説明 | 例 |
|-----|---------|------|---|
| kb_id | テキスト | KnowledgeBase.id参照 | KB_nursing_20251027_00001 |
| embedding | JSON | 埋め込みベクトル (3072次元) | [0.123, -0.456, ...] |
| model | テキスト | モデル名 | gemini-embedding-001 |
| task_type | テキスト | タスクタイプ | RETRIEVAL_DOCUMENT |
| generated_at | 日時 | 生成日時 | 2025-10-27 10:00:00 |

**データ検証:**
- kb_id: KnowledgeBaseシートのidと一致
- model: "gemini-embedding-001"

#### Sheet 3: MedicalTerms

**ヘッダー行 (1行目):**
```
term_id | canonical | synonyms | category | umls_cui | frequency | created_at
```

**列の説明:**

| 列名 | データ型 | 説明 | 例 |
|-----|---------|------|---|
| term_id | テキスト | 用語ID | TERM_00001 |
| canonical | テキスト | 正規表現 | 膀胱留置カテーテル |
| synonyms | JSON配列 | シノニムリスト | ["バルーン","尿道カテーテル","Foley"] |
| category | テキスト | 医療カテゴリ | 医療機器 |
| umls_cui | テキスト | UMLS概念ID (参照用) | C0085678 |
| frequency | 数値 | 使用頻度 (提案優先度) | 42 |
| created_at | 日時 | 登録日時 | 2025-10-27 |

**初期データ例:**

| term_id | canonical | synonyms | category | umls_cui | frequency | created_at |
|---------|-----------|----------|----------|----------|-----------|------------|
| TERM_00001 | 膀胱留置カテーテル | ["バルーン","尿道カテーテル","Foley"] | 医療機器 | C0085678 | 0 | 2025-10-27 |
| TERM_00002 | 血圧 | ["BP","ブラッドプレッシャー"] | バイタルサイン | C0005823 | 0 | 2025-10-27 |
| TERM_00003 | 服薬 | ["内服","薬剤服用"] | 看護行為 | C0013227 | 0 | 2025-10-27 |

#### Sheet 4: ChatHistory

**ヘッダー行 (1行目):**
```
session_id | user_id | role | message | context_ids | suggested_terms | term_feedback | timestamp
```

**列の説明:**

| 列名 | データ型 | 説明 | 例 |
|-----|---------|------|---|
| session_id | テキスト | セッションID | session_abc123 |
| user_id | テキスト | 利用者ID (選択時のみ) | user_001 |
| role | テキスト | ロール | user / assistant / system |
| message | テキスト | メッセージ本文 | バルーンの使用状況を教えて |
| context_ids | JSON配列 | 使用したKB IDリスト | ["KB_nursing_20251027_00001"] |
| suggested_terms | JSON | 提案した代替用語 | {"バルーン": ["膀胱留置カテーテル"]} |
| term_feedback | JSON | ユーザー確認結果 | {"confirmed": true, "selected": "膀胱留置カテーテル"} |
| timestamp | 日時 | 日時 | 2025-10-27 10:00:00 |

### 3. シートの書式設定

#### KnowledgeBase シート:
- 行1: 太字、背景色 #4285F4 (青)、文字色 白
- 列A (id): 固定 (Freeze)
- フィルター: 有効化

#### Embeddings シート:
- 行1: 太字、背景色 #34A853 (緑)、文字色 白
- 列A (kb_id): 固定 (Freeze)

#### MedicalTerms シート:
- 行1: 太字、背景色 #FBBC04 (黄)、文字色 黒
- 列A (term_id): 固定 (Freeze)
- フィルター: 有効化

#### ChatHistory シート:
- 行1: 太字、背景色 #EA4335 (赤)、文字色 白
- 列A (session_id): 固定 (Freeze)
- フィルター: 有効化

### 4. 権限設定

- GASサービスアカウントに編集権限を付与
- プロジェクトメンバーに閲覧権限を付与

## セットアップ後の設定

### 1. vector_db_sync.gs の更新

作成したスプレッドシートのIDを取得し、`common_modules/vector_db_sync.gs` の `VECTOR_DB_CONFIG` を更新:

```javascript
const VECTOR_DB_CONFIG = {
  spreadsheetId: '【ここにスプレッドシートIDを貼り付け】',
  // ...
};
```

### 2. OAuth Scope の追加

各GASプロジェクトの `appsscript.json` に以下のスコープが含まれていることを確認:

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/cloud-platform"
  ]
}
```

### 3. テスト実行

`common_modules/test_rag_modules.gs` の `testAllRAGModules()` を実行してセットアップを検証:

```javascript
function testAllRAGModules() {
  // 全てのテストを実行
}
```

期待される出力:
```
✓ 埋め込み生成: 成功
✓ コサイン類似度: 成功
✓ 類似検索: 成功
✓ Vector DB同期: 成功
```

## メンテナンス

### 定期クリーンアップ

古いChatHistoryデータを削除 (90日以上前):

```javascript
function cleanupChatHistory() {
  const ss = SpreadsheetApp.openById(VECTOR_DB_CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName('ChatHistory');
  const data = sheet.getDataRange().getValues();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  let deleteCount = 0;
  for (let i = data.length - 1; i > 0; i--) {
    const timestamp = new Date(data[i][7]); // timestamp列
    if (timestamp < cutoffDate) {
      sheet.deleteRow(i + 1);
      deleteCount++;
    }
  }

  Logger.log(`削除した履歴: ${deleteCount}件`);
}
```

### バックアップ

週次でスプレッドシートのコピーを作成することを推奨:

1. Google Driveで「コピーを作成」
2. 名前: `RAG_VectorDB_統合ナレッジベース_Backup_YYYYMMDD`
3. バックアップフォルダーに保存

## トラブルシューティング

### エラー: "シートが見つかりません"

**原因:** シート名が正しくない、またはシートが削除されている

**解決:**
1. スプレッドシートを開いてシート名を確認
2. `VECTOR_DB_CONFIG.sheets` の名前と一致しているか確認

### エラー: "権限がありません"

**原因:** GASサービスアカウントに編集権限がない

**解決:**
1. スプレッドシートの共有設定を確認
2. GASプロジェクトのOAuth承認を再実行

### パフォーマンスの低下

**原因:** KnowledgeBaseシートのデータが10,000行を超えている

**解決:**
1. 古いデータをアーカイブシートに移動
2. インデックス用の補助シートを作成 (将来実装)
3. Google Spreadsheet以外のVector DB (Pinecone, Weaviate等) への移行を検討

## 次のステップ

1. ✅ Vector DBスプレッドシート作成
2. ✅ vector_db_sync.gs の設定更新
3. ✅ テスト実行
4. 医療用語辞書の初期データ登録 (100語)
5. 既存データの初期移行 (13,500行)
6. Backend (FastAPI) の構築
7. Frontend (Next.js) の構築

---

**最終更新:** 2025-10-27
**バージョン:** 1.0.0
