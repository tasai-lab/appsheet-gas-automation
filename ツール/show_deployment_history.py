#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
デプロイバージョン履歴を表示するスクリプト

Usage:
    python show_deployment_history.py [--project PROJECT_NAME] [--limit N]
"""
import json
import argparse
from pathlib import Path
from datetime import datetime

def load_version_history(version_file):
    """バージョン履歴を読み込み"""
    if not version_file.exists():
        print(f"エラー: バージョン履歴ファイルが見つかりません: {version_file}")
        return None
    
    with open(version_file, 'r', encoding='utf-8') as f:
        return json.load(f)

def format_timestamp(iso_timestamp):
    """ISO形式のタイムスタンプを読みやすい形式に変換"""
    if not iso_timestamp:
        return "N/A"
    try:
        dt = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
        return dt.strftime('%Y/%m/%d %H:%M:%S')
    except:
        return iso_timestamp

def show_all_projects(history, limit=5):
    """全プロジェクトのバージョン履歴を表示"""
    print("\n" + "="*80)
    print("全プロジェクトのデプロイ履歴")
    print("="*80)
    print(f"最終更新: {format_timestamp(history.get('last_updated'))}")
    print(f"プロジェクト数: {len(history.get('projects', {}))}")
    
    for project_name in sorted(history.get('projects', {}).keys()):
        project_info = history['projects'][project_name]
        deployments = project_info.get('deployments', [])
        
        print(f"\n{'='*80}")
        print(f"プロジェクト: {project_name}")
        print(f"スクリプトID: {project_info.get('script_id')}")
        print(f"デプロイ回数: {len(deployments)}")
        
        if deployments:
            latest = deployments[0]
            print(f"最新バージョン: {latest.get('version')}")
            print(f"最終デプロイ: {format_timestamp(latest.get('timestamp'))}")
            print(f"ステータス: {latest.get('status')}")
            
            print(f"\n最近のデプロイ履歴 (最新{min(limit, len(deployments))}件):")
            print(f"{'バージョン':<12} {'日時':<20} {'ステータス':<10} 説明")
            print("-" * 80)
            
            for deployment in deployments[:limit]:
                version = deployment.get('version') or 'N/A'
                timestamp = format_timestamp(deployment.get('timestamp'))
                status = deployment.get('status', 'unknown')
                description = deployment.get('description', '')
                
                status_symbol = '✓' if status == 'success' else '✗'
                print(f"{str(version):<12} {timestamp:<20} {status_symbol} {status:<9} {description[:40]}")

def show_project(history, project_name, limit=10):
    """特定プロジェクトのバージョン履歴を表示"""
    if project_name not in history.get('projects', {}):
        print(f"エラー: プロジェクト '{project_name}' が見つかりません")
        print(f"\n利用可能なプロジェクト:")
        for name in sorted(history.get('projects', {}).keys()):
            print(f"  - {name}")
        return
    
    project_info = history['projects'][project_name]
    deployments = project_info.get('deployments', [])
    
    print("\n" + "="*80)
    print(f"プロジェクト: {project_name}")
    print("="*80)
    print(f"スクリプトID: {project_info.get('script_id')}")
    print(f"総デプロイ回数: {len(deployments)}")
    
    if not deployments:
        print("\nデプロイ履歴がありません")
        return
    
    latest = deployments[0]
    print(f"\n最新バージョン: {latest.get('version')}")
    print(f"最終デプロイ: {format_timestamp(latest.get('timestamp'))}")
    print(f"ステータス: {latest.get('status')}")
    print(f"説明: {latest.get('description')}")
    
    print(f"\nデプロイ履歴 (最新{min(limit, len(deployments))}件):")
    print(f"{'No.':<5} {'バージョン':<12} {'日時':<20} {'ステータス':<10} 説明")
    print("-" * 80)
    
    for i, deployment in enumerate(deployments[:limit], 1):
        version = deployment.get('version') or 'N/A'
        timestamp = format_timestamp(deployment.get('timestamp'))
        status = deployment.get('status', 'unknown')
        description = deployment.get('description', '')
        
        status_symbol = '✓' if status == 'success' else '✗'
        print(f"{i:<5} {str(version):<12} {timestamp:<20} {status_symbol} {status:<9} {description}")

def main():
    """メイン処理"""
    parser = argparse.ArgumentParser(
        description='デプロイバージョン履歴を表示',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        '--project', '-p',
        help='特定プロジェクトの履歴を表示'
    )
    
    parser.add_argument(
        '--limit', '-l',
        type=int,
        default=5,
        help='表示する履歴の件数 (デフォルト: 5)'
    )
    
    parser.add_argument(
        '--file', '-f',
        type=Path,
        default=Path(__file__).parent.parent / 'deployment_versions.json',
        help='バージョン履歴ファイル (デフォルト: deployment_versions.json)'
    )
    
    args = parser.parse_args()
    
    # バージョン履歴を読み込み
    history = load_version_history(args.file)
    if not history:
        return
    
    # 表示
    if args.project:
        show_project(history, args.project, args.limit)
    else:
        show_all_projects(history, args.limit)

if __name__ == '__main__':
    main()
