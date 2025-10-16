"""
実行履歴スプレッドシートの確認と作成
"""
import pickle
import os
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

def check_or_create_execution_log():
    """実行履歴スプレッドシートの存在確認と作成"""
    creds = None
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    
    drive_service = build('drive', 'v3', credentials=creds)
    sheets_service = build('sheets', 'v4', credentials=creds)
    
    folder_id = '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX'
    sheet_name = 'GAS実行履歴ログ'
    
    # 既存のスプレッドシートを検索
    query = f"name='{sheet_name}' and '{folder_id}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
    results = drive_service.files().list(
        q=query,
        fields='files(id, name, webViewLink)',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True
    ).execute()
    
    files = results.get('files', [])
    
    if files:
        print(f"既存のスプレッドシートが見つかりました:")
        for file in files:
            print(f"  名前: {file['name']}")
            print(f"  ID: {file['id']}")
            print(f"  URL: {file.get('webViewLink', 'N/A')}")
        return files[0]['id']
    else:
        # 新規作成
        print(f"スプレッドシート '{sheet_name}' を作成します...")
        
        spreadsheet_body = {
            'properties': {
                'title': sheet_name
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
            body=spreadsheet_body
        ).execute()
        
        spreadsheet_id = spreadsheet['spreadsheetId']
        
        # フォルダーに移動
        drive_service.files().update(
            fileId=spreadsheet_id,
            addParents=folder_id,
            supportsAllDrives=True
        ).execute()
        
        # ヘッダー行を追加
        headers = [
            ['タイムスタンプ', 'スクリプト名', 'ステータス', 'メッセージ', '詳細', 'リクエストID', '処理時間(秒)']
        ]
        
        sheets_service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range='実行ログ!A1:G1',
            valueInputOption='RAW',
            body={'values': headers}
        ).execute()
        
        # ヘッダー行のフォーマット
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
                            'backgroundColor': {'red': 0.2, 'green': 0.2, 'blue': 0.2},
                            'textFormat': {
                                'foregroundColor': {'red': 1, 'green': 1, 'blue': 1},
                                'bold': True
                            }
                        }
                    },
                    'fields': 'userEnteredFormat(backgroundColor,textFormat)'
                }
            }
        ]
        
        sheets_service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={'requests': requests}
        ).execute()
        
        # WebViewLinkを取得
        file_info = drive_service.files().get(
            fileId=spreadsheet_id,
            fields='webViewLink',
            supportsAllDrives=True
        ).execute()
        
        print(f"スプレッドシートを作成しました:")
        print(f"  ID: {spreadsheet_id}")
        print(f"  URL: {file_info.get('webViewLink', 'N/A')}")
        
        return spreadsheet_id

if __name__ == '__main__':
    sheet_id = check_or_create_execution_log()
    print(f"\n実行履歴スプレッドシートID: {sheet_id}")
