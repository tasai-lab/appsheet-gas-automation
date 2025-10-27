#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GAS実行ログのコスト管理シートにデータを統合するスクリプト
"""
import pickle
from googleapiclient.discovery import build
from datetime import datetime

SPREADSHEET_ID = '16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA'

# 統合ヘッダー（全プロジェクトを網羅）
UNIFIED_HEADERS = [
    'タイムスタンプ',           # 1
    'スクリプト名',             # 2
    'ステータス',               # 3
    'レコードID',              # 4
    'リクエストID',            # 5
    '処理時間(秒)',            # 6
    'モデル名',                # 7
    'Input Tokens',           # 8
    'Output Tokens',          # 9
    'Input料金(円)',          # 10
    'Output料金(円)',         # 11
    '合計料金(円)',           # 12
    # プロジェクト固有の情報
    '通話ID',                 # 13 - 通話系
    'ファイルパス',           # 14 - 通話系、書類OCR
    'ファイルID',             # 15 - 通話系、書類OCR
    'ファイルサイズ',         # 16 - 通話系、書類OCR
    '要約(抜粋)',             # 17 - 通話要約
    '文字起こし長',           # 18 - 通話要約
    'アクション数',           # 19 - 通話要約
    '利用者ID',               # 20 - 利用者質疑応答
    '利用者名',               # 21 - 利用者質疑応答
    '依頼理由',               # 22 - 利用者質疑応答
    '全文回答ID',             # 23 - 利用者質疑応答
    '記録ID',                 # 24 - 訪問看護記録
    'スタッフID',             # 25 - 訪問看護記録
    '記録タイプ',             # 26 - 訪問看護記録
    '入力テキスト長',         # 27 - 訪問看護記録
    'ドキュメントキー',       # 28 - 書類OCR
    '処理種別',               # 29 - 書類OCR
    'ファイル名',             # 30 - 書類OCR
    '処理結果(ページ数)',     # 31 - 書類OCR
    '開始時刻',               # 32 - 共通ログ用
    '終了時刻',               # 33 - 共通ログ用
    'ログサマリー',           # 34
    'エラー詳細',             # 35
    '実行ユーザー',           # 36
    '備考'                    # 37
]

def main():
    print("=" * 80)
    print("GAS実行ログ - コスト管理シート統合処理")
    print("=" * 80)

    # 認証情報を読み込み
    with open('token.pickle', 'rb') as token:
        creds = pickle.load(token)

    service = build('sheets', 'v4', credentials=creds)

    # 1. コスト管理シートにヘッダーを設定
    print("\n[1] コスト管理シートにヘッダーを設定中...")

    # まずシートをクリア
    service.spreadsheets().values().clear(
        spreadsheetId=SPREADSHEET_ID,
        range='コスト管理!A:ZZ'
    ).execute()

    # ヘッダーを追加
    service.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range='コスト管理!A1',
        valueInputOption='RAW',
        body={'values': [UNIFIED_HEADERS]}
    ).execute()

    # ヘッダー行のフォーマット
    service.spreadsheets().batchUpdate(
        spreadsheetId=SPREADSHEET_ID,
        body={
            'requests': [
                {
                    'repeatCell': {
                        'range': {
                            'sheetId': 295644856,  # コスト管理シートID
                            'startRowIndex': 0,
                            'endRowIndex': 1
                        },
                        'cell': {
                            'userEnteredFormat': {
                                'backgroundColor': {'red': 0.26, 'green': 0.52, 'blue': 0.96},
                                'textFormat': {
                                    'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0},
                                    'fontSize': 10,
                                    'bold': True
                                }
                            }
                        },
                        'fields': 'userEnteredFormat(backgroundColor,textFormat)'
                    }
                },
                {
                    'updateSheetProperties': {
                        'properties': {
                            'sheetId': 295644856,
                            'gridProperties': {
                                'frozenRowCount': 1
                            }
                        },
                        'fields': 'gridProperties.frozenRowCount'
                    }
                }
            ]
        }
    ).execute()

    print(f"  [OK] ヘッダー設定完了 ({len(UNIFIED_HEADERS)}列)")

    # 2. 各プロジェクトシートからデータを収集
    print("\n[2] 各プロジェクトシートからデータを収集中...")

    all_data = []

    # 各プロジェクトシートの定義
    sheets_config = [
        {
            'name': '実行履歴',
            'script_name_col': 3,  # D列（0始まりで3）
            'timestamp_col': 0,    # A列
            'has_end_time': True
        },
        {
            'name': '実行履歴_通話要約',
            'script_name_col': 1,  # B列
            'timestamp_col': 0,    # A列
            'has_end_time': False
        },
        {
            'name': '実行履歴_通話質疑応答',
            'script_name_col': 1,  # B列
            'timestamp_col': 0,    # A列
            'has_end_time': False
        },
        {
            'name': '実行履歴_利用者質疑応答',
            'script_name_col': 1,  # B列
            'timestamp_col': 0,    # A列
            'has_end_time': False
        },
        {
            'name': '実行履歴_訪問看護_通常記録',
            'script_name_col': 1,  # B列
            'timestamp_col': 0,    # A列
            'has_end_time': False
        },
        {
            'name': '実行履歴_訪問看護_書類OCR',
            'script_name_col': 1,  # B列
            'timestamp_col': 0,    # A列
            'has_end_time': False
        }
    ]

    for sheet_config in sheets_config:
        sheet_name = sheet_config['name']
        print(f"\n  処理中: {sheet_name}")

        try:
            # シート全体のデータを取得
            result = service.spreadsheets().values().get(
                spreadsheetId=SPREADSHEET_ID,
                range=f"'{sheet_name}'!A:ZZ"
            ).execute()

            rows = result.get('values', [])
            if len(rows) <= 1:  # ヘッダーのみまたは空
                print(f"    データなし")
                continue

            headers = rows[0]
            data_rows = rows[1:]

            print(f"    データ行数: {len(data_rows)}")

            # ヘッダーマッピングを作成
            header_map = {h: i for i, h in enumerate(headers)}

            # データを統合フォーマットに変換
            for row in data_rows:
                # 行の長さをヘッダーに合わせる
                row = row + [''] * (len(headers) - len(row))

                unified_row = [''] * len(UNIFIED_HEADERS)

                # 共通項目のマッピング
                try:
                    # タイムスタンプ
                    if 'タイムスタンプ' in header_map:
                        unified_row[0] = row[header_map['タイムスタンプ']]
                    elif '開始時刻' in header_map:
                        unified_row[0] = row[header_map['開始時刻']]
                        unified_row[31] = row[header_map['開始時刻']]  # 開始時刻も保存
                        if '終了時刻' in header_map:
                            unified_row[32] = row[header_map['終了時刻']]

                    # スクリプト名
                    if 'スクリプト名' in header_map:
                        unified_row[1] = row[header_map['スクリプト名']]

                    # ステータス
                    if 'ステータス' in header_map:
                        unified_row[2] = row[header_map['ステータス']]

                    # レコードID
                    if 'レコードID' in header_map:
                        unified_row[3] = row[header_map['レコードID']]
                    elif '通話ID' in header_map:
                        unified_row[3] = row[header_map['通話ID']]
                        unified_row[12] = row[header_map['通話ID']]
                    elif '記録ID' in header_map:
                        unified_row[3] = row[header_map['記録ID']]
                        unified_row[23] = row[header_map['記録ID']]
                    elif '利用者ID' in header_map:
                        unified_row[3] = row[header_map['利用者ID']]
                        unified_row[19] = row[header_map['利用者ID']]
                    elif 'ドキュメントキー' in header_map:
                        unified_row[3] = row[header_map['ドキュメントキー']]
                        unified_row[27] = row[header_map['ドキュメントキー']]

                    # リクエストID
                    if 'リクエストID' in header_map:
                        unified_row[4] = row[header_map['リクエストID']]

                    # 処理時間
                    if '処理時間(秒)' in header_map:
                        unified_row[5] = row[header_map['処理時間(秒)']]
                    elif '実行時間(秒)' in header_map:
                        unified_row[5] = row[header_map['実行時間(秒)']]

                    # モデル名
                    if 'モデル名' in header_map:
                        unified_row[6] = row[header_map['モデル名']]
                    elif 'モデル' in header_map:
                        unified_row[6] = row[header_map['モデル']]

                    # Input Tokens
                    if 'Input Tokens' in header_map:
                        unified_row[7] = row[header_map['Input Tokens']]

                    # Output Tokens
                    if 'Output Tokens' in header_map:
                        unified_row[8] = row[header_map['Output Tokens']]

                    # Input料金(円)
                    if 'Input料金(円)' in header_map:
                        unified_row[9] = row[header_map['Input料金(円)']]

                    # Output料金(円)
                    if 'Output料金(円)' in header_map:
                        unified_row[10] = row[header_map['Output料金(円)']]

                    # 合計料金(円)
                    if '合計料金(円)' in header_map:
                        unified_row[11] = row[header_map['合計料金(円)']]

                    # その他のプロジェクト固有項目
                    if 'ファイルパス' in header_map:
                        unified_row[13] = row[header_map['ファイルパス']]

                    if 'ファイルID' in header_map:
                        unified_row[14] = row[header_map['ファイルID']]

                    if 'ファイルサイズ' in header_map:
                        unified_row[15] = row[header_map['ファイルサイズ']]

                    if '要約（抜粋）' in header_map:
                        unified_row[16] = row[header_map['要約（抜粋）']]
                    elif '要約(抜粋)' in header_map:
                        unified_row[16] = row[header_map['要約(抜粋)']]

                    if '文字起こし長' in header_map:
                        unified_row[17] = row[header_map['文字起こし長']]

                    if 'アクション数' in header_map:
                        unified_row[18] = row[header_map['アクション数']]

                    if '利用者名' in header_map:
                        unified_row[20] = row[header_map['利用者名']]

                    if '依頼理由' in header_map:
                        unified_row[21] = row[header_map['依頼理由']]

                    if '全文回答ID' in header_map:
                        unified_row[22] = row[header_map['全文回答ID']]

                    if 'スタッフID' in header_map:
                        unified_row[24] = row[header_map['スタッフID']]

                    if '記録タイプ' in header_map:
                        unified_row[25] = row[header_map['記録タイプ']]

                    if '入力テキスト長' in header_map:
                        unified_row[26] = row[header_map['入力テキスト長']]

                    if 'ファイル名' in header_map:
                        unified_row[29] = row[header_map['ファイル名']]

                    if '処理種別' in header_map:
                        unified_row[28] = row[header_map['処理種別']]

                    if '処理結果（ページ数）' in header_map:
                        unified_row[30] = row[header_map['処理結果（ページ数）']]
                    elif '処理結果(ページ数)' in header_map:
                        unified_row[30] = row[header_map['処理結果(ページ数)']]

                    if 'ログサマリー' in header_map:
                        unified_row[33] = row[header_map['ログサマリー']]

                    if 'エラー詳細' in header_map:
                        unified_row[34] = row[header_map['エラー詳細']]
                    elif 'エラーメッセージ' in header_map:
                        unified_row[34] = row[header_map['エラーメッセージ']]

                    if '実行ユーザー' in header_map:
                        unified_row[35] = row[header_map['実行ユーザー']]

                    if '備考' in header_map:
                        unified_row[36] = row[header_map['備考']]

                    all_data.append(unified_row)

                except Exception as e:
                    print(f"    警告: 行の処理でエラー: {e}")
                    continue

        except Exception as e:
            print(f"    エラー: {e}")
            continue

    print(f"\n  合計データ行数: {len(all_data)}")

    # 3. 日時順でソート
    print("\n[3] データを日時順でソート中...")

    def parse_timestamp(ts_str):
        """タイムスタンプ文字列をdatetimeオブジェクトに変換"""
        if not ts_str:
            return datetime.min

        try:
            # 様々な日時形式に対応
            for fmt in [
                '%Y/%m/%d %H:%M:%S',
                '%Y-%m-%d %H:%M:%S',
                '%Y/%m/%d %H:%M',
                '%Y-%m-%d %H:%M',
                '%Y/%m/%d',
                '%Y-%m-%d'
            ]:
                try:
                    return datetime.strptime(ts_str, fmt)
                except ValueError:
                    continue

            # シリアル番号形式の可能性
            try:
                serial = float(ts_str)
                # Excelシリアル番号から日時に変換
                base_date = datetime(1899, 12, 30)
                return base_date + timedelta(days=serial)
            except:
                pass

            return datetime.min
        except:
            return datetime.min

    all_data.sort(key=lambda x: parse_timestamp(x[0]), reverse=True)  # 新しい順

    print(f"  [OK] ソート完了")

    # 4. コスト管理シートにデータを書き込み
    print("\n[4] コスト管理シートにデータを書き込み中...")

    if all_data:
        # バッチ処理で書き込み（1000行ずつ）
        batch_size = 1000
        for i in range(0, len(all_data), batch_size):
            batch = all_data[i:i+batch_size]
            start_row = i + 2  # ヘッダーの次の行から

            service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=f'コスト管理!A{start_row}',
                valueInputOption='RAW',
                body={'values': batch}
            ).execute()

            print(f"  書き込み: {i+1}～{min(i+batch_size, len(all_data))}行")

        print(f"\n  [OK] データ書き込み完了 ({len(all_data)}行)")
    else:
        print("  書き込むデータがありません")

    print("\n" + "=" * 80)
    print("コスト管理シート統合完了")
    print("=" * 80)
    print(f"\nスプレッドシートURL:")
    print(f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit#gid=295644856")

if __name__ == '__main__':
    from datetime import timedelta
    main()
