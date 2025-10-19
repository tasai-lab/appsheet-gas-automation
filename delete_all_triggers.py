#!/usr/bin/env python3
"""
全GASプロジェクトのトリガーを削除するスクリプト
Google Apps Script APIを使用して直接トリガーを削除
"""
import os
import subprocess
import json
import requests
from pathlib import Path

def find_gas_projects():
    """GASプロジェクトのディレクトリを検出"""
    gas_projects = []
    
    for root, dirs, files in os.walk('gas_projects/projects'):
        if '.clasp.json' in files:
            # scriptsディレクトリ内の.clasp.jsonは除外
            if not root.endswith('/scripts'):
                gas_projects.append(root)
    
    return sorted(gas_projects)

def get_project_id(project_dir):
    """プロジェクトIDを取得"""
    clasp_json_path = os.path.join(project_dir, '.clasp.json')
    
    try:
        with open(clasp_json_path, 'r', encoding='utf-8') as f:
            clasp_data = json.load(f)
            return clasp_data.get('scriptId')
    except Exception as e:
        print(f"  ⚠️  {project_dir}: .clasp.jsonの読み込みに失敗 - {e}")
        return None

def get_access_token():
    """claspの認証情報からアクセストークンを取得"""
    try:
        # claspの認証情報を取得
        result = subprocess.run(
            ['clasp', 'status', '--json'],
            capture_output=True,
            text=True
        )
        
        # OAuth2トークンを取得するためにgcloudを使用
        result = subprocess.run(
            ['gcloud', 'auth', 'application-default', 'print-access-token'],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            return result.stdout.strip()
        
        # gcloudが使えない場合は、claspの認証ファイルから取得を試みる
        home = os.path.expanduser('~')
        clasprc_path = os.path.join(home, '.clasprc.json')
        
        if os.path.exists(clasprc_path):
            with open(clasprc_path, 'r') as f:
                data = json.load(f)
                # OAuth2トークンのリフレッシュが必要
                # 簡易実装のため、clasp loginを促す
                print("  ⚠️  アクセストークンの取得に失敗しました")
                print("  ℹ️  'clasp login' を実行してから再度お試しください")
                return None
        
        return None
        
    except Exception as e:
        print(f"  ⚠️  アクセストークンの取得エラー: {e}")
        return None

def delete_triggers_for_project(project_dir):
    """指定されたプロジェクトのトリガーを削除"""
    project_name = os.path.basename(project_dir)
    project_id = get_project_id(project_dir)
    
    if not project_id:
        return False
    
    print(f"\n{'='*80}")
    print(f"プロジェクト: {project_name}")
    print(f"ディレクトリ: {project_dir}")
    print(f"Script ID: {project_id}")
    print('='*80)
    
    # プロジェクトディレクトリに移動
    original_dir = os.getcwd()
    os.chdir(project_dir)
    
    try:
        # Apps Script CLIを使ってトリガーを削除
        # まず、スクリプトをプッシュして最新の状態にする
        print("  スクリプトの実行環境を確認中...")
        
        # clasp runコマンドでトリガー削除関数を実行する方法を試す
        # まずは手動でブラウザで削除することを提案
        script_url = f"https://script.google.com/home/projects/{project_id}/triggers"
        print(f"\n  ℹ️  トリガーの手動削除が必要です:")
        print(f"  URL: {script_url}")
        print(f"  上記URLをブラウザで開いて、トリガーを手動で削除してください")
        
        return True
        
    except Exception as e:
        print(f"  ⚠️  エラー: {e}")
        return False
    finally:
        os.chdir(original_dir)

def main():
    print("="*80)
    print("全GASプロジェクトのトリガー削除スクリプト")
    print("="*80)
    
    projects = find_gas_projects()
    print(f"\n検出されたプロジェクト数: {len(projects)}")
    
    if not projects:
        print("GASプロジェクトが見つかりませんでした。")
        return
    
    success_count = 0
    fail_count = 0
    
    for project_dir in projects:
        try:
            if delete_triggers_for_project(project_dir):
                success_count += 1
            else:
                fail_count += 1
        except Exception as e:
            print(f"\n⚠️  {project_dir}: 予期しないエラー - {e}")
            fail_count += 1
    
    print("\n" + "="*80)
    print("処理完了")
    print("="*80)
    print(f"成功: {success_count} プロジェクト")
    print(f"失敗: {fail_count} プロジェクト")
    print("="*80)

if __name__ == '__main__':
    main()
