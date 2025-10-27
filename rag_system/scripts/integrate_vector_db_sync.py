#!/usr/bin/env python3
"""
Vector DB同期コード統合スクリプト

看護系5プロジェクトのWebhookハンドラーにVector DB同期コードを統合します。
"""

import os
import re
from pathlib import Path

# ベースディレクトリ
BASE_DIR = Path(__file__).parent.parent.parent
PROJECTS_BASE = BASE_DIR / "gas_projects" / "projects" / "nursing"

# 対象プロジェクトとそのメタデータ
TARGET_PROJECTS = {
    "Appsheet_訪問看護_書類仕分け": {
        "source_type": "document_sorting",
        "source_table": "Client_Documents",
        "main_file": "main.gs"
    },
    "Appsheet_訪問看護_計画書問題点": {
        "source_type": "care_plan_issues",
        "source_table": "Care_Plan_Issues",
        "main_file": "コード.gs"
    },
    "Appsheet_訪問看護_計画書問題点_評価": {
        "source_type": "care_plan_evaluation",
        "source_table": "Care_Plan_Evaluations",
        "main_file": "コード.gs"
    },
    "Appsheet_訪問看護_報告書": {
        "source_type": "visit_report",
        "source_table": "Visit_Reports",
        "main_file": "main.gs"
    },
    "Appsheet_訪問看護_定期スケジュール": {
        "source_type": "schedule",
        "source_table": "Visit_Schedules",
        "main_file": "main.gs"
    }
}

# Vector DB同期コードテンプレート
VECTOR_DB_SYNC_TEMPLATE = """
  // ============================================================
  // Vector DB同期（RAGシステムへのデータ蓄積）
  // ============================================================
  try {{
    log('Vector DB同期開始');

    // 同期データ準備
    const syncData = {{
      domain: 'nursing',
      sourceType: '{source_type}',
      sourceTable: '{source_table}',
      sourceId: {source_id_var},
      userId: {user_id_var} || 'unknown',
      title: {title_expression},
      content: {content_expression},
      structuredData: {structured_data_expression},
      metadata: {{
        driveFileId: {drive_file_id_var} || '',
        projectName: '{project_name}'
      }},
      tags: {tags_expression},
      date: new Date().toISOString().split('T')[0]
    }};

    // Vector DB同期実行
    syncToVectorDB(syncData);

    log('✅ Vector DB同期完了');

  }} catch (syncError) {{
    log(`⚠️  Vector DB同期エラー（処理は継続）: ${{syncError.toString()}}`);
    // Vector DB同期エラーはメイン処理に影響させない
  }}
"""


def find_insertion_point(content: str) -> int:
    """
    Vector DB同期コードの挿入位置を見つける

    Args:
        content: ソースコード全体

    Returns:
        挿入位置のインデックス（-1の場合は見つからない）
    """
    # パターン1: sendProcessLogEmail の直前
    pattern1 = r'sendProcessLogEmail\('
    match1 = list(re.finditer(pattern1, content))

    if match1:
        # 最後のsendProcessLogEmailの直前
        return match1[-1].start()

    # パターン2: return ContentService.createTextOutput の直前
    pattern2 = r'return\s+ContentService\.createTextOutput\('
    match2 = list(re.finditer(pattern2, content))

    if match2:
        # 最初のreturnの直前
        return match2[0].start()

    # パターン3: doPost関数の最後のcatchブロックの前
    pattern3 = r'\}\s*catch\s*\(.*?\)\s*\{'
    match3 = list(re.finditer(pattern3, content))

    if match3:
        # 最後のcatchブロックの直前
        return match3[-1].start()

    return -1


def extract_variables(content: str, project_name: str) -> dict:
    """
    ソースコードから必要な変数名を抽出

    Args:
        content: ソースコード全体
        project_name: プロジェクト名

    Returns:
        変数マッピング辞書
    """
    variables = {
        'source_id_var': 'documentId',
        'user_id_var': 'context.staffId',
        'title_expression': '`${context.documentType} - ${context.clientName}`',
        'content_expression': 'context.ocrText',
        'structured_data_expression': '{}',
        'drive_file_id_var': 'context.driveFileId',
        'tags_expression': 'context.documentType'
    }

    # プロジェクト固有のカスタマイズ
    if '計画書問題点' in project_name:
        variables['source_id_var'] = 'recordId'
        variables['content_expression'] = 'aiResponse.problems'

    elif '報告書' in project_name:
        variables['source_id_var'] = 'recordId'
        variables['content_expression'] = 'result.reportContent'

    elif 'スケジュール' in project_name:
        variables['source_id_var'] = 'scheduleId'
        variables['content_expression'] = 'scheduleData.description'

    return variables


def integrate_vector_db_sync(project_name: str, project_meta: dict, dry_run=False):
    """
    単一プロジェクトにVector DB同期コードを統合

    Args:
        project_name: プロジェクト名
        project_meta: プロジェクトメタデータ
        dry_run: Trueの場合、実際の書き込みは行わない

    Returns:
        統合成功の場合True
    """
    main_file = project_meta['main_file']
    file_path = PROJECTS_BASE / project_name / "scripts" / main_file

    if not file_path.exists():
        print(f"   ❌ {main_file} が見つかりません")
        return False

    # ソースコード読み込み
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 既に統合済みかチェック
    if 'Vector DB同期' in content or 'syncToVectorDB' in content:
        print(f"   ⚠️  既に統合済みです（スキップ）")
        return True

    # 挿入位置を見つける
    insertion_point = find_insertion_point(content)

    if insertion_point == -1:
        print(f"   ❌ 挿入位置が見つかりません")
        return False

    # 変数マッピングを抽出
    variables = extract_variables(content, project_name)

    # Vector DB同期コードを生成
    sync_code = VECTOR_DB_SYNC_TEMPLATE.format(
        source_type=project_meta['source_type'],
        source_table=project_meta['source_table'],
        source_id_var=variables['source_id_var'],
        user_id_var=variables['user_id_var'],
        title_expression=variables['title_expression'],
        content_expression=variables['content_expression'],
        structured_data_expression=variables['structured_data_expression'],
        drive_file_id_var=variables['drive_file_id_var'],
        tags_expression=variables['tags_expression'],
        project_name=project_name
    )

    # コードを挿入
    new_content = content[:insertion_point] + sync_code + "\n" + content[insertion_point:]

    if dry_run:
        print(f"   📝 統合予定（挿入位置: {insertion_point}）")
        return True

    # ファイルに書き込み
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"   ✅ Vector DB同期コード統合完了")
    return True


def main():
    """メイン処理"""
    import argparse

    parser = argparse.ArgumentParser(description="Vector DB同期コード統合スクリプト")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="実際の書き込みは行わず、確認のみ"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Vector DB同期コード統合スクリプト")
    print("=" * 60)
    print()

    if args.dry_run:
        print("🔍 DRY RUN モード（実際の書き込みは行いません）")
        print()

    success_count = 0
    total_count = len(TARGET_PROJECTS)

    for project_name, project_meta in TARGET_PROJECTS.items():
        print(f"📁 {project_name}")

        project_path = PROJECTS_BASE / project_name
        if not project_path.exists():
            print(f"   ⚠️  プロジェクトが見つかりません（スキップ）")
            continue

        if integrate_vector_db_sync(project_name, project_meta, dry_run=args.dry_run):
            success_count += 1

        print()

    print("=" * 60)

    if args.dry_run:
        print("✅ DRY RUN 完了")
    else:
        print("✅ 統合完了")

    print(f"   成功: {success_count}/{total_count} プロジェクト")
    print("=" * 60)

    if not args.dry_run and success_count > 0:
        print()
        print("次のステップ:")
        print("1. 各プロジェクトでgit diffを確認")
        print("2. vector_db_sync.gs の VECTOR_DB_CONFIG.spreadsheetId を設定")
        print("3. clasp push でデプロイ")

    return 0 if success_count == total_count else 1


if __name__ == "__main__":
    exit(main())
