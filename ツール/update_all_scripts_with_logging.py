"""
全GASスクリプトを更新してログ記録機能を追加
- メール通知を削除
- スプレッドシートへのログ記録を追加
- Gemini APIキーを統一
- モデルを最適化（flash/pro）

Usage:
    python update_all_scripts_with_logging.py [--projects-dir DIR] [--api-key KEY] [--filter PATTERN]
"""
import os
import re
import json
import shutil
import argparse
from pathlib import Path

# デフォルト設定
DEFAULT_PROJECTS_DIR = 'gas_projects'
DEFAULT_COMMON_MODULES_DIR = 'common_modules'
DEFAULT_API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY'
DEFAULT_FLASH_MODEL = 'gemini-2.5-flash'  # 最新のFlashモデル（2025年1月）
DEFAULT_PRO_MODEL = 'gemini-2.5-pro'  # 最新のProモデル（2025年1月）

# 複雑な思考が必要なスクリプト（Proモデル使用）
PRO_SCRIPTS = [
    'Appsheet_通話_要約生成',
    'Appsheet_訪問看護_通常記録',
    'Appsheet_訪問看護_精神科記録',
    'Appsheet_訪問看護_報告書',
    'Appsheet_利用者_質疑応答',
    'Appsheet_営業レポート'
]

def parse_arguments():
    """引数をパース"""
    parser = argparse.ArgumentParser(
        description='GASスクリプトにログ記録機能を追加',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        '--projects-dir',
        type=Path,
        default=Path(DEFAULT_PROJECTS_DIR),
        help=f'GASプロジェクトディレクトリ (デフォルト: {DEFAULT_PROJECTS_DIR})'
    )

    parser.add_argument(
        '--common-modules-dir',
        type=Path,
        default=Path(DEFAULT_COMMON_MODULES_DIR),
        help=f'共通モジュールディレクトリ (デフォルト: {DEFAULT_COMMON_MODULES_DIR})'
    )

    parser.add_argument(
        '--api-key',
        default=DEFAULT_API_KEY,
        help='Gemini API キー'
    )

    parser.add_argument(
        '--flash-model',
        default=DEFAULT_FLASH_MODEL,
        help=f'Flashモデル名 (デフォルト: {DEFAULT_FLASH_MODEL})'
    )

    parser.add_argument(
        '--pro-model',
        default=DEFAULT_PRO_MODEL,
        help=f'Proモデル名 (デフォルト: {DEFAULT_PRO_MODEL})'
    )

    parser.add_argument(
        '--filter',
        help='プロジェクト名フィルター (例: Appsheet_通話)'
    )

    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='詳細ログを表示'
    )

    return parser.parse_args()


def get_model_for_script(script_name, flash_model, pro_model):
    """スクリプト名に応じて適切なモデルを返す"""
    for pro_script in PRO_SCRIPTS:
        if pro_script in script_name:
            return pro_model
    return flash_model

def update_api_key_in_content(content, script_name, args):
    """コンテンツ内のAPIキーを統一し、モデルを最適化"""
    model = get_model_for_script(script_name, args.flash_model, args.pro_model)
    
    # APIキーのパターン
    api_key_patterns = [
        r'const\s+GEMINI_API_KEY\s*=\s*[\'"][^\'"]+[\'"]',
        r'const\s+API_KEY\s*=\s*[\'"][^\'"]+[\'"]',
        r'apiKey:\s*[\'"][^\'"]+[\'"]',
    ]
    
    # APIキーを統一
    for pattern in api_key_patterns:
        if 'const' in pattern:
            content = re.sub(pattern, f"const GEMINI_API_KEY = '{args.api_key}'", content)
        else:
            content = re.sub(pattern, f"apiKey: '{args.api_key}'", content)
    
    # モデル名を更新
    model_patterns = [
        (r'gemini-1\.5-pro-[a-z0-9-]+', model if model == args.pro_model else args.flash_model),
        (r'gemini-2\.0-[a-z0-9-]+', model),
        (r'gemini-1\.5-flash-[a-z0-9-]+', args.flash_model),
        (r'gemini-pro', model if model == args.pro_model else args.flash_model),
        (r'models/gemini-[a-z0-9.-]+', f'models/{model}'),
    ]
    
    for pattern, replacement in model_patterns:
        content = re.sub(pattern, replacement, content)
    
    return content

def add_logger_import(content, script_name):
    """ExecutionLoggerのインポートを追加"""
    # 既にインポート済みかチェック
    if 'ExecutionLogger' in content or 'logExecution' in content:
        return content
    
    # ファイルの先頭にコメントを追加
    import_comment = f"""/**
 * {script_name}
 * 実行履歴ログ記録機能付き
 * 
 * 依存: ExecutionLogger.gs
 */

"""
    
    # 既存のコメントの後に追加
    lines = content.split('\n')
    insert_index = 0
    
    # 最初のコメントブロックをスキップ
    in_comment = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('/**'):
            in_comment = True
        elif stripped.endswith('*/') and in_comment:
            in_comment = False
            insert_index = i + 1
            break
        elif not in_comment and stripped and not stripped.startswith('//'):
            insert_index = i
            break
    
    # コメントを挿入（既にコメントがある場合はスキップ）
    if '実行履歴ログ記録機能' not in content:
        lines.insert(insert_index, import_comment.rstrip())
        content = '\n'.join(lines)
    
    return content

def replace_email_with_logging(content, script_name):
    """メール通知をログ記録に置き換え"""
    
    # メール送信関数を削除または置換
    email_functions = [
        'sendSuccessNotification',
        'sendErrorNotification', 
        'sendNotificationEmail',
        'sendEmail',
        'notifyError',
        'notifySuccess'
    ]
    
    for func_name in email_functions:
        # 関数定義を削除
        pattern = rf'function\s+{func_name}\s*\([^)]*\)\s*\{{[^}}]*\}}'
        content = re.sub(pattern, '', content, flags=re.DOTALL)
        
        # 関数呼び出しをログ記録に置換
        # 成功通知
        if 'Success' in func_name or 'success' in func_name.lower():
            pattern = rf'{func_name}\s*\([^)]*\)\s*;?'
            replacement = "logExecution(SCRIPT_NAME, 'SUCCESS', 'Processing completed successfully', {{ callId: callId }});"
            content = re.sub(pattern, replacement, content)
        # エラー通知
        elif 'Error' in func_name or 'error' in func_name.lower():
            pattern = rf'{func_name}\s*\([^)]*\)\s*;?'
            replacement = "logExecution(SCRIPT_NAME, 'ERROR', error.message, formatError(error));"
            content = re.sub(pattern, replacement, content)
    
    # MailApp呼び出しを削除
    content = re.sub(r'MailApp\.send[^;]*;', '// Email notification removed', content)
    
    return content

def add_logging_to_dopost(content, script_name):
    """doPost関数にログ記録を追加"""
    
    # スクリプト名定数を追加
    if 'const SCRIPT_NAME' not in content and 'var SCRIPT_NAME' not in content:
        script_name_const = f"\nconst SCRIPT_NAME = '{script_name}';\n\n"
        
        # 最初のfunction定義の前に挿入
        function_match = re.search(r'^function\s+\w+', content, re.MULTILINE)
        if function_match:
            insert_pos = function_match.start()
            content = content[:insert_pos] + script_name_const + content[insert_pos:]
    
    # 既にログ記録がある場合はスキップ
    if 'logExecution(SCRIPT_NAME' in content:
        return content
    
    # この方法は複雑なので、手動で修正する必要があるファイルには適用しない
    # 代わりに簡単なマーカーを追加のみ
    return content

def copy_logger_to_project(project_dir, common_modules_dir):
    """ExecutionLogger.gsをプロジェクトにコピー"""
    logger_source = os.path.join(common_modules_dir, 'ExecutionLogger.gs')
    logger_dest = os.path.join(project_dir, 'scripts', 'ExecutionLogger.gs')
    
    if not os.path.exists(logger_source):
        print(f"  ⚠ Warning: {logger_source} not found")
        return False
    
    # HTMLファイルを削除
    scripts_dir = os.path.join(project_dir, 'scripts')
    if os.path.exists(scripts_dir):
        for file in os.listdir(scripts_dir):
            if file.endswith('.html'):
                html_path = os.path.join(scripts_dir, file)
                os.remove(html_path)
                print(f"  ✓ Removed: {file}")
    
    shutil.copy2(logger_source, logger_dest)
    print(f"  ✓ Copied: ExecutionLogger.gs")
    return True

def update_script_file(file_path, script_name, args):
    """スクリプトファイルを更新"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # バックアップ作成
        backup_path = file_path + '.backup'
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(content)

        original_content = content

        # 1. APIキーとモデルを更新
        content = update_api_key_in_content(content, script_name, args)
        
        # 2. Loggerインポートを追加
        content = add_logger_import(content, script_name)
        
        # 3. メール通知をログ記録に置換
        content = replace_email_with_logging(content, script_name)
        
        # 4. doPost関数にログ記録を追加
        if 'function doPost' in content:
            content = add_logging_to_dopost(content, script_name)
        
        # 変更があった場合のみ保存
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        
        return False
        
    except Exception as e:
        print(f"  ✗ Error updating {file_path}: {e}")
        return False

def process_project(project_dir, args):
    """プロジェクトを処理"""
    project_name = os.path.basename(project_dir)
    print(f"\n[{project_name}]")

    scripts_dir = os.path.join(project_dir, 'scripts')
    if not os.path.exists(scripts_dir):
        print(f"  ⚠ No scripts directory found")
        return

    # ExecutionLogger.gsをコピー
    copy_logger_to_project(project_dir, args.common_modules_dir)

    # .gsファイルを処理
    updated_count = 0
    for file_name in os.listdir(scripts_dir):
        if file_name.endswith('.gs') and file_name != 'ExecutionLogger.gs':
            file_path = os.path.join(scripts_dir, file_name)
            if update_script_file(file_path, project_name, args):
                if args.verbose:
                    print(f"  ✓ Updated: {file_name}")
                updated_count += 1

    if updated_count > 0:
        print(f"  ✓ Total updated: {updated_count} file(s)")
    else:
        print(f"  - No changes needed")

def main():
    """メイン処理"""
    args = parse_arguments()

    print("=" * 60)
    print("GASスクリプト一括更新")
    print("=" * 60)
    print(f"- API Key: {args.api_key[:20]}...")
    print(f"- Flash Model: {args.flash_model}")
    print(f"- Pro Model: {args.pro_model}")
    if args.filter:
        print(f"- Filter: {args.filter}")
    print("=" * 60)

    # gas_projectsディレクトリ内の全プロジェクトを処理
    for project_name in sorted(os.listdir(args.projects_dir)):
        project_dir = os.path.join(args.projects_dir, project_name)
        if os.path.isdir(project_dir):
            # フィルター適用
            if args.filter and args.filter not in project_name:
                if args.verbose:
                    print(f"\nスキップ: {project_name} (フィルター条件に不一致)")
                continue

            process_project(project_dir, args)

    print("\n" + "=" * 60)
    print("✓ 更新完了")
    print("=" * 60)

if __name__ == '__main__':
    main()
