"""
GASプロジェクトのデプロイバージョンを更新するスクリプト

このスクリプトは以下を実行します:
1. 指定されたGASプロジェクトの現在のデプロイを取得
2. 新しいバージョンを作成
3. 既存のデプロイを新しいバージョンに更新
"""

import os
import pickle
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import argparse


def get_credentials():
    """認証情報を取得"""
    token_path = 'token.pickle'
    
    if not os.path.exists(token_path):
        raise FileNotFoundError(f"認証情報ファイル {token_path} が見つかりません")
    
    with open(token_path, 'rb') as token:
        creds = pickle.load(token)
    
    return creds


def get_script_service():
    """Apps Script APIサービスを取得"""
    creds = get_credentials()
    return build('script', 'v1', credentials=creds)


def get_project_deployments(service, script_id):
    """プロジェクトのデプロイ一覧を取得"""
    try:
        response = service.projects().deployments().list(
            scriptId=script_id
        ).execute()
        
        deployments = response.get('deployments', [])
        return deployments
    except HttpError as error:
        print(f"エラー: デプロイ一覧の取得に失敗しました: {error}")
        return []


def create_new_version(service, script_id, description="Updated version"):
    """新しいバージョンを作成"""
    try:
        response = service.projects().versions().create(
            scriptId=script_id,
            body={'description': description}
        ).execute()
        
        version_number = response.get('versionNumber')
        print(f"新しいバージョンを作成しました: {version_number}")
        return version_number
    except HttpError as error:
        print(f"エラー: バージョンの作成に失敗しました: {error}")
        return None


def update_deployment(service, script_id, deployment_id, version_number):
    """既存のデプロイを更新"""
    try:
        response = service.projects().deployments().update(
            scriptId=script_id,
            deploymentId=deployment_id,
            body={
                'deploymentConfig': {
                    'scriptId': script_id,
                    'versionNumber': version_number
                }
            }
        ).execute()
        
        print(f"デプロイを更新しました: {deployment_id}")
        return response
    except HttpError as error:
        print(f"エラー: デプロイの更新に失敗しました: {error}")
        return None


def update_all_deployments_to_new_version(script_id, description="Updated version"):
    """すべてのデプロイを新しいバージョンに更新"""
    service = get_script_service()
    
    # 現在のデプロイを取得
    deployments = get_project_deployments(service, script_id)
    
    if not deployments:
        print("デプロイが見つかりませんでした")
        return
    
    print(f"\n現在のデプロイ数: {len(deployments)}")
    for dep in deployments:
        print(f"  - ID: {dep['deploymentId']}, Config: {dep.get('deploymentConfig', {})}")
    
    # 新しいバージョンを作成
    version_number = create_new_version(service, script_id, description)
    
    if not version_number:
        print("バージョンの作成に失敗しました")
        return
    
    # 各デプロイを新しいバージョンに更新
    print(f"\nバージョン {version_number} にデプロイを更新中...")
    for deployment in deployments:
        deployment_id = deployment['deploymentId']
        
        # @HEADデプロイはスキップ（これは常に最新のコードを使用）
        if deployment_id == 'AKfycbwHdOF3uAo-4M5Jb8mQ2rL3pN6sT9xW0yZ1vU2aB4cD5eF7gH8iJ9kL0mN1oP2qR3sT4u':
            continue
        
        update_deployment(service, script_id, deployment_id, version_number)
    
    print(f"\n完了: すべてのデプロイをバージョン {version_number} に更新しました")


def main():
    parser = argparse.ArgumentParser(description='GASプロジェクトのデプロイバージョンを更新')
    parser.add_argument('script_id', help='GASプロジェクトのスクリプトID')
    parser.add_argument('--description', default='Updated version', help='バージョンの説明')
    parser.add_argument('--project-name', help='プロジェクト名（gas_projectsフォルダー内）')
    
    args = parser.parse_args()
    
    if args.project_name:
        # プロジェクト名からスクリプトIDを取得
        project_dir = os.path.join('gas_projects', args.project_name)
        appsscript_path = os.path.join(project_dir, 'appsscript.json')
        
        if os.path.exists(appsscript_path):
            import json
            with open(appsscript_path, 'r', encoding='utf-8') as f:
                appsscript_data = json.load(f)
                script_id = appsscript_data.get('scriptId')
                if script_id:
                    print(f"プロジェクト '{args.project_name}' のスクリプトID: {script_id}")
                    update_all_deployments_to_new_version(script_id, args.description)
                else:
                    print(f"エラー: appsscript.jsonにscriptIdが見つかりません")
        else:
            print(f"エラー: {appsscript_path} が見つかりません")
    else:
        update_all_deployments_to_new_version(args.script_id, args.description)


if __name__ == '__main__':
    main()
