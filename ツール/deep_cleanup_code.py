#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GASコードの詳細クリーンアップツール

重複JSDocと過剰空白行を完全に削除
"""
import os
import sys
import re
from pathlib import Path

# Windowsのコンソール文字コード問題を回避
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

class DeepCodeCleaner:
    """詳細コードクリーナー"""

    def __init__(self, base_dir):
        self.base_dir = Path(base_dir)
        self.cleaned_count = 0
        self.errors = []

    def clean_all_projects(self):
        """全プロジェクトをクリーンアップ"""
        projects = [d for d in self.base_dir.iterdir()
                   if d.is_dir() and not d.name.startswith('.')]

        print(f"詳細クリーンアップ対象プロジェクト数: {len(projects)}")
        print("=" * 60)

        for project in sorted(projects):
            print(f"\nクリーンアップ中: {project.name}")
            self.clean_project(project)

        self.print_summary()

    def clean_project(self, project_path):
        """個別プロジェクトをクリーンアップ"""
        scripts_dir = project_path / 'scripts'
        if not scripts_dir.exists():
            scripts_dir = project_path

        gs_files = list(scripts_dir.glob('*.gs'))
        if not gs_files:
            return

        for file_path in gs_files:
            try:
                self.clean_file(file_path)
            except Exception as e:
                self.errors.append({
                    'project': project_path.name,
                    'file': file_path.name,
                    'error': str(e)
                })
                print(f"  エラー: {file_path.name} - {e}")

    def clean_file(self, file_path):
        """ファイルをクリーンアップ"""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content
        original_lines = len(content.split('\n'))

        # 1. ファイル先頭の空白行を削除
        content = content.lstrip('\n')

        # 2. JSDocコメントをクリーンアップ
        content = self.clean_jsdoc_comprehensive(content)

        # 3. 重複したfunction定義を削除
        content = self.remove_duplicate_function_declarations(content)

        # 4. 関数内の空白行を整理（1行まで）
        content = self.clean_function_whitespace(content)

        # 5. 連続する空白行を最大2行まで
        content = re.sub(r'\n{4,}', '\n\n\n', content)

        # 6. ファイル末尾の空白行を1行に
        content = content.rstrip('\n') + '\n'

        # 変更があった場合のみ保存
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)

            cleaned_lines = len(content.split('\n'))
            removed_lines = original_lines - cleaned_lines

            self.cleaned_count += 1
            print(f"  ✓ クリーンアップ: {file_path.name} ({removed_lines}行削除)")

    def clean_jsdoc_comprehensive(self, content):
        """JSDocコメントを包括的にクリーンアップ"""
        lines = content.split('\n')
        result = []
        i = 0
        prev_jsdoc_signature = None

        while i < len(lines):
            line = lines[i]

            # JSDocコメント開始を検出
            if line.strip().startswith('/**'):
                jsdoc_start = i
                jsdoc_lines = []

                # JSDocコメントブロック全体を取得
                while i < len(lines):
                    current_line = lines[i]
                    stripped = current_line.strip()

                    # 空行や「*」のみの行は必要最小限に
                    if stripped == '*' or stripped == '':
                        # 前の行も空白でない場合のみ追加
                        if jsdoc_lines and jsdoc_lines[-1].strip() not in ('*', ''):
                            jsdoc_lines.append(current_line)
                    else:
                        jsdoc_lines.append(current_line)

                    if current_line.strip().endswith('*/'):
                        i += 1
                        break
                    i += 1

                # JSDocのシグネチャを生成（パラメータ名と説明から）
                jsdoc_signature = self.get_jsdoc_signature(jsdoc_lines)

                # 次の行がfunction定義か確認
                next_line_index = i
                while next_line_index < len(lines) and lines[next_line_index].strip() == '':
                    next_line_index += 1

                if next_line_index < len(lines):
                    next_line = lines[next_line_index].strip()
                    # function定義がある場合、そのfunctionシグネチャも含める
                    if next_line.startswith('function '):
                        func_sig = self.extract_function_signature(next_line)
                        jsdoc_signature += '||' + func_sig

                # 直前のJSDocと同じ場合はスキップ
                if jsdoc_signature != prev_jsdoc_signature:
                    result.extend(jsdoc_lines)
                    prev_jsdoc_signature = jsdoc_signature
                else:
                    # 重複はスキップ
                    pass
            else:
                result.append(line)
                # JSDocではない行があれば、prev_jsdocをリセット
                if line.strip() and not line.strip().startswith('//'):
                    prev_jsdoc_signature = None
                i += 1

        return '\n'.join(result)

    def get_jsdoc_signature(self, jsdoc_lines):
        """JSDocのシグネチャを取得"""
        # 説明部分とパラメータ部分を抽出
        params = []
        description = []

        for line in jsdoc_lines:
            stripped = line.strip()
            if '@param' in stripped:
                params.append(stripped)
            elif '@return' in stripped or '@returns' in stripped:
                params.append(stripped)
            elif stripped and stripped != '/**' and stripped != '*/' and stripped != '*':
                description.append(stripped.lstrip('* '))

        # シグネチャとして結合
        return '|'.join(description + params)

    def extract_function_signature(self, line):
        """function定義のシグネチャを抽出"""
        # function name(args) の部分を抽出
        match = re.match(r'function\s+(\w+)\s*\([^)]*\)', line)
        if match:
            return match.group(0)
        return line

    def remove_duplicate_function_declarations(self, content):
        """重複したfunction宣言を削除"""
        lines = content.split('\n')
        result = []
        prev_func_sig = None
        i = 0

        while i < len(lines):
            line = lines[i]

            # function定義の検出
            if re.match(r'^\s*function\s+\w+\s*\(', line):
                func_sig = self.extract_function_signature(line.strip())

                # 前のfunctionと同じシグネチャの場合
                if func_sig == prev_func_sig:
                    # このfunctionをスキップ（関数本体は保持）
                    # 開き括弧がある場合は、次の行から継続
                    if '{' in line:
                        # 同じfunctionなのでスキップ
                        pass
                    else:
                        result.append(line)
                else:
                    result.append(line)
                    prev_func_sig = func_sig

                i += 1
            else:
                result.append(line)
                # 空行やコメント以外の場合はリセット
                if line.strip() and not line.strip().startswith('//') and not line.strip().startswith('*'):
                    if not line.strip().startswith('}'):
                        prev_func_sig = None
                i += 1

        return '\n'.join(result)

    def clean_function_whitespace(self, content):
        """関数内の空白行を整理"""
        lines = content.split('\n')
        result = []
        in_function = False
        brace_count = 0
        consecutive_empty = 0

        for line in lines:
            stripped = line.strip()

            # function定義の開始
            if re.match(r'^\s*function\s+\w+', line):
                in_function = True
                brace_count = 0
                consecutive_empty = 0

            # 中括弧のカウント
            if in_function:
                brace_count += line.count('{')
                brace_count -= line.count('}')

            # 空行の処理
            if stripped == '':
                consecutive_empty += 1
                # 関数内では1行、関数外では2行まで
                if in_function and consecutive_empty <= 1:
                    result.append(line)
                elif not in_function and consecutive_empty <= 2:
                    result.append(line)
            else:
                consecutive_empty = 0
                result.append(line)

            # 関数終了
            if in_function and brace_count == 0 and '}' in line:
                in_function = False

        return '\n'.join(result)

    def print_summary(self):
        """クリーンアップ結果のサマリーを表示"""
        print("\n" + "=" * 60)
        print("詳細クリーンアップ結果サマリー")
        print("=" * 60)
        print(f"クリーンアップされたファイル数: {self.cleaned_count}")

        if self.errors:
            print(f"\nエラー数: {len(self.errors)}")
            for error in self.errors[:10]:
                print(f"  - {error['project']}/{error['file']}: {error['error']}")


def main():
    """メイン処理"""
    base_dir = Path(__file__).parent.parent / 'gas_projects'

    if not base_dir.exists():
        print(f"エラー: プロジェクトディレクトリが見つかりません: {base_dir}")
        return

    print("GASコードの詳細クリーンアップを開始します...")
    print("=" * 60)

    cleaner = DeepCodeCleaner(base_dir)
    cleaner.clean_all_projects()

    print("\n詳細クリーンアップが完了しました。")


if __name__ == '__main__':
    main()
