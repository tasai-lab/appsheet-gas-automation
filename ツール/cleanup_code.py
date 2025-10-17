#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GASコードのクリーンアップツール

不要な空白行と重複テキストを削除
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

class CodeCleaner:
    """コードクリーナー"""

    def __init__(self, base_dir):
        self.base_dir = Path(base_dir)
        self.cleaned_count = 0
        self.errors = []

    def clean_all_projects(self):
        """全プロジェクトをクリーンアップ"""
        projects = [d for d in self.base_dir.iterdir()
                   if d.is_dir() and not d.name.startswith('.')]

        print(f"クリーンアップ対象プロジェクト数: {len(projects)}")
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

        # 1. 先頭の連続した空白行を削除（最大1行まで）
        content = re.sub(r'^\n{2,}', '\n', content)

        # 2. ファイル末尾の過剰な空白行を削除（最大1行まで）
        content = re.sub(r'\n{3,}$', '\n\n', content)

        # 3. 重複したJSDocコメントを削除
        # 同じJSDocコメントが連続している場合、最初のものだけを残す
        content = self.remove_duplicate_jsdoc(content)

        # 4. 重複したfunction定義を削除
        # 同じfunction定義が連続している場合、最初のものだけを残す
        content = self.remove_duplicate_functions(content)

        # 5. コード内の過剰な連続空白行を削除（最大2行まで）
        content = re.sub(r'\n{4,}', '\n\n\n', content)

        # 6. JSDocコメント内の不要な空白行を削除
        content = self.clean_jsdoc_comments(content)

        # 7. 関数内の過剰な空白行を削除
        content = self.clean_function_bodies(content)

        # 変更があった場合のみ保存
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)

            cleaned_lines = len(content.split('\n'))
            removed_lines = original_lines - cleaned_lines

            self.cleaned_count += 1
            print(f"  ✓ クリーンアップ: {file_path.name} ({removed_lines}行削除)")

    def remove_duplicate_jsdoc(self, content):
        """重複したJSDocコメントを削除"""
        lines = content.split('\n')
        result = []
        prev_jsdoc = None
        i = 0

        while i < len(lines):
            line = lines[i]

            # JSDocコメント開始
            if line.strip().startswith('/**'):
                # JSDocコメント全体を取得
                jsdoc_lines = [line]
                i += 1
                while i < len(lines) and not lines[i].strip().endswith('*/'):
                    jsdoc_lines.append(lines[i])
                    i += 1
                if i < len(lines):
                    jsdoc_lines.append(lines[i])

                jsdoc_text = '\n'.join(jsdoc_lines)

                # 前のJSDocと同じ内容の場合はスキップ
                if jsdoc_text.strip() != prev_jsdoc:
                    result.extend(jsdoc_lines)
                    prev_jsdoc = jsdoc_text.strip()
                else:
                    # 重複したJSDocはスキップ
                    pass

                i += 1
            else:
                result.append(line)
                prev_jsdoc = None
                i += 1

        return '\n'.join(result)

    def remove_duplicate_functions(self, content):
        """重複したfunction定義を削除"""
        lines = content.split('\n')
        result = []
        prev_function = None
        i = 0

        while i < len(lines):
            line = lines[i]

            # function定義の開始
            if re.match(r'^\s*function\s+\w+\s*\(', line):
                # function定義全体を取得（単純な1行の定義）
                if line.strip().endswith('{'):
                    func_signature = line.strip()

                    # 前のfunctionと同じシグネチャの場合はスキップ
                    if func_signature != prev_function:
                        result.append(line)
                        prev_function = func_signature
                    else:
                        # 重複したfunctionはスキップ
                        # ただし、関数本体は保持する必要があるため
                        # 最初の定義を保持
                        pass
                else:
                    result.append(line)
                    prev_function = None

                i += 1
            else:
                result.append(line)
                if line.strip() and not line.strip().startswith('//') and not line.strip().startswith('*'):
                    prev_function = None
                i += 1

        return '\n'.join(result)

    def clean_jsdoc_comments(self, content):
        """JSDocコメント内の不要な空白行を削除"""
        lines = content.split('\n')
        result = []
        in_jsdoc = False
        jsdoc_lines = []

        for line in lines:
            if line.strip().startswith('/**'):
                in_jsdoc = True
                jsdoc_lines = [line]
            elif in_jsdoc:
                if line.strip() == '*' or line.strip() == '':
                    # JSDoc内の空行は1行のみ許可
                    if not (jsdoc_lines and (jsdoc_lines[-1].strip() == '*' or jsdoc_lines[-1].strip() == '')):
                        jsdoc_lines.append(line)
                else:
                    jsdoc_lines.append(line)

                if line.strip().endswith('*/'):
                    in_jsdoc = False
                    result.extend(jsdoc_lines)
                    jsdoc_lines = []
            else:
                result.append(line)

        return '\n'.join(result)

    def clean_function_bodies(self, content):
        """関数本体内の過剰な空白行を削除"""
        # 関数内で3行以上の空白行を2行に削減
        lines = content.split('\n')
        result = []
        in_function = False
        brace_count = 0
        empty_line_count = 0

        for line in lines:
            # 関数定義の検出
            if re.match(r'^\s*function\s+\w+', line):
                in_function = True
                brace_count = 0

            # 中括弧のカウント
            if in_function:
                brace_count += line.count('{') - line.count('}')

            # 空行の処理
            if line.strip() == '':
                empty_line_count += 1
                if in_function and empty_line_count <= 1:
                    result.append(line)
                elif not in_function and empty_line_count <= 2:
                    result.append(line)
            else:
                empty_line_count = 0
                result.append(line)

            # 関数終了の検出
            if in_function and brace_count == 0 and '{' in ''.join(result[-10:]):
                in_function = False

        return '\n'.join(result)

    def print_summary(self):
        """クリーンアップ結果のサマリーを表示"""
        print("\n" + "=" * 60)
        print("クリーンアップ結果サマリー")
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

    print("GASコードのクリーンアップを開始します...")
    print("=" * 60)

    cleaner = CodeCleaner(base_dir)
    cleaner.clean_all_projects()

    print("\nクリーンアップが完了しました。")


if __name__ == '__main__':
    main()
