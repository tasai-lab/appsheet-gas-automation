#!/usr/bin/env python3
"""
Vector DB Spreadsheet 自動作成スクリプト (ADC版)

RAGシステム用の統合Vector DBスプレッドシートを自動作成します。
Application Default Credentials (ADC) を使用するため、token.pickleは不要です。

使用方法:
    python create_vector_db_spreadsheet_adc.py
"""

import os
import sys
import json
from pathlib import Path

try:
    from google.auth import default
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print("エラー: 必要なライブラリがインストールされていません")
    print("実行: pip install google-auth google-auth-httplib2 google-api-python-client")
    sys.exit(1)

# 定数
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

# 医療用語辞書初期データ (100語)
def load_medical_terms():
    """医療用語辞書から初期データを読み込み"""
    terms_file = Path(__file__).parent.parent / "data" / "medical_terms_100.json"
    if not terms_file.exists():
        print(f"警告: 医療用語辞書ファイルが見つかりません: {terms_file}")
        # フォールバック: 基本的な5語のみ
        return [
            {
                "term_id": "TERM_00001",
                "canonical": "膀胱留置カテーテル",
                "synonyms": ["バルーン","尿道カテーテル","Foley","フォーリー"],
                "category": "医療機器",
                "umls_cui": "C0085678",
                "frequency": 0,
                "created_at": "2025-10-27"
            },
            {
                "term_id": "TERM_00002",
                "canonical": "血圧",
                "synonyms": ["BP","ブラッドプレッシャー","血圧値"],
                "category": "バイタルサイン",
                "umls_cui": "C0005823",
                "frequency": 0,
                "created_at": "2025-10-27"
            },
            {
                "term_id": "TERM_00003",
                "canonical": "服薬",
                "synonyms": ["内服","薬剤服用","投薬","与薬"],
                "category": "看護行為",
                "umls_cui": "C0013227",
                "frequency": 0,
                "created_at": "2025-10-27"
            },
            {
                "term_id": "TERM_00004",
                "canonical": "体温",
                "synonyms": ["BT","体温測定","検温"],
                "category": "バイタルサイン",
                "umls_cui": "C0005903",
                "frequency": 0,
                "created_at": "2025-10-27"
            },
            {
                "term_id": "TERM_00005",
                "canonical": "脈拍",
                "synonyms": ["PR","心拍数","脈拍数"],
                "category": "バイタルサイン",
                "umls_cui": "C0232117",
                "frequency": 0,
                "created_at": "2025-10-27"
            }
        ]

    with open(terms_file, 'r', encoding='utf-8') as f:
        terms_data = json.load(f)

    # JSON形式をスプレッドシート形式に変換
    converted_terms = []
    for term in terms_data:
        converted_terms.append({
            "term_id": term["term_id"],
            "canonical": term["canonical"],
            "synonyms": json.dumps(term["synonyms"], ensure_ascii=False),
            "category": term["category"],
            "umls_cui": term.get("umls_cui", ""),
            "frequency": term.get("frequency", 0),
            "created_at": term.get("created_at", "2025-10-27")
        })

    return converted_terms


def get_credentials():
    """ADCから認証情報を取得"""
    try:
        credentials, project = default(scopes=[
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ])
        return credentials
    except Exception as error:
        print(f"❌ エラー: Application Default Credentials の取得に失敗しました")
        print(f"   {error}")
        print()
        print("以下のコマンドを実行して認証してください:")
        print("  gcloud auth application-default login")
        sys.exit(1)


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


def add_initial_medical_terms(service, spreadsheet_id, medical_terms):
    """医療用語辞書に初期データを追加"""
    try:
        # MedicalTermsシートにデータを追加
        values = [SHEET_SCHEMAS["MedicalTerms"]["headers"]]

        for term in medical_terms:
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

        print(f"  ✅ 医療用語辞書に初期データ追加完了 ({len(medical_terms)}件)")

    except HttpError as error:
        print(f"  ⚠️  医療用語辞書の初期データ追加に失敗: {error}")


def main():
    """メイン処理"""
    print("=" * 60)
    print("Vector DB Spreadsheet 自動作成ツール (ADC版)")
    print("=" * 60)
    print()

    # 認証情報の確認
    print("1. Application Default Credentials を確認中...")
    creds = get_credentials()
    print("   ✅ 認証情報取得完了")
    print()

    # 医療用語辞書を読み込み
    print("2. 医療用語辞書を読み込み中...")
    medical_terms = load_medical_terms()
    print(f"   ✅ {len(medical_terms)}語の医療用語を読み込みました")
    print()

    # Sheets APIサービスを作成
    print("3. Google Sheets APIに接続中...")
    try:
        service = build('sheets', 'v4', credentials=creds)
        print("   ✅ 接続完了")
    except Exception as error:
        print(f"   ❌ エラー: {error}")
        sys.exit(1)
    print()

    # スプレッドシートを作成
    print("4. スプレッドシートを作成中...")
    spreadsheet_id = create_spreadsheet(service, TARGET_FOLDER_ID, SPREADSHEET_NAME)
    print()

    # 各シートをフォーマット
    print("5. シートをフォーマット中...")
    for sheet_name, schema in SHEET_SCHEMAS.items():
        format_sheet(service, spreadsheet_id, sheet_name, schema)
    print()

    # 医療用語辞書に初期データを追加
    print("6. 医療用語辞書に初期データを追加中...")
    add_initial_medical_terms(service, spreadsheet_id, medical_terms)
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
    print("1. set_spreadsheet_id.py を実行して自動設定")
    print(f"   python rag_system/scripts/set_spreadsheet_id.py {spreadsheet_id}")
    print()
    print("または手動で設定:")
    print("2. common_modules/vector_db_sync.gs の VECTOR_DB_CONFIG.spreadsheetId を更新")
    print(f"   spreadsheetId: '{spreadsheet_id}'")
    print()
    print("3. rag_system/backend/.env に VECTOR_DB_SPREADSHEET_ID を追加")
    print(f"   VECTOR_DB_SPREADSHEET_ID={spreadsheet_id}")
    print()


if __name__ == '__main__':
    main()
