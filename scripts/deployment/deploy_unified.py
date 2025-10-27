#!/usr/bin/env python3
"""
GASプロジェクトデプロイ統合スクリプト
- 1つのバージョンで複数デプロイメントを一括更新
- clasp経由でシンプルに実行
- Read-onlyデプロイメントは自動スキップ

使用方法:
    python deploy_unified.py <project_folder> <version_description>
    
例:
    python deploy_unified.py Appsheet_通話_要約生成 "v95: API統合最適化"
"""
import sys
import subprocess
import re
from pathlib import Path

def run_command(cmd, cwd=None):
    """コマンドを実行して結果を返す"""
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=cwd,
        shell=True,
        encoding='utf-8',
        errors='replace'
    )
    return result

def create_version(project_path, description):
    """新しいバージョンを作成"""
    print(f"📦 バージョン作成中: {description}")
    
    result = run_command(
        f'clasp version "{description}"',
        cwd=project_path
    )
    
    if result.returncode != 0:
        print(f"❌ バージョン作成エラー:\n{result.stderr}")
        return None
    
    # バージョン番号を抽出
    output = result.stdout.strip()
    match = re.search(r'Created version (\d+)', output)
    
    if match:
        version_number = match.group(1)
        print(f"✅ バージョン {version_number} 作成完了\n")
        return version_number
    else:
        print(f"⚠️ バージョン番号を抽出できませんでした: {output}")
        return None

def get_deployments(project_path):
    """デプロイメント一覧を取得"""
    print("📋 既存デプロイメント取得中...")
    
    result = run_command('clasp deployments', cwd=project_path)
    
    if result.returncode != 0:
        print(f"❌ デプロイメント取得エラー:\n{result.stderr}")
        return []
    
    deployments = []
    lines = result.stdout.split('\n')
    
    for line in lines:
        # デプロイメントIDを抽出（AKfycで始まる）
        if 'AKfyc' in line:
            parts = line.split()
            for part in parts:
                if part.startswith('AKfyc'):
                    # @HEADを除外
                    if '@HEAD' not in line:
                        deployments.append(part)
                    break
    
    print(f"✓ {len(deployments)}件のデプロイメント発見\n")
    return deployments

def update_deployment(deployment_id, description, project_path):
    """デプロイメントを更新"""
    result = run_command(
        f'clasp deploy -i {deployment_id} -d "{description}"',
        cwd=project_path
    )
    
    if result.returncode != 0:
        error_msg = result.stderr
        if "read-only" in error_msg.lower():
            return "readonly"
        return "error"
    
    # 更新されたバージョンを抽出
    output = result.stdout.strip()
    match = re.search(r'@(\d+)', output)
    if match:
        return match.group(1)
    return "success"

def main():
    if len(sys.argv) < 3:
        print("使用方法: python deploy_unified.py <project_folder> <version_description>")
        print('例: python deploy_unified.py Appsheet_通話_要約生成 "v95: API統合最適化"')
        sys.exit(1)
    
    project_folder = sys.argv[1]
    version_description = sys.argv[2]
    
    # プロジェクトパスを構築
    project_path = Path('gas_projects') / project_folder
    
    if not project_path.exists():
        print(f"❌ プロジェクトが見つかりません: {project_path}")
        sys.exit(1)
    
    print(f"\n{'='*70}")
    print(f"  GASデプロイ統合スクリプト")
    print(f"{'='*70}\n")
    print(f"プロジェクト: {project_folder}")
    print(f"説明: {version_description}\n")
    
    # 1. バージョン作成
    version_number = create_version(project_path, version_description)
    if not version_number:
        sys.exit(1)
    
    # 2. デプロイメント取得
    deployments = get_deployments(project_path)
    if not deployments:
        print("⚠️ 更新可能なデプロイメントがありません")
        sys.exit(0)
    
    # 3. 全デプロイメントを同じバージョンに更新
    print(f"🔄 デプロイメント更新中（バージョン {version_number} に統一）\n")
    
    updated_count = 0
    skipped_count = 0
    error_count = 0
    
    for i, dep_id in enumerate(deployments, 1):
        print(f"  [{i}/{len(deployments)}] {dep_id[:50]}...", end=" ")
        
        result = update_deployment(dep_id, f"v{version_number}", project_path)
        
        if result == "readonly":
            print("⊘ Read-only（スキップ）")
            skipped_count += 1
        elif result == "error":
            print("✗ エラー")
            error_count += 1
        else:
            print(f"✓ 更新完了 → @{result}")
            updated_count += 1
    
    # 4. 結果サマリー
    print(f"\n{'='*70}")
    print(f"📊 デプロイ結果サマリー")
    print(f"{'='*70}")
    print(f"  ✅ 更新成功: {updated_count}件")
    print(f"  ⊘ スキップ: {skipped_count}件")
    print(f"  ✗ エラー: {error_count}件")
    print(f"  📦 使用バージョン: v{version_number}")
    print(f"{'='*70}\n")
    
    if updated_count > 0:
        print(f"✨ 全てのデプロイメントがバージョン {version_number} に統一されました")
    else:
        print("⚠️ デプロイメントの更新がありませんでした")
    
    sys.exit(0 if error_count == 0 else 1)

if __name__ == "__main__":
    main()
