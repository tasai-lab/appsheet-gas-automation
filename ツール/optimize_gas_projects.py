#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GASプロジェクトの最適化ツール

重複コードを共通モジュールに置き換えて最適化
"""
import os
import sys
import re
import json
from pathlib import Path
from collections import defaultdict
import shutil

# Windowsのコンソール文字コード問題を回避
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

class GASProjectOptimizer:
    """GASプロジェクト最適化クラス"""

    def __init__(self, base_dir):
        self.base_dir = Path(base_dir)
        self.common_modules_dir = self.base_dir / '共通モジュール'
        self.optimized_count = 0
        self.errors = []

    def optimize_all_projects(self):
        """全プロジェクトを最適化"""
        projects = [d for d in self.base_dir.iterdir()
                   if d.is_dir() and not d.name.startswith('.')
                   and d.name != '共通モジュール']

        print(f"最適化対象プロジェクト数: {len(projects)}")
        print("=" * 60)

        # 共通モジュールをコピー
        self.copy_common_modules_to_projects(projects)

        # 各プロジェクトの最適化
        for project in sorted(projects):
            print(f"\n最適化中: {project.name}")
            self.optimize_project(project)

        # 結果サマリー
        self.print_summary()

    def copy_common_modules_to_projects(self, projects):
        """共通モジュールを各プロジェクトにコピー"""
        common_files = list(self.common_modules_dir.glob('*.gs'))

        if not common_files:
            print("警告: 共通モジュールが見つかりません")
            return

        print(f"\n共通モジュールをコピー中...")
        print(f"モジュール数: {len(common_files)}")

        for project in projects:
            scripts_dir = project / 'scripts'
            if not scripts_dir.exists():
                scripts_dir = project

            # 既存の共通モジュールがある場合は削除
            for common_file in common_files:
                target_path = scripts_dir / common_file.name
                if target_path.exists():
                    target_path.unlink()

    def optimize_project(self, project_path):
        """個別プロジェクトを最適化"""
        scripts_dir = project_path / 'scripts'
        if not scripts_dir.exists():
            scripts_dir = project_path

        gs_files = list(scripts_dir.glob('*.gs'))
        if not gs_files:
            return

        for file_path in gs_files:
            # 共通モジュールファイルはスキップ
            if file_path.name in ['ExecutionLogger.gs', 'DuplicationPrevention.gs',
                                  'FileIdUtilities.gs', 'CommonWebhook.gs',
                                  'AppSheetConnector.gs', 'ErrorHandler.gs',
                                  'ValidationUtils.gs']:
                continue

            try:
                self.optimize_file(file_path, project_path.name)
            except Exception as e:
                self.errors.append({
                    'project': project_path.name,
                    'file': file_path.name,
                    'error': str(e)
                })
                print(f"  エラー: {file_path.name} - {e}")

    def optimize_file(self, file_path, project_name):
        """ファイルを最適化"""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # 重複モジュールを削除
        content = self.remove_duplicate_modules(content)

        # doPost関数を最適化
        content = self.optimize_dopost_function(content, project_name)

        # testProcessRequest関数を最適化
        content = self.optimize_test_function(content, project_name)

        # エラーハンドリングを統一
        content = self.unify_error_handling(content)

        # 変更があった場合のみ保存
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            self.optimized_count += 1
            print(f"  ✓ 最適化: {file_path.name}")

    def remove_duplicate_modules(self, content):
        """重複モジュールを削除"""
        # ExecutionLoggerモジュールを削除
        pattern = r'(?:\/\*\*[\s\S]*?\*\/\s*)?const\s+ExecutionLogger\s*=\s*\{[\s\S]*?\n\};'
        content = re.sub(pattern, '', content)

        # DuplicationPreventionモジュールを削除
        pattern = r'(?:\/\*\*[\s\S]*?\*\/\s*)?const\s+DuplicationPrevention\s*=\s*\{[\s\S]*?\n\};'
        content = re.sub(pattern, '', content)

        # 既にFileIdUtilitiesが定義されている場合は削除（共通版を使用）
        if 'FileIdUtilities' in content and 'const FileIdUtilities = {' in content:
            pattern = r'(?:\/\*\*[\s\S]*?\*\/\s*)?const\s+FileIdUtilities\s*=\s*\{[\s\S]*?\n\};'
            content = re.sub(pattern, '', content)

        return content

    def optimize_dopost_function(self, content, project_name):
        """doPost関数を最適化"""
        # 既存のdoPost関数を探す
        dopost_pattern = r'function\s+doPost\s*\([^)]*\)\s*\{[\s\S]*?\n\}'

        if re.search(dopost_pattern, content):
            # processRequest関数が存在するか確認
            if 'function processRequest' in content:
                # 最適化されたdoPost関数に置き換え
                optimized_dopost = f"""/**
 * AppSheet Webhook エントリーポイント
 * @param {{GoogleAppsScript.Events.DoPost}} e
 */
function doPost(e) {{
  return CommonWebhook.handleDoPost(e, function(params) {{
    params.scriptName = '{project_name}';
    return processRequest(params);
  }});
}}"""
                content = re.sub(dopost_pattern, optimized_dopost, content)

        return content

    def optimize_test_function(self, content, project_name):
        """testProcessRequest関数を最適化"""
        # 既存のtestProcessRequest関数を探す
        test_pattern = r'function\s+testProcessRequest\s*\(\s*\)\s*\{[\s\S]*?\n\}'

        if re.search(test_pattern, content):
            # 最適化されたテスト関数に置き換え
            optimized_test = f"""/**
 * テスト用関数
 * GASエディタから直接実行してテスト可能
 */
function testProcessRequest() {{
  // TODO: テストデータを設定してください
  const testParams = {{
    // 例: action: "test",
    // 例: data: "sample"
  }};

  return CommonTest.runTest(processRequest, testParams, '{project_name}');
}}"""
            content = re.sub(test_pattern, optimized_test, content)

        return content

    def unify_error_handling(self, content):
        """エラーハンドリングを統一"""
        # handleScriptError関数を最適化
        if 'function handleScriptError' in content:
            # 既存のhandleScriptError関数を探す
            pattern = r'function\s+handleScriptError\s*\([^)]*\)\s*\{[\s\S]*?\n\}'

            # ErrorHandlerモジュールを使用する形に置き換え
            optimized_handler = """/**
 * スクリプト実行時エラーを処理
 * @param {string} recordId - レコードID
 * @param {string} errorMessage - エラーメッセージ
 */
function handleScriptError(recordId, errorMessage) {
  const error = new Error(errorMessage);

  ErrorHandler.handleError(error, {
    scriptName: ScriptApp.getActive().getName(),
    processId: recordId,
    recordId: recordId,
    appsheetConfig: {
      appId: APP_ID,
      tableName: TABLE_NAME,
      accessKey: ACCESS_KEY
    }
  });
}"""
            content = re.sub(pattern, optimized_handler, content)

        return content

    def add_common_module_imports(self, project_path):
        """共通モジュールのインポートを追加"""
        scripts_dir = project_path / 'scripts'
        if not scripts_dir.exists():
            scripts_dir = project_path

        # 共通モジュールファイルをコピー
        common_modules = [
            'ExecutionLogger.gs',
            'DuplicationPrevention.gs',
            'CommonWebhook.gs',
            'AppSheetConnector.gs',
            'ErrorHandler.gs',
            'ValidationUtils.gs'
        ]

        for module_name in common_modules:
            src_path = self.common_modules_dir / module_name
            if src_path.exists():
                dst_path = scripts_dir / module_name
                if not dst_path.exists():
                    shutil.copy2(src_path, dst_path)
                    print(f"  + 共通モジュール追加: {module_name}")

    def print_summary(self):
        """最適化結果のサマリーを表示"""
        print("\n" + "=" * 60)
        print("最適化結果サマリー")
        print("=" * 60)
        print(f"最適化されたファイル数: {self.optimized_count}")

        if self.errors:
            print(f"\nエラー数: {len(self.errors)}")
            for error in self.errors[:10]:
                print(f"  - {error['project']}/{error['file']}: {error['error']}")

        print("\n推奨される次のステップ:")
        print("1. 各プロジェクトで共通モジュールをインポート")
        print("2. 全プロジェクトのテスト実行")
        print("3. 最適化されたコードのデプロイ")


def main():
    """メイン処理"""
    base_dir = Path(__file__).parent.parent / 'gas_projects'

    if not base_dir.exists():
        print(f"エラー: プロジェクトディレクトリが見つかりません: {base_dir}")
        return

    print("GASプロジェクトの最適化を開始します...")
    print("=" * 60)

    optimizer = GASProjectOptimizer(base_dir)

    # 全プロジェクトを最適化
    optimizer.optimize_all_projects()

    # 共通モジュールを各プロジェクトに追加
    print("\n共通モジュールを各プロジェクトに追加中...")
    projects = [d for d in base_dir.iterdir()
               if d.is_dir() and not d.name.startswith('.')
               and d.name != '共通モジュール']

    for project in projects:
        optimizer.add_common_module_imports(project)

    print("\n最適化が完了しました。")
    print("次は deploy_all_to_gas.py を実行して全プロジェクトをデプロイしてください。")


if __name__ == '__main__':
    main()