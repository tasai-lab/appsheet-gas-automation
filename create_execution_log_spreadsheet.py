#!/usr/bin/env python3
"""
実行ログ用スプレッドシートを作成するスクリプト
"""

import os
import pickle
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

def create_execution_log_spreadsheet():
    """実行ログ用スプレッドシートを作成"""
    # 認証情報を読み込む
    creds = None
    token_path = 'token.pickle'
    
    if os.path.exists(token_path):
        with open(token_path, 'rb') as token:
            creds = pickle.load(token)
    
    if not creds or not creds.valid:
        print("認証情報が無効です。")
        return
    
    try:
        # Google Drive APIとSheets APIのサービスを構築
        drive_service = build('drive', 'v3', credentials=creds)
        sheets_service = build('sheets', 'v4', credentials=creds)
        
        folder_id = '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX'
        
        # スプレッドシートを作成
        spreadsheet = {
            'properties': {
                'title': 'GAS実行履歴ログ'
            },
            'sheets': [
                {
                    'properties': {
                        'title': '実行ログ',
                        'gridProperties': {
                            'frozenRowCount': 1
                        }
                    }
                }
            ]
        }
        
        spreadsheet = sheets_service.spreadsheets().create(
            body=spreadsheet,
            fields='spreadsheetId'
        ).execute()
        
        spreadsheet_id = spreadsheet.get('spreadsheetId')
        print(f'スプレッドシートを作成しました: {spreadsheet_id}')
        
        # ヘッダー行を設定
        header_values = [[
            'タイムスタンプ',
            'スクリプト名',
            'ステータス',
            'メッセージ',
            '詳細',
            'リクエストID',
            '処理時間(秒)'
        ]]
        
        sheets_service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range='実行ログ!A1:G1',
            valueInputOption='RAW',
            body={'values': header_values}
        ).execute()
        
        # ヘッダー行をフォーマット
        requests = [
            {
                'repeatCell': {
                    'range': {
                        'sheetId': 0,
                        'startRowIndex': 0,
                        'endRowIndex': 1
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'backgroundColor': {
                                'red': 0.9,
                                'green': 0.9,
                                'blue': 0.9
                            },
                            'textFormat': {
                                'bold': True
                            }
                        }
                    },
                    'fields': 'userEnteredFormat(backgroundColor,textFormat)'
                }
            },
            {
                'updateDimensionProperties': {
                    'range': {
                        'sheetId': 0,
                        'dimension': 'COLUMNS',
                        'startIndex': 0,
                        'endIndex': 1
                    },
                    'properties': {
                        'pixelSize': 150
                    },
                    'fields': 'pixelSize'
                }
            },
            {
                'updateDimensionProperties': {
                    'range': {
                        'sheetId': 0,
                        'dimension': 'COLUMNS',
                        'startIndex': 1,
                        'endIndex': 2
                    },
                    'properties': {
                        'pixelSize': 200
                    },
                    'fields': 'pixelSize'
                }
            },
            {
                'updateDimensionProperties': {
                    'range': {
                        'sheetId': 0,
                        'dimension': 'COLUMNS',
                        'startIndex': 2,
                        'endIndex': 3
                    },
                    'properties': {
                        'pixelSize': 100
                    },
                    'fields': 'pixelSize'
                }
            },
            {
                'updateDimensionProperties': {
                    'range': {
                        'sheetId': 0,
                        'dimension': 'COLUMNS',
                        'startIndex': 3,
                        'endIndex': 4
                    },
                    'properties': {
                        'pixelSize': 300
                    },
                    'fields': 'pixelSize'
                }
            },
            {
                'updateDimensionProperties': {
                    'range': {
                        'sheetId': 0,
                        'dimension': 'COLUMNS',
                        'startIndex': 4,
                        'endIndex': 5
                    },
                    'properties': {
                        'pixelSize': 400
                    },
                    'fields': 'pixelSize'
                }
            },
            {
                'updateDimensionProperties': {
                    'range': {
                        'sheetId': 0,
                        'dimension': 'COLUMNS',
                        'startIndex': 5,
                        'endIndex': 6
                    },
                    'properties': {
                        'pixelSize': 150
                    },
                    'fields': 'pixelSize'
                }
            },
            {
                'updateDimensionProperties': {
                    'range': {
                        'sheetId': 0,
                        'dimension': 'COLUMNS',
                        'startIndex': 6,
                        'endIndex': 7
                    },
                    'properties': {
                        'pixelSize': 100
                    },
                    'fields': 'pixelSize'
                }
            }
        ]
        
        sheets_service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={'requests': requests}
        ).execute()
        
        print('ヘッダー行を設定しました')
        
        # スプレッドシートを指定フォルダーに移動
        file = drive_service.files().get(
            fileId=spreadsheet_id,
            fields='parents',
            supportsAllDrives=True
        ).execute()
        
        previous_parents = ','.join(file.get('parents', []))
        
        drive_service.files().update(
            fileId=spreadsheet_id,
            addParents=folder_id,
            removeParents=previous_parents,
            fields='id, parents',
            supportsAllDrives=True
        ).execute()
        
        print(f'スプレッドシートをフォルダー {folder_id} に移動しました')
        print(f'\nスプレッドシートID: {spreadsheet_id}')
        print(f'URL: https://docs.google.com/spreadsheets/d/{spreadsheet_id}')
        
        # スプレッドシートIDをファイルに保存
        with open('execution_log_spreadsheet_id.txt', 'w') as f:
            f.write(spreadsheet_id)
        
        print('\nスプレッドシートIDを execution_log_spreadsheet_id.txt に保存しました')
        
        return spreadsheet_id
        
    except HttpError as error:
        print(f'エラーが発生しました: {error}')
        return None

if __name__ == '__main__':
    create_execution_log_spreadsheet()
