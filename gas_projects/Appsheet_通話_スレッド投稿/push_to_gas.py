#!/usr/bin/env python3
"""
GASプロジェクトへの自動アップロードスクリプト
Windows/Mac両対応、clasp pushの代替

使用方法:
    python3 push_to_gas.py
"""

import json
import glob
import os
import sys
from pathlib import Path
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

# Script ID
SCRIPT_ID = "1p7hVK2hZFXU-A2pnV9KqVVW4CFYI3IX0HW86QdGePUlXgzwH1cg0MAZs"

# ホームディレクトリを取得（Windows/Mac対応）
HOME_DIR = Path.home()
CLASPRC_PATH = HOME_DIR / ".clasprc.json"

def get_credentials():
    """clasp認証情報からCredentialsオブジェクトを作成"""
    if not CLASPRC_PATH.exists():
        print(f"❌ {CLASPRC_PATH} が見つかりません")
        print("   まず 'clasp login' を実行してください")
        sys.exit(1)

    with open(CLASPRC_PATH, 'r') as f:
        clasp_data = json.load(f)

    token_data = clasp_data['tokens']['default']

    creds = Credentials(
        token=token_data.get('access_token'),
        refresh_token=token_data.get('refresh_token'),
        token_uri='https://oauth2.googleapis.com/token',
        client_id=token_data.get('client_id'),
        client_secret=token_data.get('client_secret'),
        scopes=[
            'https://www.googleapis.com/auth/script.projects',
            'https://www.googleapis.com/auth/drive.file'
        ]
    )

    # トークンをリフレッシュ
    if creds.expired or not creds.valid:
        print("🔄 アクセストークンをリフレッシュ中...")
        creds.refresh(Request())

        # 新しいトークンを保存
        token_data['access_token'] = creds.token
        with open(CLASPRC_PATH, 'w') as f:
            json.dump(clasp_data, f, indent=2)

    return creds

def read_project_files(scripts_dir):
    """スクリプトディレクトリからファイルを読み込む"""
    files = []

    # appsscript.json
    appsscript_path = scripts_dir / 'appsscript.json'
    if appsscript_path.exists():
        with open(appsscript_path, 'r', encoding='utf-8') as f:
            files.append({
                "name": "appsscript",
                "type": "JSON",
                "source": f.read()
            })
    else:
        print(f"⚠️  {appsscript_path} が見つかりません")
        return None

    # .gsファイル
    gs_files = sorted(scripts_dir.glob('*.gs'))
    for gs_file in gs_files:
        with open(gs_file, 'r', encoding='utf-8') as f:
            name = gs_file.stem
            files.append({
                "name": name,
                "type": "SERVER_JS",
                "source": f.read()
            })

    return files

def upload_to_gas(creds, files):
    """Google Apps Script APIでファイルをアップロード"""
    service = build('script', 'v1', credentials=creds)

    content = {"files": files}

    try:
        # まず現在のコンテンツを取得（これによりアクセス権が確認される）
        print("📥 現在のプロジェクト内容を取得中...")
        current = service.projects().getContent(scriptId=SCRIPT_ID).execute()
        print(f"   ✓ 現在 {len(current.get('files', []))} ファイル")

        # コンテンツを更新
        print(f"\n📤 {len(files)} ファイルをアップロード中...")
        response = service.projects().updateContent(
            scriptId=SCRIPT_ID,
            body=content
        ).execute()

        uploaded_files = response.get('files', [])
        print(f"\n✅ アップロード完了!")
        print(f"   アップロードされたファイル: {len(uploaded_files)}件")

        for file in uploaded_files:
            file_type = file.get('type', 'UNKNOWN')
            print(f"   - {file.get('name')} ({file_type})")

        return True

    except Exception as e:
        print(f"\n❌ アップロード失敗: {e}")

        # エラーの詳細を表示
        if hasattr(e, 'resp'):
            print(f"   ステータスコード: {e.resp.status}")
            print(f"   理由: {e.resp.get('reason', 'Unknown')}")

        return False

def main():
    print("=" * 70)
    print("GASプロジェクト自動アップロードスクリプト")
    print("=" * 70)
    print(f"\nScript ID: {SCRIPT_ID}")
    print(f"プラットフォーム: {sys.platform}")
    print(f"ホームディレクトリ: {HOME_DIR}\n")

    # 現在のディレクトリを確認
    current_dir = Path.cwd()
    scripts_dir = current_dir / 'scripts'

    if not scripts_dir.exists():
        print(f"❌ {scripts_dir} が見つかりません")
        print(f"   現在のディレクトリ: {current_dir}")
        print(f"   プロジェクトルートから実行してください")
        sys.exit(1)

    # 認証情報を取得
    print("🔐 認証情報を読み込み中...")
    try:
        creds = get_credentials()
        print("   ✓ 認証情報取得完了\n")
    except Exception as e:
        print(f"❌ 認証エラー: {e}")
        sys.exit(1)

    # ファイルを読み込み
    print("📁 プロジェクトファイルを読み込み中...")
    files = read_project_files(scripts_dir)

    if not files:
        print("❌ ファイルの読み込みに失敗しました")
        sys.exit(1)

    print(f"   ✓ {len(files)} ファイル読み込み完了")
    for file in files:
        print(f"     - {file['name']}")

    # GASにアップロード
    success = upload_to_gas(creds, files)

    print("\n" + "=" * 70)
    if success:
        print("✨ 完了! GASプロジェクトが更新されました")
        print("\n次のステップ:")
        print("  cd ../..")
        print('  python3 deploy_unified.py "Appsheet_通話_スレッド投稿" "v1.3: コード更新"')
    else:
        print("❌ アップロードに失敗しました")
        print("\n対処方法:")
        print("  1. GASエディタでプロジェクトを開く:")
        print(f"     https://script.google.com/d/{SCRIPT_ID}/edit")
        print("  2. 'clasp logout' && 'clasp login' で再認証")
    print("=" * 70)

    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
