# Phase 2 セットアップガイド

> **所要時間**: 約20分
> **前提条件**: Phase 1完了、Google認証済み

---

## 📋 Phase 2概要

Phase 2では、看護系5プロジェクトにVector DB同期機能を統合し、RAGシステムへのデータ蓄積を開始します。

### 完了済み作業

- ✅ **Phase 2.1**: 共通モジュール配布（15ファイル）
- ✅ **Phase 2.2**: Vector DB同期コード統合（5プロジェクト）

### 実行必要な作業

- ⏳ **Phase 2.0**: Vector DB Spreadsheet作成・ID取得
- ⏳ **Phase 2.3**: デプロイと動作検証

---

## 🚀 Phase 2.0: Vector DB Spreadsheet作成

### Step 1: Google認証（初回のみ）

```bash
cd /Users/t.asai/code/appsheet-gas-automation

# Google Drive API認証
python retrieve_gas.py
```

**初回実行時の動作:**
1. ブラウザが自動で開きます
2. Googleアカウントを選択
3. 権限を許可
4. `token.pickle`ファイルが生成されます

### Step 2: Vector DB Spreadsheet作成

```bash
# Spreadsheet作成（約30秒）
python rag_system/scripts/create_vector_db_spreadsheet.py
```

**実行結果:**
```
============================================================
✅ Vector DB Spreadsheet 作成完了！
============================================================

スプレッドシートID: 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z
URL: https://docs.google.com/spreadsheets/d/1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z/edit
```

**重要**: Spreadsheet IDをコピーしてください（次のステップで使用）

### Step 3: Spreadsheet ID自動設定

```bash
# Spreadsheet IDを全ファイルに設定
python rag_system/scripts/set_spreadsheet_id.py <SPREADSHEET_ID>

# 例:
# python rag_system/scripts/set_spreadsheet_id.py 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z
```

**設定対象ファイル:**
1. `common_modules/vector_db_sync.gs`
2. `rag_system/backend/.env`
3. 看護系5プロジェクトの`vector_db_sync.gs`（各プロジェクト）

### Step 4: 変更をコミット

```bash
# 変更を確認
git diff

# コミット
git add -A
git commit -m "feat(Phase 2.0): Vector DB Spreadsheet作成・ID設定完了"
git push
```

---

## 🚢 Phase 2.3: デプロイと動作検証

### デプロイ対象プロジェクト（5つ）

1. **Appsheet_訪問看護_書類仕分け**
   - Vector DB連携: 書類OCR結果

2. **Appsheet_訪問看護_計画書問題点**
   - Vector DB連携: 計画書問題点

3. **Appsheet_訪問看護_計画書問題点_評価**
   - Vector DB連携: 評価結果

4. **Appsheet_訪問看護_報告書**
   - Vector DB連携: 訪問報告書

5. **Appsheet_訪問看護_定期スケジュール**
   - Vector DB連携: 定期訪問スケジュール

### デプロイ方法

#### 方法1: 個別デプロイ（推奨）

各プロジェクトを個別にデプロイ:

```bash
# プロジェクト1: 書類仕分け
cd gas_projects/projects/nursing/Appsheet_訪問看護_書類仕分け
clasp push
cd ../../../..

# プロジェクト2: 計画書問題点
cd gas_projects/projects/nursing/Appsheet_訪問看護_計画書問題点
clasp push
cd ../../../..

# プロジェクト3: 計画書問題点_評価
cd gas_projects/projects/nursing/Appsheet_訪問看護_計画書問題点_評価
clasp push
cd ../../../..

# プロジェクト4: 報告書
cd gas_projects/projects/nursing/Appsheet_訪問看護_報告書
clasp push
cd ../../../..

# プロジェクト5: 定期スケジュール
cd gas_projects/projects/nursing/Appsheet_訪問看護_定期スケジュール
clasp push
cd ../../../..
```

#### 方法2: 一括デプロイスクリプト

```bash
# 一括デプロイ（バッチスクリプト使用）
bash rag_system/scripts/deploy_nursing_projects.sh
```

### デプロイ確認

各プロジェクトのGASエディタで確認:

1. **ファイル確認**
   - ✅ `vector_db_sync.gs` が存在
   - ✅ `embeddings_service.gs` が存在
   - ✅ `logger.gs` が最新版

2. **設定確認**
   - ✅ `vector_db_sync.gs` の `spreadsheetId` が設定済み

3. **Webhook動作確認**
   - AppSheetからテストWebhookを送信
   - GASログで「Vector DB同期開始」→「✅ Vector DB同期完了」を確認

---

## 📊 動作検証

### 検証1: Vector DB Spreadsheet確認

1. Spreadsheetを開く:
   ```
   https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
   ```

2. **KnowledgeBaseシート**を確認:
   - 新規レコードが追加されているか
   - `domain: nursing`
   - `source_type` が正しいか（例: `document_sorting`）

3. **Embeddingsシート**を確認:
   - KnowledgeBaseに対応する埋め込みベクトルが生成されているか
   - `model: text-embedding-004`

### 検証2: 実行ログ確認

実行ログSpreadsheetを確認:
```
フォルダID: 16swPUizvdlyPxUjbDpVl9-VBDJZO91kX
```

**確認項目:**
- ✅ 「Vector DB同期開始」ログ
- ✅ 「✅ Vector DB同期完了」ログ
- ❌ エラーログがないこと

### 検証3: GASログ確認

各プロジェクトのGASエディタで「実行ログを表示」:

**期待されるログ:**
```
[2025-10-27 17:00:00] Vector DB同期開始
[2025-10-27 17:00:01] ✅ Vector DB同期完了
```

---

## 🔧 トラブルシューティング

### エラー: "spreadsheetId is empty"

**原因**: Spreadsheet IDが設定されていない

**解決策**:
```bash
python rag_system/scripts/set_spreadsheet_id.py <SPREADSHEET_ID>
```

---

### エラー: "Permission denied"

**原因**: Spreadsheetへのアクセス権限がない

**解決策**:
1. Spreadsheetを開く
2. 「共有」ボタンをクリック
3. GASサービスアカウントを追加
4. 編集権限を付与

---

### エラー: "syncToVectorDB is not defined"

**原因**: `vector_db_sync.gs`がデプロイされていない

**解決策**:
```bash
cd gas_projects/projects/nursing/<PROJECT_NAME>
clasp push
```

---

### Vector DBにデータが追加されない

**原因1**: Webhookが実行されていない

**解決策**: AppSheetからWebhookを再送信

**原因2**: Vector DB同期でエラーが発生している

**解決策**:
1. GASログを確認
2. エラーメッセージを確認
3. Spreadsheet IDが正しいか確認

---

## ✅ Phase 2完了チェックリスト

- [ ] **Phase 2.0**: Vector DB Spreadsheet作成完了
  - [ ] Spreadsheet作成完了
  - [ ] Spreadsheet ID取得
  - [ ] Spreadsheet ID全ファイルに設定
  - [ ] 変更コミット&プッシュ

- [x] **Phase 2.1**: 共通モジュール配布完了
  - [x] 3モジュール × 5プロジェクト = 15ファイル配布

- [x] **Phase 2.2**: Vector DB同期コード統合完了
  - [x] 全5プロジェクトに統合コード追加

- [ ] **Phase 2.3**: デプロイと動作検証完了
  - [ ] 全5プロジェクトをclasp push
  - [ ] Vector DBにデータ追加を確認
  - [ ] 実行ログ正常確認

---

## 🎯 次のステップ: Phase 3

Phase 2完了後、Phase 3（Backend開発）に進みます:

- **Phase 3.1**: FastAPIプロジェクト構造作成
- **Phase 3.2**: Vertex AI Ranking API統合
- **Phase 3.3**: Hybrid Search エンジン実装
- **Phase 3.4**: REST/SSE エンドポイント実装
- **Phase 3.5**: Cloud Run デプロイ

---

**最終更新**: 2025-10-27
**バージョン**: 1.0.0
