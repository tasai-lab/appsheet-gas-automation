#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全てのAppSheet GASプロジェクトを一括デプロイするスクリプト

Usage:
    python deploy_all_to_gas.py [--projects-dir DIR] [--description DESC] [--filter PATTERN]
"""
import os
import sys
import json
import pickle
import argparse
from pathlib import Path
from datetime import datetime
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
        
        version_number = version.get('versionNumber')
        print(f"  バージョン {version_number} を作成しました")
        
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
                        'versionNumber': version_number,
                        'description': description
                    }
                }
                
                service.projects().deployments().update(
                    scriptId=script_id,
                    deploymentId=deployment_id,
                    body=update_body
                ).execute()
                
                print(f"  デプロイメント {deployment_id} を更新しました")
        
        return True, version_number
    
    except Exception as e:
        print(f"  デプロイエラー: {e}")
        return False, None

def load_version_history(version_file):
    """バージョン履歴を読み込み"""
    if version_file.exists():
        with open(version_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        'last_updated': None,
        'projects': {}
    }

def save_version_history(version_file, history):
    """バージョン履歴を保存"""
    history['last_updated'] = datetime.now().isoformat()
    with open(version_file, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

def update_project_version(history, project_name, script_id, version_number, description, success):
    """プロジェクトのバージョン情報を更新"""
    if project_name not in history['projects']:
        history['projects'][project_name] = {
            'script_id': script_id,
            'deployments': []
        }
    
    deployment_info = {
        'version': version_number,
        'description': description,
        'timestamp': datetime.now().isoformat(),
        'status': 'success' if success else 'failed'
    }
    
    history['projects'][project_name]['script_id'] = script_id
    history['projects'][project_name]['deployments'].insert(0, deployment_info)
    
    # 最新10件のみ保持
    history['projects'][project_name]['deployments'] = \
        history['projects'][project_name]['deployments'][:10]

def parse_arguments():
    """引数をパース"""
    parser = argparse.ArgumentParser(
        description='全てのAppSheet GASプロジェクトを一括デプロイ',
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
        default='Updated: Gemini API最適化とログ改善',
        help='デプロイメントの説明 (デフォルト: Updated: Gemini API最適化とログ改善)'
    )

    parser.add_argument(
        '--filter',
        help='プロジェクト名フィルター (例: Appsheet_通話)'
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

    return parser.parse_args()


def main():
    """メイン処理"""
    args = parse_arguments()

    print("全AppSheet GASプロジェクトのデプロイを開始します...")

    if args.verbose:
        print(f"プロジェクトディレクトリ: {args.projects_dir}")
        print(f"デプロイメント説明: {args.description}")
        if args.filter:
            print(f"フィルター: {args.filter}")

    # 認証
    creds = get_credentials(
        credentials_path=args.credentials if hasattr(args, 'credentials') else None,
        token_path=args.token if hasattr(args, 'token') else None
    )
    service = build('script', 'v1', credentials=creds)

    # プロジェクトディレクトリ
    base_dir = args.projects_dir

    if not base_dir.exists():
        print(f"エラー: プロジェクトディレクトリが見つかりません: {base_dir}")
        return

    # バージョン履歴を読み込み
    version_file = Path(__file__).parent.parent / 'deployment_versions.json'
    version_history = load_version_history(version_file)

    # 全プロジェクトを処理
    success_count = 0
    fail_count = 0
    results = []

    for project_dir in sorted(base_dir.glob('*')):
        if not project_dir.is_dir():
            continue

        project_name = project_dir.name

        # フィルター適用
        if args.filter and args.filter not in project_name:
            if args.verbose:
                print(f"\nスキップ: {project_name} (フィルター条件に不一致)")
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
        
        # appsscript.jsonが含まれているか確認
        has_manifest = any(f['name'] == 'appsscript.json' for f in files)
        if not has_manifest:
            print(f"  警告: appsscript.jsonが見つかりません")
            print(f"  ファイル一覧: {[f['name'] for f in files]}")
        
        # プロジェクトを更新
        success, result = update_gas_project(service, script_id, files)
        
        if success:
            print(f"  ✓ 更新完了")
            
            # バージョンをデプロイ
            deploy_success, version_number = deploy_version(
                service,
                script_id,
                args.description
            )
            
            # バージョン履歴を更新
            update_project_version(
                version_history,
                project_name,
                script_id,
                version_number,
                args.description,
                deploy_success
            )
            
            if deploy_success:
                print(f"  ✓ デプロイ完了")
                success_count += 1
                results.append({
                    'project': project_name,
                    'status': 'SUCCESS',
                    'message': '更新とデプロイが完了しました',
                    'version': version_number
                })
            else:
                print(f"  ⚠ デプロイ失敗（更新は完了）")
                success_count += 1
                results.append({
                    'project': project_name,
                    'status': 'PARTIAL',
                    'version': version_number,
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
    
    # バージョン履歴を保存
    save_version_history(version_file, version_history)
    print(f"\nバージョン履歴を保存しました: {version_file}")

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
    result_file = Path(__file__).parent / 'deployment_results.json'
    with open(result_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n結果を {result_file} に保存しました")

if __name__ == '__main__':
    main()
