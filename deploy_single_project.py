#!/usr/bin/env python3
"""
単一GASプロジェクトをデプロイするスクリプト
- 既存の書き込み可能なデプロイメントを更新
- Read-onlyデプロイメントは新規作成
"""
import os
import pickle
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCRIPT_ID = "1PK1RNjLaA7g-1-JrJ-AFn1S0D_nL5cGHNJeDtyhIap_otDnYsUAquSz6"
PROJECT_NAME = "Appsheet_通話_要約生成"

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

def get_deployments(service, script_id):
    """デプロイ一覧を取得"""
    try:
        response = service.projects().deployments().list(
            scriptId=script_id
        ).execute()
        return response.get('deployments', [])
    except HttpError as error:
        print(f"エラー: {error}")
        return []

def create_new_version(service, script_id, description):
    """新しいバージョンを作成"""
    try:
        response = service.projects().versions().create(
            scriptId=script_id,
            body={'description': description}
        ).execute()
        version_number = response.get('versionNumber')
        print(f"✓ 新しいバージョンを作成: {version_number}")
        return version_number
    except HttpError as error:
        print(f"エラー: {error}")
        return None

def update_deployment(service, script_id, deployment_id, version_number):
    """デプロイメントを更新（1つのバージョンで更新）"""
    try:
        response = service.projects().deployments().update(
            scriptId=script_id,
            deploymentId=deployment_id,
            body={
                'deploymentConfig': {
                    'scriptId': script_id,
                    'versionNumber': version_number,
                    'description': f'Updated to version {version_number}'
                }
            }
        ).execute()
        
        # 更新後のバージョン情報を確認
        updated_version = response.get('deploymentConfig', {}).get('versionNumber')
        print(f"✓ デプロイメント更新: {deployment_id[:50]}... → v{updated_version}")
        return True
    except HttpError as error:
        if "Read-only" in str(error):
            print(f"  ⊘ スキップ: Read-onlyデプロイメント")
            return False
        print(f"  ✗ エラー: {error}")
        return False

def create_new_deployment(service, script_id, version_number, description):
    """新しいデプロイメントを作成"""
    try:
        response = service.projects().deployments().create(
            scriptId=script_id,
            body={
                'versionNumber': version_number,
                'description': description
            }
        ).execute()
        
        deployment_id = response.get('deploymentId')
        entry_point = response.get('entryPoints', [{}])[0]
        web_app_url = entry_point.get('webApp', {}).get('url', 'N/A')
        
        print(f"✓ 新しいデプロイメント作成成功")
        print(f"  Deployment ID: {deployment_id}")
        print(f"  Web App URL: {web_app_url}")
        
        return deployment_id, web_app_url
    except HttpError as error:
        print(f"エラー: {error}")
        return None, None

def main():
    print(f"=== {PROJECT_NAME} のデプロイ ===\n")
    print(f"Script ID: {SCRIPT_ID}\n")
    
    service = get_script_service()
    
    # 1. 新しいバージョンを作成
    print("Step 1: 新しいバージョンを作成")
    version_number = create_new_version(
        service, 
        SCRIPT_ID, 
        "重複関数削除とコード最適化 (core_webhook削除)"
    )
    
    if not version_number:
        print("バージョン作成に失敗しました")
        return
    
    print()
    
    # 2. 既存のデプロイメントを取得
    print("Step 2: 既存のデプロイメントを確認")
    deployments = get_deployments(service, SCRIPT_ID)
    print(f"既存デプロイメント数: {len(deployments)}\n")
    
    # 3. 書き込み可能なデプロイメントを更新（1つのバージョンで全て更新）
    print("Step 3: デプロイメントを更新（一括）")
    print(f"   使用バージョン: v{version_number}\n")
    
    updated_count = 0
    skipped_count = 0
    
    for i, dep in enumerate(deployments, 1):
        dep_id = dep.get('deploymentId')
        config = dep.get('deploymentConfig', {})
        current_version = config.get('versionNumber', 'N/A')
        
        # @HEADデプロイメントはスキップ
        if dep_id == 'AKfycbx4cdha7ofILNwasxkVnPV9FcvjuyYOSM0NEEkgnc0o':
            print(f"  [{i}/{len(deployments)}] ⊘ @HEAD デプロイメント（自動更新）")
            skipped_count += 1
            continue
        
        print(f"  [{i}/{len(deployments)}] 更新中: {dep_id[:50]}... (v{current_version} → v{version_number})")
        if update_deployment(service, SCRIPT_ID, dep_id, version_number):
            updated_count += 1
        else:
            skipped_count += 1
    
    print(f"\n📊 結果: {updated_count}件更新, {skipped_count}件スキップ (合計{len(deployments)}件)")
    print(f"✅ 全てのデプロイメントが バージョン {version_number} に統一されました")
    
    # 4. 新しいデプロイメントを作成するか確認
    if updated_count == 0:
        print("\nStep 4: 新しいデプロイメントを作成")
        deployment_id, web_url = create_new_deployment(
            service,
            SCRIPT_ID,
            version_number,
            "Optimized deployment - v" + str(version_number)
        )
        
        if deployment_id:
            print("\n" + "="*60)
            print("新しいWebhook URL:")
            print(web_url)
            print("="*60)
            print("\n⚠️ AppSheetのWebhook URLを上記URLに更新してください")
    
    print("\n✅ デプロイ完了")

if __name__ == "__main__":
    main()
