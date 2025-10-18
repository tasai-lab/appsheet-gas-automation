# Appsheet_訪問看護_通常記録（統合版）

**Script ID:** 1YkRRcL3fBJ-gMiC3lCkScM3fe_IrawqXrmKoIIWmE-nQokw4rY6rATZa

**Created:** 2025-07-30T09:27:45.262Z

**Modified:** 2025-10-16T11:54:02.182Z

**Owners:**

## 概要

訪問看護記録の自動生成を行うGASプロジェクト。**通常記録と精神科記録の両方に対応**した統合版です。

### 対応記録タイプ

- **通常記録** (`recordType: "通常"`)
  - 一般的な訪問看護記録（バイタルサイン、主観情報、利用者状態など）

- **精神科記録** (`recordType: "精神"`)
  - 精神科訪問看護記録（精神状態観察、服薬遵守、社会機能など）

※ 旧「Appsheet_訪問看護_精神科記録」プロジェクトは本プロジェクトに統合され、_archivedに移動されました。

## Structure

- `scripts/`: Contains all GAS script files
- `spreadsheets/`: Contains metadata for referenced spreadsheets
- `appsscript.json`: Project manifest
- `project_metadata.json`: Complete project metadata

## Referenced Spreadsheets

- **GAS実行ログ** (ID: 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE)
- **訪問看護_記録管理** (ID: 1EhLGOPKrxqMNl2b1_c0mA1M3w1tXiHN4PsnXWfWHSPw)
