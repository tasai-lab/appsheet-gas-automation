# GASトリガー管理ツール

全GASプロジェクトのトリガーを管理するためのツール群

## ツール一覧

### 1. トリガー一覧表示
**ファイル**: `list_all_triggers.py`

全プロジェクトのトリガーを一覧表示します（削除はしません）。

```bash
python3 list_all_triggers.py
```

**表示内容**:
- プロジェクト名
- プロジェクトURL
- Script ID
- 各トリガーの詳細:
  - 関数名
  - Trigger ID
  - トリガーソース（スプレッドシート/時間ベース/フォーム等）
  - イベントタイプ（開く時/編集時/変更時等）
  - スプレッドシートIDやフォームID（該当する場合）

### 2. トリガー削除（自動）
**ファイル**: `delete_all_triggers_auto.py`

全プロジェクトのトリガーを自動的に削除します。

```bash
chmod +x delete_all_triggers_auto.py
python3 delete_all_triggers_auto.py
```

**機能**:
- 各プロジェクトに一時的にトリガー削除スクリプトを追加
- `clasp run`コマンドで実行
- 削除前にトリガーの詳細を表示
- 削除結果を表示（成功/失敗）

### 3. トリガー削除（手動）
**ファイル**: `delete_all_triggers.py`

各プロジェクトのトリガー管理ページのURLを表示します。

```bash
python3 delete_all_triggers.py
```

### 4. GASスクリプト（単一プロジェクト用）
**ファイル**: `delete_all_triggers_gas.js`

単一のGASプロジェクトでトリガーを管理するためのスクリプト。

**使い方**:
1. GASエディタを開く
2. このスクリプトの内容をコピー＆ペースト
3. 以下の関数を実行:

```javascript
// トリガーを一覧表示
listAllTriggers()

// 全トリガーを削除
deleteAllTriggersForCurrentProject()
```

**関数の詳細**:

#### `listAllTriggers()`
現在のプロジェクトの全トリガーを一覧表示
- プロジェクトURL
- トリガー数
- 各トリガーの詳細情報

#### `deleteAllTriggersForCurrentProject()`
現在のプロジェクトの全トリガーを削除
- 削除前にトリガーの詳細を表示
- 削除結果を表示
- 削除数と失敗数を集計

## 前提条件

### Apps Script APIの有効化
自動実行スクリプトを使用する場合、Apps Script APIを有効にする必要があります。

1. 以下のURLにアクセス:
   https://script.google.com/home/usersettings

2. 「Google Apps Script API」をONにする

### claspのインストールと認証
```bash
npm install -g @google/clasp
clasp login
```

## 表示される情報

### プロジェクト情報
- **プロジェクト名**: GASプロジェクトの名前
- **ディレクトリ**: ローカルのプロジェクトパス
- **Script ID**: GASプロジェクトの一意識別子
- **URL**: GASエディタのURL

### トリガー情報
各トリガーについて以下の情報を表示:

1. **関数名**: トリガーが実行する関数
   - 例: `doPost`, `myFunction`, `onEdit`

2. **Trigger ID**: トリガーの一意識別子
   - 例: `12345678`

3. **Source（トリガーソース）**:
   - `スプレッドシート`: スプレッドシートベース
   - `時間ベース`: 時間駆動型
   - `フォーム`: Googleフォーム
   - `ドキュメント`: Googleドキュメント
   - `カレンダー`: Googleカレンダー

4. **Event（イベントタイプ）**:
   - `開く時`: ファイルを開いた時
   - `編集時`: 編集が行われた時
   - `変更時`: 変更が発生した時
   - `フォーム送信時`: フォームが送信された時
   - `時間駆動`: 指定した時間に実行

5. **追加情報**:
   - スプレッドシート ID（スプレッドシートベースの場合）
   - フォーム ID（フォームベースの場合）

## 出力例

```
================================================================================
プロジェクト: Appsheet_通話_要約生成
ディレクトリ: gas_projects/projects/calls/Appsheet_通話_要約生成
Script ID: 1PK1RNjLaA7g-1-JrJ-AFn1S0D_nL5cGHNJeDtyhIap_otDnYsUAquSz6
URL: https://script.google.com/home/projects/1PK1RNjLaA7g-1-JrJ-AFn1S0D_nL5cGHNJeDtyhIap_otDnYsUAquSz6
================================================================================

トリガー数: 2

1. 関数: doPost
   Trigger ID: 87654321
   Source: スプレッドシート
   Event: 編集時
   スプレッドシート ID: 1ABC...XYZ

2. 関数: myTimeTrigger
   Trigger ID: 12345678
   Source: 時間ベース
   Event: 時間駆動

   ✓ 削除成功

================================================================================
完了: 2個削除, 0個失敗
================================================================================
```

## トラブルシューティング

### claspコマンドが見つからない
```bash
npm install -g @google/clasp
```

### 認証エラー
```bash
clasp login
```

### Apps Script APIが無効
https://script.google.com/home/usersettings でAPIを有効化

### clasp runが失敗する
手動でトリガーを削除してください:
```
https://script.google.com/home/projects/YOUR_PROJECT_ID/triggers
```

## 注意事項

- トリガーを削除すると、自動実行されていた処理が停止します
- 削除前に必ずトリガーの一覧を確認してください
- 重要なトリガーは削除前にバックアップを取ることを推奨します
- 一度削除したトリガーは復元できません

## ライセンス

MIT License
