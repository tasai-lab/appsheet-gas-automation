#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
claspを使用して全てのAppSheet GASプロジェクトを一括デプロイするスクリプト
"""
import os
import subprocess
import json
from pathlib import Path

def run_command(cmd, cwd=None):
    """コマンドを実行"""
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            shell=True
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)

def push_project(project_dir):
    """プロジェクトをGASにプッシュ"""
    scripts_dir = project_dir / 'scripts'
    
    # scriptsディレクトリが存在しない場合はプロジェクトディレクトリを使用
    if not scripts_dir.exists():
        scripts_dir = project_dir
    
    # .clasp.jsonの存在確認
    clasp_json_path = project_dir / '.clasp.json'
    if not clasp_json_path.exists():
        return False, ".clasp.jsonが見つかりません"
    
    # .clasp.jsonをscriptsディレクトリにコピー
    import shutil
    target_clasp = scripts_dir / '.clasp.json'
    if not target_clasp.exists():
        shutil.copy(clasp_json_path, target_clasp)
    
    # clasp pushを実行
    success, stdout, stderr = run_command('clasp push -f', cwd=str(scripts_dir))
    
    if not success:
        return False, f"clasp push失敗: {stderr}"
    
    return True, stdout

def create_deployment(project_dir, description):
    """新しいバージョンをデプロイ"""
    scripts_dir = project_dir / 'scripts'
    
    if not scripts_dir.exists():
        scripts_dir = project_dir
    
    # clasp deployを実行
    success, stdout, stderr = run_command(
        f'clasp deploy -d "{description}"',
        cwd=str(scripts_dir)
    )
    
    if not success:
        # エラーが発生しても、既存のデプロイがある場合は成功とみなす
        if '既に' in stderr or 'already' in stderr.lower():
            return True, "既存のデプロイが存在"
        return False, f"clasp deploy失敗: {stderr}"
    
    return True, stdout

def main():
    """メイン処理"""
    print("全AppSheet GASプロジェクトのデプロイを開始します...\n")
    
    # プロジェクトディレクトリ
    base_dir = Path(__file__).parent / 'gas_projects'
    
    # 全プロジェクトを処理
    success_count = 0
    fail_count = 0
    skip_count = 0
    results = []
    
    for project_dir in sorted(base_dir.glob('*')):
        if not project_dir.is_dir():
            continue
        
        project_name = project_dir.name
        print(f"処理中: {project_name}")
        
        # .clasp.jsonの確認
        clasp_json = project_dir / '.clasp.json'
        if not clasp_json.exists():
            print(f"  スキップ: .clasp.jsonが見つかりません\n")
            skip_count += 1
            results.append({
                'project': project_name,
                'status': 'SKIP',
                'message': '.clasp.jsonが見つかりません'
            })
            continue
        
        # スクリプトIDを取得
        with open(clasp_json, 'r', encoding='utf-8') as f:
            clasp_data = json.load(f)
            script_id = clasp_data.get('scriptId')
        
        if not script_id:
            print(f"  スキップ: スクリプトIDが見つかりません\n")
            skip_count += 1
            results.append({
                'project': project_name,
                'status': 'SKIP',
                'message': 'スクリプトIDが見つかりません'
            })
            continue
        
        print(f"  スクリプトID: {script_id}")
        
        # プロジェクトをプッシュ
        success, message = push_project(project_dir)
        
        if not success:
            print(f"  失敗: {message}\n")
            fail_count += 1
            results.append({
                'project': project_name,
                'status': 'FAIL',
                'message': message,
                'script_id': script_id
            })
            continue
        
        print(f"  OK プッシュ完了")
        
        # デプロイを作成（オプション）
        deploy_success, deploy_message = create_deployment(
            project_dir,
            'Updated: Gemini API最適化とログ改善'
        )
        
        if deploy_success:
            print(f"  OK デプロイ完了\n")
            success_count += 1
            results.append({
                'project': project_name,
                'status': 'SUCCESS',
                'message': 'プッシュとデプロイが完了しました',
                'script_id': script_id
            })
        else:
            print(f"  警告: デプロイ失敗（プッシュは完了）\n")
            success_count += 1
            results.append({
                'project': project_name,
                'status': 'PARTIAL',
                'message': f'プッシュは完了、デプロイ: {deploy_message}',
                'script_id': script_id
            })
    
    # 結果サマリー
    print("\n" + "="*60)
    print("デプロイ結果サマリー")
    print("="*60)
    print(f"成功: {success_count}")
    print(f"失敗: {fail_count}")
    print(f"スキップ: {skip_count}")
    print(f"合計: {success_count + fail_count + skip_count}")
    
    # 詳細結果を出力
    print("\n詳細結果:")
    for result in results:
        status_mark = {
            'SUCCESS': 'OK',
            'PARTIAL': 'WARN',
            'FAIL': 'ERR',
            'SKIP': 'SKIP'
        }.get(result['status'], '?')
        
        print(f"  [{status_mark}] {result['project']}")
        print(f"       {result['message']}")
        if 'script_id' in result:
            print(f"       ID: {result['script_id']}")
    
    # 結果をJSONファイルに保存
    result_file = Path(__file__).parent / 'deployment_results.json'
    with open(result_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\n結果を {result_file} に保存しました")
    
    return success_count > 0

if __name__ == '__main__':
    import sys
    sys.exit(0 if main() else 1)
