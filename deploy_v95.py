import subprocess
import sys
import json

def deploy_version(script_id, project_name):
    """新しいバージョンを作成してデプロイメントを更新"""
    print(f"\n=== {project_name} デプロイ (v95 最適化版) ===\n")
    
    # 1. 新しいバージョンを作成
    print("📦 v95 バージョン作成中...")
    version_cmd = [
        "clasp", "version", 
        "v95: API統合最適化 (要約+全文+アクション+依頼情報を1回で取得、base64 inlineData使用)"
    ]
    result = subprocess.run(version_cmd, capture_output=True, text=True, 
                          cwd=f"gas_projects/{project_name}")
    
    if result.returncode != 0:
        print(f"❌ バージョン作成エラー:\n{result.stderr}")
        return False
    
    # バージョン番号を抽出
    version_output = result.stdout
    print(f"✓ {version_output.strip()}")
    
    # 2. 既存のデプロイメントを取得
    print("\n📋 既存デプロイメント取得中...")
    deployments_cmd = ["clasp", "deployments"]
    result = subprocess.run(deployments_cmd, capture_output=True, text=True,
                          cwd=f"gas_projects/{project_name}")
    
    if result.returncode != 0:
        print(f"❌ デプロイメント取得エラー:\n{result.stderr}")
        return False
    
    # デプロイメントIDを抽出（@HEADを除く）
    deployments = []
    for line in result.stdout.split('\n'):
        if '@' in line and '@HEAD' not in line:
            parts = line.split()
            if len(parts) >= 2:
                deploy_id = parts[1].strip()
                if deploy_id.startswith('AKfyc'):
                    deployments.append(deploy_id)
    
    print(f"✓ {len(deployments)}件のデプロイメント発見")
    
    # 3. 各デプロイメントを新バージョンに更新
    for i, deploy_id in enumerate(deployments, 1):
        print(f"\n🔄 デプロイメント {i}/{len(deployments)} 更新中...")
        print(f"   ID: {deploy_id}")
        
        update_cmd = [
            "clasp", "deploy",
            "-i", deploy_id,
            "-d", "v95: API統合最適化"
        ]
        
        result = subprocess.run(update_cmd, capture_output=True, text=True,
                              cwd=f"gas_projects/{project_name}")
        
        if result.returncode != 0:
            print(f"❌ 更新エラー:\n{result.stderr}")
            continue
        
        print(f"✓ デプロイメント更新: {deploy_id}")
    
    print(f"\n✅ デプロイ完了（{len(deployments)}件更新）")
    return True

if __name__ == "__main__":
    # 通話要約生成プロジェクト
    script_id = "1PK1RNjLaA7g-1-JrJ-AFn1S0D_nL5cGHNJeDtyhIap_otDnYsUAquSz6"
    project_name = "Appsheet_通話_要約生成"
    
    success = deploy_version(script_id, project_name)
    sys.exit(0 if success else 1)
