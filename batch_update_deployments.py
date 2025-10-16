"""
すべてのGASプロジェクトのデプロイバージョンを一括更新するスクリプト
"""

import os
import json
import pickle
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


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


def get_script_id_from_project(project_dir):
    """プロジェクトディレクトリからスクリプトIDを取得"""
    clasp_json_path = os.path.join(project_dir, '.clasp.json')
    
    if os.path.exists(clasp_json_path):
        with open(clasp_json_path, 'r', encoding='utf-8') as f:
            clasp_data = json.load(f)
            return clasp_data.get('scriptId')
    
    return None


def create_new_version(service, script_id, description):
    """新しいバージョンを作成"""
    try:
        response = service.projects().versions().create(
            scriptId=script_id,
            body={'description': description}
        ).execute()
        
        version_number = response.get('versionNumber')
        return version_number
    except HttpError as error:
        print(f"  エラー: バージョンの作成に失敗: {error}")
        return None


def get_deployments(service, script_id):
    """デプロイ一覧を取得"""
    try:
        response = service.projects().deployments().list(
            scriptId=script_id
        ).execute()
        
        return response.get('deployments', [])
    except HttpError as error:
        print(f"  エラー: デプロイ一覧の取得に失敗: {error}")
        return []


def update_deployment(service, script_id, deployment_id, version_number):
    """デプロイを更新"""
    try:
        service.projects().deployments().update(
            scriptId=script_id,
            deploymentId=deployment_id,
            body={
                'deploymentConfig': {
                    'scriptId': script_id,
                    'versionNumber': version_number
                }
            }
        ).execute()
        return True
    except HttpError as error:
        print(f"  エラー: デプロイの更新に失敗: {error}")
        return False


def update_project_deployments(project_name, script_id):
    """プロジェクトのデプロイを更新"""
    print(f"\n{'='*60}")
    print(f"プロジェクト: {project_name}")
    print(f"スクリプトID: {script_id}")
    
    service = get_script_service()
    
    # デプロイを取得
    deployments = get_deployments(service, script_id)
    
    if not deployments:
        print("  デプロイが見つかりません")
        return False
    
    # @HEADデプロイを除外
    non_head_deployments = [d for d in deployments if '@HEAD' not in d.get('deploymentConfig', {}).get('description', '')]
    
    if not non_head_deployments:
        print("  更新可能なデプロイがありません（@HEADのみ）")
        return False
    
    print(f"  デプロイ数: {len(non_head_deployments)}")
    
    # 新しいバージョンを作成
    version_number = create_new_version(service, script_id, f"Batch update - {project_name}")
    
    if not version_number:
        return False
    
    print(f"  新しいバージョン: {version_number}")
    
    # 各デプロイを更新
    success_count = 0
    for deployment in non_head_deployments:
        deployment_id = deployment['deploymentId']
        if update_deployment(service, script_id, deployment_id, version_number):
            success_count += 1
    
    print(f"  更新成功: {success_count}/{len(non_head_deployments)}")
    return True


def main():
    """すべてのプロジェクトのデプロイを一括更新"""
    gas_projects_dir = 'gas_projects'
    
    if not os.path.exists(gas_projects_dir):
        print(f"エラー: {gas_projects_dir} ディレクトリが見つかりません")
        return
    
    # すべてのプロジェクトを取得
    projects = [d for d in os.listdir(gas_projects_dir) 
                if os.path.isdir(os.path.join(gas_projects_dir, d))]
    
    print(f"GASプロジェクト数: {len(projects)}")
    print("="*60)
    
    success_count = 0
    failed_projects = []
    
    for project_name in sorted(projects):
        project_dir = os.path.join(gas_projects_dir, project_name)
        script_id = get_script_id_from_project(project_dir)
        
        if not script_id:
            print(f"\n{project_name}: スクリプトIDが見つかりません（スキップ）")
            failed_projects.append(project_name)
            continue
        
        try:
            if update_project_deployments(project_name, script_id):
                success_count += 1
        except Exception as e:
            print(f"  エラー: {e}")
            failed_projects.append(project_name)
    
    # サマリー
    print(f"\n{'='*60}")
    print(f"完了サマリー:")
    print(f"  成功: {success_count}/{len(projects)}")
    
    if failed_projects:
        print(f"\n失敗したプロジェクト:")
        for project in failed_projects:
            print(f"  - {project}")


if __name__ == '__main__':
    main()
