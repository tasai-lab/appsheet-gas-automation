#!/usr/bin/env python3
"""
Vector DB Spreadsheet 自動作成スクリプト

RAGシステム用の統合Vector DBスプレッドシートを自動作成します。

使用方法:
    python create_vector_db_spreadsheet.py
"""

import os
import sys
import json
from pathlib import Path

# 親ディレクトリのパスを追加してretrieve_gas.pyの認証情報を使用
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

try:
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    import pickle
except ImportError:
    print("エラー: 必要なライブラリがインストールされていません")
    print("実行: pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client")
    sys.exit(1)

# 定数
TOKEN_PICKLE = Path(__file__).parent.parent.parent / "token.pickle"
CREDENTIALS_JSON = Path(__file__).parent.parent.parent / "credentials.json"
TARGET_FOLDER_ID = "16swPUizvdlyPxUjbDpVl9-VBDJZO91kX"
SPREADSHEET_NAME = "RAG_VectorDB_統合ナレッジベース"

# シートスキーマ定義
SHEET_SCHEMAS = {
    "KnowledgeBase": {
        "headers": [
            "id", "domain", "source_type", "source_table", "source_id",
            "user_id", "title", "content", "structured_data", "metadata",
            "tags", "bm25_keywords", "date", "created_at", "updated_at"
        ],
        "header_color": {"red": 0.259, "green": 0.522, "blue": 0.957},  # #4285F4
        "text_color": {"red": 1.0, "green": 1.0, "blue": 1.0}  # White
    },
    "Embeddings": {
        "headers": [
            "kb_id", "embedding", "model", "task_type", "generated_at"
        ],
        "header_color": {"red": 0.204, "green": 0.659, "blue": 0.325},  # #34A853
        "text_color": {"red": 1.0, "green": 1.0, "blue": 1.0}  # White
    },
    "MedicalTerms": {
        "headers": [
            "term_id", "canonical", "synonyms", "category", "umls_cui",
            "frequency", "created_at"
        ],
        "header_color": {"red": 0.984, "green": 0.737, "blue": 0.016},  # #FBBC04
        "text_color": {"red": 0.0, "green": 0.0, "blue": 0.0}  # Black
    },
    "ChatHistory": {
        "headers": [
            "session_id", "user_id", "role", "message", "context_ids",
            "suggested_terms", "term_feedback", "timestamp"
        ],
        "header_color": {"red": 0.918, "green": 0.263, "blue": 0.208},  # #EA4335
        "text_color": {"red": 1.0, "green": 1.0, "blue": 1.0}  # White
    }
}

# 医療用語辞書初期データ
INITIAL_MEDICAL_TERMS = [
    {
        "term_id": "TERM_00001",
        "canonical": "膀胱留置カテーテル",
        "synonyms": '["バルーン","尿道カテーテル","Foley","フォーリー"]',
        "category": "医療機器",
        "umls_cui": "C0085678",
        "frequency": 0,
        "created_at": "2025-10-27"
    },
    {
        "term_id": "TERM_00002",
        "canonical": "血圧",
        "synonyms": '["BP","ブラッドプレッシャー","血圧値"]',
        "category": "バイタルサイン",
        "umls_cui": "C0005823",
        "frequency": 0,
        "created_at": "2025-10-27"
    },
    {
        "term_id": "TERM_00003",
        "canonical": "服薬",
        "synonyms": '["内服","薬剤服用","投薬","与薬"]',
        "category": "看護行為",
        "umls_cui": "C0013227",
        "frequency": 0,
        "created_at": "2025-10-27"
    },
    {
        "term_id": "TERM_00004",
        "canonical": "体温",
        "synonyms": '["BT","体温測定","検温"]',
        "category": "バイタルサイン",
        "umls_cui": "C0005903",
        "frequency": 0,
        "created_at": "2025-10-27"
    },
    {
        "term_id": "TERM_00005",
        "canonical": "脈拍",
        "synonyms": '["PR","心拍数","脈拍数"]',
        "category": "バイタルサイン",
        "umls_cui": "C0232117",
        "frequency": 0,
        "created_at": "2025-10-27"
    }
]


def get_credentials():
    """認証情報を取得"""
    creds = None

    if TOKEN_PICKLE.exists():
        with open(TOKEN_PICKLE, 'rb') as token:
            creds = pickle.load(token)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            print("エラー: 有効な認証情報がありません")
            print(f"token.pickleを確認してください: {TOKEN_PICKLE}")
            sys.exit(1)

    return creds


def create_spreadsheet(service, folder_id, name):
    """スプレッドシートを作成"""
    try:
        spreadsheet = {
            'properties': {
                'title': name
            },
            'sheets': []
        }

        # シートを追加
        for sheet_name in SHEET_SCHEMAS.keys():
            spreadsheet['sheets'].append({
                'properties': {
                    'title': sheet_name
                }
            })

        result = service.spreadsheets().create(body=spreadsheet).execute()
        spreadsheet_id = result['spreadsheetId']

        print(f"✅ スプレッドシート作成完了: {spreadsheet_id}")

        # フォルダに移動
        drive_service = build('drive', 'v3', credentials=get_credentials())
        file = drive_service.files().get(fileId=spreadsheet_id, fields='parents').execute()
        previous_parents = ",".join(file.get('parents', []))

        drive_service.files().update(
            fileId=spreadsheet_id,
            addParents=folder_id,
            removeParents=previous_parents,
            fields='id, parents'
        ).execute()

        print(f"✅ フォルダに移動完了: {folder_id}")

        return spreadsheet_id

    except HttpError as error:
        print(f"エラー: スプレッドシート作成に失敗しました - {error}")
        sys.exit(1)


def format_sheet(service, spreadsheet_id, sheet_name, schema):
    """シートのヘッダーとフォーマットを設定"""
    try:
        # シートIDを取得
        spreadsheet = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
        sheet_id = None
        for sheet in spreadsheet['sheets']:
            if sheet['properties']['title'] == sheet_name:
                sheet_id = sheet['properties']['sheetId']
                break

        if sheet_id is None:
            print(f"警告: シート '{sheet_name}' が見つかりません")
            return

        requests = []

        # 1. ヘッダー行を追加
        requests.append({
            'updateCells': {
                'rows': [{
                    'values': [
                        {
                            'userEnteredValue': {'stringValue': header},
                            'userEnteredFormat': {
                                'backgroundColor': schema['header_color'],
                                'textFormat': {
                                    'foregroundColor': schema['text_color'],
                                    'bold': True
                                }
                            }
                        } for header in schema['headers']
                    ]
                }],
                'fields': 'userEnteredValue,userEnteredFormat',
                'start': {'sheetId': sheet_id, 'rowIndex': 0, 'columnIndex': 0}
            }
        })

        # 2. 列Aを固定
        requests.append({
            'updateSheetProperties': {
                'properties': {
                    'sheetId': sheet_id,
                    'gridProperties': {
                        'frozenRowCount': 1,
                        'frozenColumnCount': 1
                    }
                },
                'fields': 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount'
            }
        })

        # 3. フィルターを有効化
        requests.append({
            'setBasicFilter': {
                'filter': {
                    'range': {
                        'sheetId': sheet_id,
                        'startRowIndex': 0,
                        'endRowIndex': 1000,
                        'startColumnIndex': 0,
                        'endColumnIndex': len(schema['headers'])
                    }
                }
            }
        })

        # 4. 列幅を自動調整
        requests.append({
            'autoResizeDimensions': {
                'dimensions': {
                    'sheetId': sheet_id,
                    'dimension': 'COLUMNS',
                    'startIndex': 0,
                    'endIndex': len(schema['headers'])
                }
            }
        })

        # リクエストを一括実行
        body = {'requests': requests}
        service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body=body
        ).execute()

        print(f"  ✅ {sheet_name} シートのフォーマット完了")

    except HttpError as error:
        print(f"  ⚠️  {sheet_name} シートのフォーマットに失敗: {error}")


def add_initial_medical_terms(service, spreadsheet_id):
    """医療用語辞書に初期データを追加"""
    try:
        # MedicalTermsシートにデータを追加
        values = [SHEET_SCHEMAS["MedicalTerms"]["headers"]]

        for term in INITIAL_MEDICAL_TERMS:
            values.append([
                term["term_id"],
                term["canonical"],
                term["synonyms"],
                term["category"],
                term["umls_cui"],
                term["frequency"],
                term["created_at"]
            ])

        body = {'values': values}
        service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range='MedicalTerms!A1',
            valueInputOption='RAW',
            body=body
        ).execute()

        print(f"  ✅ 医療用語辞書に初期データ追加完了 ({len(INITIAL_MEDICAL_TERMS)}件)")

    except HttpError as error:
        print(f"  ⚠️  医療用語辞書の初期データ追加に失敗: {error}")


def main():
    """メイン処理"""
    print("=" * 60)
    print("Vector DB Spreadsheet 自動作成ツール")
    print("=" * 60)
    print()

    # 認証情報の確認
    print("1. 認証情報を確認中...")
    if not TOKEN_PICKLE.exists():
        print(f"❌ エラー: token.pickleが見つかりません: {TOKEN_PICKLE}")
        print("   retrieve_gas.pyを実行して認証を完了してください")
        sys.exit(1)

    creds = get_credentials()
    print("   ✅ 認証情報取得完了")
    print()

    # Sheets APIサービスを作成
    print("2. Google Sheets APIに接続中...")
    try:
        service = build('sheets', 'v4', credentials=creds)
        print("   ✅ 接続完了")
    except Exception as error:
        print(f"   ❌ エラー: {error}")
        sys.exit(1)
    print()

    # スプレッドシートを作成
    print("3. スプレッドシートを作成中...")
    spreadsheet_id = create_spreadsheet(service, TARGET_FOLDER_ID, SPREADSHEET_NAME)
    print()

    # 各シートをフォーマット
    print("4. シートをフォーマット中...")
    for sheet_name, schema in SHEET_SCHEMAS.items():
        format_sheet(service, spreadsheet_id, sheet_name, schema)
    print()

    # 医療用語辞書に初期データを追加
    print("5. 医療用語辞書に初期データを追加中...")
    add_initial_medical_terms(service, spreadsheet_id)
    print()

    # 完了メッセージ
    print("=" * 60)
    print("✅ Vector DB Spreadsheet 作成完了！")
    print("=" * 60)
    print()
    print(f"スプレッドシートID: {spreadsheet_id}")
    print(f"URL: https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit")
    print()
    print("次のステップ:")
    print("1. common_modules/vector_db_sync.gs の VECTOR_DB_CONFIG.spreadsheetId を更新")
    print(f"   spreadsheetId: '{spreadsheet_id}'")
    print()
    print("2. rag_system/backend/.env に VECTOR_DB_SPREADSHEET_ID を追加")
    print(f"   VECTOR_DB_SPREADSHEET_ID={spreadsheet_id}")
    print()
    print("3. common_modules/test_rag_modules.gs の testAllRAGModules() を実行して検証")
    print()


if __name__ == '__main__':
    main()
