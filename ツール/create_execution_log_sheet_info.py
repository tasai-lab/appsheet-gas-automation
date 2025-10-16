"""
実行履歴スプレッドシートの作成（書き込み権限付き）

既存のtoken.pickleには書き込み権限がないため、
このスクリプトは手動でGASコンソールから実行する必要があります。

代わりに、GASスクリプト内でExecutionLoggerモジュールが
初回実行時に自動的にスプレッドシートを作成します。
"""

# ExecutionLoggerのgetOrCreateLogSpreadsheet()関数を
# いずれかのGASスクリプトから実行することで、
# フォルダー 16swPUizvdlyPxUjbDpVl9-VBDJZO91kX に
# 「GAS実行履歴ログ」スプレッドシートが自動作成されます。

# スプレッドシート作成後のURL:
# https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit

print("""
実行履歴スプレッドシートは、いずれかのGASスクリプトが
最初に実行された時に自動的に作成されます。

スプレッドシートの場所:
  Google Drive フォルダーID: 16swPUizvdlyPxUjbDpVl9-VBDJZO91kX
  スプレッドシート名: GAS実行履歴ログ

スプレッドシートの構造:
  - タイムスタンプ
  - スクリプト名
  - ステータス (SUCCESS/ERROR/WARNING)
  - メッセージ
  - 詳細 (JSON形式)
  - リクエストID
  - 処理時間(秒)

使用方法:
  1. いずれかのWebhookを受信する（または手動でGASを実行）
  2. ExecutionLogger が自動的にスプレッドシートを作成
  3. 以降、全ての実行履歴がそのスプレッドシートに記録される

注意:
  - スプレッドシートIDは各GASのスクリプトプロパティに保存されます
  - 10000行を超えると古いログから自動削除されます
  - 重複リクエストはCacheServiceで5分間記録されます
""")
