"""
Create execution log spreadsheet - simplified version
"""
import pickle
from googleapiclient.discovery import build

FOLDER_ID = '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX'
SPREADSHEET_NAME = 'GAS実行ログ'

def get_credentials():
    """Get credentials from token.pickle"""
    with open('token.pickle', 'rb') as token:
        creds = pickle.load(token)
    return creds

def main():
    print("Creating execution log spreadsheet...")
    
    creds = get_credentials()
    sheets_service = build('sheets', 'v4', credentials=creds)
    drive_service = build('drive', 'v3', credentials=creds)
    
    # Create simple spreadsheet
    spreadsheet = {
        'properties': {
            'title': SPREADSHEET_NAME
        }
    }
    
    result = sheets_service.spreadsheets().create(body=spreadsheet).execute()
    spreadsheet_id = result['spreadsheetId']
    
    print(f"✓ Spreadsheet created: {spreadsheet_id}")
    
    # Get sheet info to find correct sheet name
    sheet_metadata = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    sheet_name = sheet_metadata['sheets'][0]['properties']['title']
    
    print(f"✓ Sheet name: {sheet_name}")
    
    # Add headers
    values = [[
        'タイムスタンプ',
        'スクリプト名', 
        'ステータス',
        '処理ID',
        'メッセージ',
        'エラー詳細',
        '実行時間(秒)',
        'ユーザー',
        '入力データ'
    ]]
    
    body = {
        'values': values
    }
    
    sheets_service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=f'{sheet_name}!A1:I1',
        valueInputOption='RAW',
        body=body
    ).execute()
    
    print(f"✓ Headers added")
    
    # Move to folder
    file = drive_service.files().get(
        fileId=spreadsheet_id,
        fields='parents',
        supportsAllDrives=True
    ).execute()
    
    previous_parents = ",".join(file.get('parents', []))
    
    drive_service.files().update(
        fileId=spreadsheet_id,
        addParents=FOLDER_ID,
        removeParents=previous_parents,
        fields='id, parents',
        supportsAllDrives=True
    ).execute()
    
    print(f"✓ Moved to folder: {FOLDER_ID}")
    print(f"\n✓ Spreadsheet ID: {spreadsheet_id}")
    
    # Save to file
    with open('execution_log_spreadsheet_id.txt', 'w') as f:
        f.write(spreadsheet_id)
    
    print(f"✓ Saved to execution_log_spreadsheet_id.txt")

if __name__ == '__main__':
    main()
