"""
全GASプロジェクトのデプロイバージョンを一括更新
"""
import os
import json
import pickle
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

def get_credentials():
    """認証情報を取得"""
    with open('token.pickle', 'rb') as token:
        return pickle.load(token)

def update_deployments():
    """全プロジェクトのデプロイを更新"""
    creds = get_credentials()
    service = build('script', 'v1', credentials=creds)
    
    # deployment_results.jsonから情報を取得
    if not os.path.exists('deployment_results.json'):
        print("deployment_results.json が見つかりません")
        return
    
    with open('deployment_results.json', 'r', encoding='utf-8') as f:
        results = json.load(f)
    
    print("=" * 60)
    print("デプロイバージョン一括更新")
    print("=" * 60)
    
    updated_count = 0
    failed_count = 0
    
    for project_name, info in results.items():
        if not info.get('success') or not info.get('script_id'):
            continue
        
        script_id = info['script_id']
        
        try:
            # 現在のデプロイを取得
            deployments_response = service.projects().deployments().list(
                scriptId=script_id
            ).execute()
            
            deployments = deployments_response.get('deployments', [])
            
            # HEAD以外のデプロイを探す（Webアプリデプロイ）
            web_deployment = None
            for deployment in deployments:
                if deployment.get('deploymentConfig', {}).get('manifestFileName'):
                    # HEADデプロイはスキップ
                    continue
                if deployment.get('deploymentConfig', {}).get('description') != '@HEAD':
                    web_deployment = deployment
                    break
            
            if not web_deployment:
                print(f"- {project_name}: Web デプロイが見つかりません")
                continue
            
            deployment_id = web_deployment['deploymentId']
            
            # 新しいバージョンを作成
            version_response = service.projects().versions().create(
                scriptId=script_id,
                body={}
            ).execute()
            
            new_version_number = version_response['versionNumber']
            
            # デプロイを更新
            update_body = {
                'deploymentConfig': {
                    'scriptId': script_id,
                    'versionNumber': new_version_number,
                    'manifestFileName': 'appsscript',
                    'description': f'Version {new_version_number} - Updated deployment'
                }
            }
            
            update_response = service.projects().deployments().update(
                scriptId=script_id,
                deploymentId=deployment_id,
                body=update_body
            ).execute()
            
            print(f"✓ {project_name}: バージョン {new_version_number} にデプロイ更新完了")
            updated_count += 1
            
        except HttpError as error:
            error_message = str(error)
            if 'Read-only deployments may not be modified' in error_message:
                # @HEADデプロイの場合は新規デプロイを作成
                try:
                    # 新しいバージョンを作成
                    version_response = service.projects().versions().create(
                        scriptId=script_id,
                        body={'description': 'Auto-update version'}
                    ).execute()
                    
                    new_version_number = version_response['versionNumber']
                    
                    # 新規Webアプリデプロイを作成
                    deploy_body = {
                        'versionNumber': new_version_number,
                        'manifestFileName': 'appsscript',
                        'description': f'Version {new_version_number}'
                    }
                    
                    deploy_response = service.projects().deployments().create(
                        scriptId=script_id,
                        body={'deploymentConfig': deploy_body}
                    ).execute()
                    
                    print(f"✓ {project_name}: 新規デプロイ作成 (バージョン {new_version_number})")
                    updated_count += 1
                    
                except HttpError as e2:
                    print(f"✗ {project_name}: デプロイ作成失敗 - {e2}")
                    failed_count += 1
            else:
                print(f"✗ {project_name}: エラー - {error}")
                failed_count += 1
        
        except Exception as e:
            print(f"✗ {project_name}: 予期しないエラー - {e}")
            failed_count += 1
    
    print("=" * 60)
    print(f"更新完了: {updated_count}, 失敗: {failed_count}")
    print("=" * 60)

if __name__ == '__main__':
    update_deployments()
