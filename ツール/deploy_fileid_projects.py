#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ファイルID関連プロジェクトを一括デプロイ

FileIdUtilities共通モジュールを含むプロジェクトをデプロイ
"""
import os
import sys
import json
import pickle
import argparse
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Windowsのコンソール文字コード問題を回避
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# 認証スコープ
SCOPES = [
    'https://www.googleapis.com/auth/script.projects',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets'
]

# ファイルID関連プロジェクトリスト
FILEID_PROJECTS = [
    'Appsheet_通話_ファイルID取得',
    'Appsheet_営業_ファイルID取得',
    'AppSheet_ALL_ファイルID',
    'Appsheet_通話_要約生成',  # FileIdUtilitiesは不要だが関連プロジェクト
]

def get_credentials(credentials_path=None, token_path=None):
    """認証情報を取得"""
    creds = None

    # デフォルトパスを設定
    if credentials_path is None:
        credentials_path = Path(__file__).parent.parent / 'credentials.json'
    if token_path is None:
        token_path = Path(__file__).parent.parent / 'token.pickle'

    if token_path.exists():
        with open(token_path, 'rb') as token:
            creds = pickle.load(token)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                str(credentials_path), SCOPES)
            creds = flow.run_local_server(port=0)

        with open(token_path, 'wb') as token:
            pickle.dump(creds, token)

    return creds

def read_project_files(project_dir):
    """プロジェクトディレクトリから全ファイルを読み込み"""
    files = []
    project_path = Path(project_dir)
    scripts_dir = project_path / 'scripts'

    # scriptsディレクトリが存在しない場合はプロジェクトディレクトリ自体を使用
    if not scripts_dir.exists():
        scripts_dir = project_path

    # まずappsscript.jsonをプロジェクトディレクトリから読み込む
    manifest_path = project_path / 'appsscript.json'
    if manifest_path.exists():
        with open(manifest_path, 'r', encoding='utf-8') as f:
            content = f.read()
        files.append({
            'name': 'appsscript',
            'type': 'JSON',
            'source': content
        })

    # 他のファイルを読み込む
    for file_path in scripts_dir.glob('*'):
        if not file_path.is_file():
            continue

        # 隠しファイル(.clasp.jsonなど)やREADME、appsscript.jsonはスキップ
        if file_path.name.startswith('.') or file_path.name == 'README.md' or file_path.name == 'appsscript.json':
            continue

        # ファイルタイプを判定
        if file_path.suffix == '.gs':
            file_type = 'SERVER_JS'
        elif file_path.suffix == '.html':
            file_type = 'HTML'
        else:
            # サポートされていないファイルタイプはスキップ
            continue

        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 拡張子を除いたファイル名を使用
        name = file_path.stem

        files.append({
            'name': name,
            'type': file_type,
            'source': content
        })

    return files

def get_script_id_from_metadata(project_dir):
    """メタデータからスクリプトIDを取得"""
    metadata_path = Path(project_dir) / '.clasp.json'

    if metadata_path.exists():
        with open(metadata_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('scriptId')

    return None

def update_gas_project(service, script_id, files):
    """GASプロジェクトを更新"""
    try:
        # 現在のプロジェクト内容を取得
        content = service.projects().getContent(scriptId=script_id).execute()

        # 新しいファイル構造を作成
        new_files = []
        for file_data in files:
            new_files.append({
                'name': file_data['name'],
                'type': file_data['type'],
                'source': file_data['source']
            })

        # プロジェクトを更新
        body = {
            'files': new_files
        }

        response = service.projects().updateContent(
            scriptId=script_id,
            body=body
        ).execute()

        return True, response

    except Exception as e:
        return False, str(e)

def deploy_version(service, script_id, description):
    """新しいバージョンをデプロイ"""
    try:
        # 新しいバージョンを作成
        version_body = {
            'description': description
        }
        version = service.projects().versions().create(
            scriptId=script_id,
            body=version_body
        ).execute()

        print(f"  バージョン {version.get('versionNumber')} を作成しました")

        # デプロイメント一覧を取得
        deployments = service.projects().deployments().list(
            scriptId=script_id
        ).execute()

        # アクティブなデプロイメントを更新
        for deployment in deployments.get('deployments', []):
            if deployment.get('deploymentConfig', {}).get('description') != '@HEAD':
                deployment_id = deployment['deploymentId']

                # デプロイメントを更新
                update_body = {
                    'deploymentConfig': {
                        'versionNumber': version['versionNumber'],
                        'description': description
                    }
                }

                try:
                    service.projects().deployments().update(
                        scriptId=script_id,
                        deploymentId=deployment_id,
                        body=update_body
                    ).execute()

                    print(f"  デプロイメント {deployment_id} を更新しました")
                except Exception as e:
                    if "Read-only" in str(e):
                        print(f"  ⚠ デプロイメント更新スキップ（Read-only）: {deployment_id}")
                    else:
                        raise e

        return True

    except Exception as e:
        print(f"  デプロイエラー: {e}")
        return False

def parse_arguments():
    """引数をパース"""
    parser = argparse.ArgumentParser(
        description='ファイルID関連GASプロジェクトを一括デプロイ',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        '--projects-dir',
        type=Path,
        default=Path(__file__).parent.parent / 'gas_projects',
        help='GASプロジェクトディレクトリ (デフォルト: gas_projects)'
    )

    parser.add_argument(
        '--description',
        default='FileIdUtilities共通モジュール導入 - ファイル処理の標準化',
        help='デプロイメントの説明'
    )

    parser.add_argument(
        '--credentials',
        type=Path,
        default=Path(__file__).parent.parent / 'credentials.json',
        help='認証情報ファイル (デフォルト: credentials.json)'
    )

    parser.add_argument(
        '--token',
        type=Path,
        default=Path(__file__).parent.parent / 'token.pickle',
        help='トークンファイル (デフォルト: token.pickle)'
    )

    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='詳細ログを表示'
    )

    parser.add_argument(
        '--all',
        action='store_true',
        help='プロジェクトリストを無視してすべてのプロジェクトをデプロイ'
    )

    return parser.parse_args()


def main():
    """メイン処理"""
    args = parse_arguments()

    print("ファイルID関連GASプロジェクトのデプロイを開始します...")
    print(f"デプロイメント説明: {args.description}")
    print("")

    # 認証
    creds = get_credentials(
        credentials_path=args.credentials,
        token_path=args.token
    )
    service = build('script', 'v1', credentials=creds)

    # プロジェクトディレクトリ
    base_dir = args.projects_dir

    if not base_dir.exists():
        print(f"エラー: プロジェクトディレクトリが見つかりません: {base_dir}")
        return

    # デプロイ対象プロジェクト
    if args.all:
        target_projects = [d.name for d in base_dir.iterdir() if d.is_dir()]
    else:
        target_projects = FILEID_PROJECTS

    print(f"対象プロジェクト数: {len(target_projects)}")
    print("対象プロジェクト:")
    for project in target_projects:
        print(f"  - {project}")
    print("")

    # 全プロジェクトを処理
    success_count = 0
    fail_count = 0
    results = []

    for project_name in target_projects:
        project_dir = base_dir / project_name

        if not project_dir.exists():
            print(f"\nスキップ: {project_name} (ディレクトリが存在しません)")
            continue

        print(f"\n処理中: {project_name}")

        # スクリプトIDを取得
        script_id = get_script_id_from_metadata(project_dir)

        if not script_id:
            print(f"  スキップ: スクリプトIDが見つかりません")
            fail_count += 1
            results.append({
                'project': project_name,
                'status': 'SKIP',
                'message': 'スクリプトIDが見つかりません'
            })
            continue

        print(f"  スクリプトID: {script_id}")

        # ファイルを読み込み
        files = read_project_files(project_dir)

        if not files:
            print(f"  スキップ: ファイルが見つかりません")
            fail_count += 1
            results.append({
                'project': project_name,
                'status': 'SKIP',
                'message': 'ファイルが見つかりません'
            })
            continue

        print(f"  ファイル数: {len(files)}")

        if args.verbose:
            print(f"  ファイル一覧:")
            for f in files:
                print(f"    - {f['name']} ({f['type']})")

        # プロジェクトを更新
        success, result = update_gas_project(service, script_id, files)

        if success:
            print(f"  ✓ 更新完了")

            # バージョンをデプロイ
            deploy_success = deploy_version(
                service,
                script_id,
                args.description
            )

            if deploy_success:
                print(f"  ✓ デプロイ完了")
                success_count += 1
                results.append({
                    'project': project_name,
                    'status': 'SUCCESS',
                    'message': '更新とデプロイが完了しました'
                })
            else:
                print(f"  ⚠ デプロイ失敗（更新は完了）")
                success_count += 1
                results.append({
                    'project': project_name,
                    'status': 'PARTIAL',
                    'message': '更新は完了しましたがデプロイに失敗しました'
                })
        else:
            print(f"  ✗ 更新失敗: {result}")
            fail_count += 1
            results.append({
                'project': project_name,
                'status': 'FAIL',
                'message': f'更新失敗: {result}'
            })

    # 結果サマリー
    print("\n" + "="*60)
    print("デプロイ結果サマリー")
    print("="*60)
    print(f"成功: {success_count}")
    print(f"失敗: {fail_count}")
    print(f"合計: {success_count + fail_count}")

    # 詳細結果を出力
    print("\n詳細結果:")
    for result in results:
        status_symbol = {
            'SUCCESS': '✓',
            'PARTIAL': '⚠',
            'FAIL': '✗',
            'SKIP': '-'
        }.get(result['status'], '?')

        print(f"  {status_symbol} {result['project']}: {result['message']}")

    # 結果をJSONファイルに保存
    result_file = Path(__file__).parent / 'fileid_deployment_results.json'
    with open(result_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n結果を {result_file} に保存しました")

if __name__ == '__main__':
    main()