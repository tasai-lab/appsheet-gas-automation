# Vector DB Spreadsheet 作成手順書

> **所要時間**: 約5分
> **必要なもの**: Googleアカウント（GASアクセス権限あり）

---

## 🚀 クイックスタート

### Step 1: スクリプトをコピー

1. 以下のファイルを開く：
   ```
   common_modules/create_vector_db_spreadsheet.gs
   ```

2. ファイルの内容を全てコピー（Cmd+A → Cmd+C）

### Step 2: GASエディタで実行

1. **任意のGASプロジェクトを開く**
   - 例：`Automation_統合管理` プロジェクト
   - URL: https://script.google.com/home

2. **新しいスクリプトファイルを作成**
   - 左側メニューの「＋」ボタンをクリック
   - 「スクリプト」を選択
   - ファイル名: `create_vector_db_spreadsheet`

3. **コピーしたコードを貼り付け**
   - Step 1でコピーした内容を貼り付け（Cmd+V）
   - 保存（Cmd+S）

4. **関数を実行**
   - 関数ドロップダウンから `createVectorDBSpreadsheet` を選択
   - 「実行」ボタンをクリック ▶️

5. **初回実行時の認証**
   - 「承認が必要です」と表示されたら「権限を確認」をクリック
   - Googleアカウントを選択
   - 「詳細」→「(プロジェクト名) に移動」をクリック
   - 「許可」をクリック

6. **実行結果を確認**
   - ダイアログに Spreadsheet ID が表示される
   - IDをコピーしておく

### Step 3: Spreadsheet IDを設定

#### 3-1: vector_db_sync.gs に設定

ファイル: `common_modules/vector_db_sync.gs`

```javascript
const VECTOR_DB_CONFIG = {
  spreadsheetId: '【ここに取得したSpreadsheet IDを貼り付け】',
  // ...
};
```

#### 3-2: backend/.env に設定

ファイル: `rag_system/backend/.env`

```env
VECTOR_DB_SPREADSHEET_ID=【ここに取得したSpreadsheet IDを貼り付け】
```

---

## ✅ 作成されるSpreadsheet構造

### Sheet 1: KnowledgeBase (青)
- 13,500+件のナレッジベースデータを格納
- カラム: id, domain, source_type, title, content, etc.

### Sheet 2: Embeddings (緑)
- 各ナレッジベースの埋め込みベクトル（3072次元）
- カラム: kb_id, embedding, model, task_type, generated_at

### Sheet 3: MedicalTerms (黄)
- 医療用語シノニム辞書（初期5件、最終100語）
- カラム: term_id, canonical, synonyms, category, umls_cui, frequency

### Sheet 4: ChatHistory (赤)
- チャット履歴とユーザーフィードバック
- カラム: session_id, user_id, role, message, context_ids, etc.

---

## 🔍 作成後の確認

### 1. Spreadsheetを開く

表示されたURLをクリック、または：
```
https://docs.google.com/spreadsheets/d/【Spreadsheet ID】/edit
```

### 2. 構造を確認

- ✅ 4つのシートが存在する
- ✅ 各シートにヘッダー行が設定されている
- ✅ ヘッダー行がカラーリングされている
- ✅ MedicalTermsシートに5件の初期データがある

### 3. 権限を確認

- 保存先フォルダ: `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX`
- 編集権限: 自分のアカウント + GASサービスアカウント

---

## 🧪 動作テスト

### テスト関数を実行

1. GASエディタで `testVectorDBSpreadsheet` 関数を選択

2. 関数を実行（引数にSpreadsheet IDを設定）
   ```javascript
   function runTest() {
     testVectorDBSpreadsheet('【Spreadsheet ID】');
   }
   ```

3. ログを確認（Cmd+Enter または「実行ログを表示」）

**期待される出力:**
```
Vector DB Spreadsheet テスト開始

1. シート存在確認:
   ✅ KnowledgeBase - 存在
      ✅ ヘッダー: 正常
   ✅ Embeddings - 存在
      ✅ ヘッダー: 正常
   ✅ MedicalTerms - 存在
      ✅ ヘッダー: 正常
   ✅ ChatHistory - 存在
      ✅ ヘッダー: 正常

2. 医療用語辞書 初期データ確認:
   データ件数: 5件
   期待件数: 5件

✅ テスト完了
```

---

## 🔧 トラブルシューティング

### エラー: "権限が必要です"

**原因**: OAuth認証が未完了

**解決策**:
1. 「権限を確認」をクリック
2. 必要な権限を許可
3. 再度実行

---

### エラー: "フォルダが見つかりません"

**原因**: `TARGET_FOLDER_ID` が正しくない、またはアクセス権限がない

**解決策**:
1. フォルダID `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX` にアクセスできるか確認
2. フォルダの共有設定を確認
3. スクリプトの `TARGET_FOLDER_ID` を修正

---

### エラー: "スクリプトがタイムアウトしました"

**原因**: 処理時間が6分を超えた（通常は起こらない）

**解決策**:
1. 再度実行（通常30秒以内に完了）
2. それでも失敗する場合は、シートを1つずつ手動作成

---

## 📋 手動作成（代替方法）

スクリプト実行が何らかの理由で失敗する場合は、手動で作成できます：

### 1. 新規Spreadsheet作成

1. Google Driveで「新規」→「Google スプレッドシート」
2. 名前: `RAG_VectorDB_統合ナレッジベース`
3. フォルダ `16swPUizvdlyPxUjbDpVl9-VBDJZO91kX` に移動

### 2. シート作成

各シートを作成し、[RAG_VECTOR_DB_SETUP.md](../../docs/ja/RAG_VECTOR_DB_SETUP.md) の手順に従ってヘッダーを設定

### 3. フォーマット設定

- ヘッダー行に色を設定
- 列Aを固定
- フィルターを有効化

---

## 🎯 次のステップ

### 1. ✅ Spreadsheet作成完了

Spreadsheet IDを取得・設定完了

### 2. ⏳ 医療用語辞書拡張

MedicalTermsシートに100語まで拡張（Phase 1.3）

### 3. ⏳ GASプロジェクト統合

15プロジェクトにVector DB同期機能を統合（Phase 2）

### 4. ⏳ Backend開発

FastAPI + Vertex AI Ranking API実装（Phase 3）

---

**最終更新**: 2025-10-27
**バージョン**: 1.0.0
