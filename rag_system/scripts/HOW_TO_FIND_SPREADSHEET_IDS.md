# AppSheet Spreadsheet IDの見つけ方

## 背景

GASプロジェクトはAppSheet APIを使用しており、コード内に直接Spreadsheet IDは記載されていません。
AppSheetアプリの背後にあるGoogle Spreadsheetを特定する必要があります。

## 方法1: AppSheetアプリから確認（推奨）

### 手順

1. **AppSheetエディタを開く**
   - https://www.appsheet.com/start にアクセス
   - 対象のアプリを選択

2. **データソースを確認**
   - 左側メニューから「Data」をクリック
   - 各テーブルをクリック
   - 「Source」セクションで「View Source」をクリック
   - Google Spreadsheetが開く → URLからSpreadsheet IDを取得

3. **Spreadsheet IDの形式**
   ```
   https://docs.google.com/spreadsheets/d/【ここがSpreadsheet ID】/edit

   例: https://docs.google.com/spreadsheets/d/1ABC123xyz_XYZ-abc123/edit
   → Spreadsheet ID: 1ABC123xyz_XYZ-abc123
   ```

## 方法2: Google Driveで検索

### 手順

1. **Google Driveを開く**
   - https://drive.google.com/

2. **アプリ名で検索**
   - 検索ボックスに以下のキーワードを入力:
     - `訪問看護`
     - `利用者`
     - `通話`
     - `営業`
     - `レシート`

3. **スプレッドシートを開く**
   - 該当するスプレッドシートを開く
   - URLからSpreadsheet IDを取得

4. **シート名を確認**
   - 開いたスプレッドシート内のシート名タブを確認
   - `data_sources.json` の `sheet_name` と一致するか確認

## 既知の情報

### GASプロジェクトから判明したAppSheet設定

#### 訪問看護_通常記録
- **App ID**: `f40c4b11-b140-4e31-a60c-600f3c9637c8`
- **Table Name**: `Care_Records`
- **Master Spreadsheet**: `1EhLGOPKrxqMNl2b1_c0mA1M3w1tXiHN4PsnXWfWHSPw` ← データソースの可能性あり

#### 通話_要約生成
- **App ID**: `4762f34f-3dbc-4fca-9f84-5b6e809c3f5f`
- **Table Name**: `Call_Logs`
- **Actions Table**: `Call_Actions`

## 必要なSpreadsheet ID一覧

以下の15個のSpreadsheet IDが必要です:

1. ✅ **nursing_regular** (訪問看護_通常記録) - 候補: `1EhLGOPKrxqMNl2b1_c0mA1M3w1tXiHN4PsnXWfWHSPw`
2. ❌ **nursing_mental** (訪問看護_精神科記録)
3. ❌ **nursing_plan** (訪問看護_計画書問題点)
4. ❌ **nursing_plan_eval** (訪問看護_計画書問題点_評価)
5. ❌ **nursing_report** (訪問看護_報告書)
6. ❌ **clients_basic** (利用者_基本情報)
7. ❌ **clients_qa** (利用者_質疑応答)
8. ❌ **clients_facesheet** (利用者_フェースシート)
9. ❌ **clients_family** (利用者_家族情報)
10. ❌ **calls_summary** (通話_要約生成)
11. ❌ **calls_qa** (通話_質疑応答)
12. ❌ **calls_threads** (ALL_スレッド更新)
13. ❌ **sales_report** (営業レポート)
14. ❌ **sales_card** (名刺取り込み)
15. ❌ **automation_receipt** (レシート)

## data_sources.jsonへの設定方法

1. **ファイルを開く**
   ```bash
   cd /Users/t.asai/code/appsheet-gas-automation/rag_system/scripts
   open data_sources.json
   ```

2. **Spreadsheet IDを入力**
   ```json
   {
     "nursing_regular": {
       "name": "訪問看護_通常記録",
       "spreadsheet_id": "1EhLGOPKrxqMNl2b1_c0mA1M3w1tXiHN4PsnXWfWHSPw",  // ← ここに入力
       "sheet_name": "Care_Records",
       "domain": "nursing",
       "source_type": "care_record",
       "description": "通常の訪問看護記録"
     }
   }
   ```

3. **保存して確認**
   ```bash
   python scripts/vectorize_existing_data.py --list-sources
   ```

## トラブルシューティング

### シート名が見つからない

**症状**: ベクトル化実行時に「シートが見つかりません」エラー

**原因**: `sheet_name` が実際のシート名と一致していない

**解決策**:
1. Spreadsheetを開いて実際のシート名を確認
2. `data_sources.json` の `sheet_name` を修正

### Spreadsheet IDが正しくない

**症状**: ベクトル化実行時に「Spreadsheetが見つかりません」エラー

**原因**: Spreadsheet IDが間違っている、またはアクセス権限がない

**解決策**:
1. Spreadsheet URLを再確認
2. Spreadsheetの共有設定でサービスアカウントにアクセス権限を付与
3. または自分のGoogleアカウントで `gcloud auth application-default login` を実行

---

**最終更新**: 2025-10-27
