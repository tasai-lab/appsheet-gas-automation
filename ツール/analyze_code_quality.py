#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GASプロジェクトのコード品質分析ツール

重複コード、共通パターン、改善点を特定
"""
import os
import sys
import re
import json
from pathlib import Path
from collections import defaultdict, Counter
import hashlib

# Windowsのコンソール文字コード問題を回避
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

class CodeAnalyzer:
    """コード品質分析器"""

    def __init__(self, base_dir):
        self.base_dir = Path(base_dir)
        self.results = {
            'duplicates': [],
            'patterns': defaultdict(list),
            'metrics': defaultdict(dict),
            'improvements': []
        }

    def analyze_all_projects(self):
        """全プロジェクトを分析"""
        projects = [d for d in self.base_dir.iterdir() if d.is_dir() and not d.name.startswith('.')]

        print(f"分析対象プロジェクト数: {len(projects)}")
        print("="*60)

        all_functions = defaultdict(list)
        all_modules = defaultdict(list)

        for project in sorted(projects):
            print(f"\n分析中: {project.name}")
            self.analyze_project(project, all_functions, all_modules)

        # 重複分析
        self.find_duplicates(all_functions)
        self.find_common_patterns(all_modules)

        return self.results

    def analyze_project(self, project_path, all_functions, all_modules):
        """個別プロジェクトを分析"""
        scripts_dir = project_path / 'scripts'
        if not scripts_dir.exists():
            scripts_dir = project_path

        gs_files = list(scripts_dir.glob('*.gs'))

        if not gs_files:
            return

        project_name = project_path.name
        self.results['metrics'][project_name] = {
            'file_count': len(gs_files),
            'total_lines': 0,
            'function_count': 0,
            'duplicate_lines': 0
        }

        for file_path in gs_files:
            self.analyze_file(file_path, project_name, all_functions, all_modules)

    def analyze_file(self, file_path, project_name, all_functions, all_modules):
        """ファイルを分析"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')

            self.results['metrics'][project_name]['total_lines'] += len(lines)

            # 関数を抽出
            functions = self.extract_functions(content)
            for func_name, func_body in functions:
                func_hash = hashlib.md5(func_body.encode()).hexdigest()
                all_functions[func_hash].append({
                    'project': project_name,
                    'file': file_path.name,
                    'function': func_name,
                    'lines': len(func_body.split('\n'))
                })
                self.results['metrics'][project_name]['function_count'] += 1

            # モジュールパターンを抽出
            modules = self.extract_modules(content)
            for module_name, module_body in modules:
                module_hash = hashlib.md5(module_body.encode()).hexdigest()
                all_modules[module_hash].append({
                    'project': project_name,
                    'file': file_path.name,
                    'module': module_name,
                    'lines': len(module_body.split('\n'))
                })

            # 共通パターンを検出
            self.detect_patterns(content, project_name, file_path.name)

        except Exception as e:
            print(f"  エラー: {file_path.name} - {e}")

    def extract_functions(self, content):
        """関数を抽出"""
        functions = []
        pattern = r'function\s+(\w+)\s*\([^)]*\)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}'
        matches = re.finditer(pattern, content, re.MULTILINE | re.DOTALL)

        for match in matches:
            func_name = match.group(1)
            func_body = match.group(2).strip()
            functions.append((func_name, func_body))

        return functions

    def extract_modules(self, content):
        """モジュールパターンを抽出"""
        modules = []
        pattern = r'const\s+(\w+)\s*=\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\};'
        matches = re.finditer(pattern, content, re.MULTILINE | re.DOTALL)

        for match in matches:
            module_name = match.group(1)
            module_body = match.group(2).strip()
            modules.append((module_name, module_body))

        return modules

    def detect_patterns(self, content, project_name, file_name):
        """共通パターンを検出"""
        patterns = {
            'ExecutionLogger': r'ExecutionLogger\s*[.=]',
            'DuplicationPrevention': r'DuplicationPrevention\s*[.=]',
            'AppSheet API': r'api\.appsheet\.com',
            'Gemini API': r'generativelanguage\.googleapis\.com',
            'Error Handling': r'try\s*\{[\s\S]*?\}\s*catch',
            'Lock Service': r'LockService\.',
            'Cache Service': r'CacheService\.',
            'URL Fetch': r'UrlFetchApp\.fetch',
            'Spreadsheet': r'SpreadsheetApp\.',
            'Drive API': r'DriveApp\.',
        }

        for pattern_name, pattern in patterns.items():
            if re.search(pattern, content):
                self.results['patterns'][pattern_name].append({
                    'project': project_name,
                    'file': file_name
                })

    def find_duplicates(self, all_functions):
        """重複関数を検出"""
        for func_hash, locations in all_functions.items():
            if len(locations) > 1:
                self.results['duplicates'].append({
                    'type': 'function',
                    'locations': locations,
                    'count': len(locations)
                })

    def find_common_patterns(self, all_modules):
        """共通モジュールパターンを検出"""
        for module_hash, locations in all_modules.items():
            if len(locations) > 1:
                self.results['duplicates'].append({
                    'type': 'module',
                    'locations': locations,
                    'count': len(locations)
                })

    def generate_report(self):
        """分析レポートを生成"""
        print("\n" + "="*60)
        print("コード品質分析レポート")
        print("="*60)

        # 重複コード
        print("\n■ 重複コード検出結果:")
        if self.results['duplicates']:
            duplicate_functions = defaultdict(int)
            duplicate_modules = defaultdict(int)

            for dup in self.results['duplicates']:
                if dup['type'] == 'function':
                    for loc in dup['locations']:
                        duplicate_functions[loc['function']] += 1
                else:
                    for loc in dup['locations']:
                        duplicate_modules[loc['module']] += 1

            print("\n  重複関数:")
            for func, count in sorted(duplicate_functions.items(), key=lambda x: x[1], reverse=True)[:10]:
                if count > 1:
                    print(f"    - {func}: {count}箇所")

            print("\n  重複モジュール:")
            for module, count in sorted(duplicate_modules.items(), key=lambda x: x[1], reverse=True)[:10]:
                if count > 1:
                    print(f"    - {module}: {count}箇所")
        else:
            print("  重複なし")

        # 共通パターン
        print("\n■ 共通パターン使用状況:")
        for pattern_name, locations in self.results['patterns'].items():
            if locations:
                projects = set(loc['project'] for loc in locations)
                print(f"  {pattern_name}: {len(projects)}プロジェクト")

        # メトリクス
        print("\n■ プロジェクトメトリクス:")
        total_lines = sum(m['total_lines'] for m in self.results['metrics'].values())
        total_functions = sum(m['function_count'] for m in self.results['metrics'].values())

        print(f"  総行数: {total_lines:,}")
        print(f"  総関数数: {total_functions:,}")
        print(f"  プロジェクト数: {len(self.results['metrics'])}")

        # 改善提案
        print("\n■ 改善提案:")
        self.generate_improvements()
        for improvement in self.results['improvements'][:10]:
            print(f"  - {improvement}")

    def generate_improvements(self):
        """改善提案を生成"""
        improvements = []

        # 重複コードの共通化
        if len(self.results['duplicates']) > 5:
            improvements.append("重複コードが多数検出されました。共通モジュールへの移行を推奨")

        # ExecutionLoggerの統一
        exec_logger = self.results['patterns'].get('ExecutionLogger', [])
        if exec_logger and len(set(loc['project'] for loc in exec_logger)) < 10:
            improvements.append("ExecutionLoggerが一部プロジェクトでのみ使用。全プロジェクトへの導入を推奨")

        # エラーハンドリングの改善
        error_handling = self.results['patterns'].get('Error Handling', [])
        projects_with_error = set(loc['project'] for loc in error_handling)
        all_projects = set(self.results['metrics'].keys())
        if len(projects_with_error) < len(all_projects) * 0.8:
            improvements.append("エラーハンドリングが不足。try-catch構造の追加を推奨")

        self.results['improvements'] = improvements

    def save_results(self, output_file):
        """結果を保存"""
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, ensure_ascii=False, indent=2)
        print(f"\n結果を保存: {output_file}")


def main():
    base_dir = Path(__file__).parent.parent / 'gas_projects'

    analyzer = CodeAnalyzer(base_dir)
    analyzer.analyze_all_projects()
    analyzer.generate_report()

    output_file = Path(__file__).parent / 'code_quality_analysis.json'
    analyzer.save_results(output_file)

    # 改善スクリプトの生成を提案
    print("\n" + "="*60)
    print("次のステップ:")
    print("1. 共通モジュールライブラリの作成")
    print("2. 重複コードの削除と共通化")
    print("3. エラーハンドリングの統一")
    print("4. ログ記録の標準化")
    print("5. 全プロジェクトの再デプロイ")


if __name__ == '__main__':
    main()