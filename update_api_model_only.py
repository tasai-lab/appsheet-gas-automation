"""
GASスクリプトのAPIキーとモデル名を更新
"""
import os
import re
from pathlib import Path

# 設定
GAS_PROJECTS_DIR = 'gas_projects'
UNIFIED_API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY'
FLASH_MODEL = 'gemini-2.5-flash'
PRO_MODEL = 'gemini-2.5-pro'

# 複雑な思考が必要なスクリプト（Proモデル使用）
PRO_SCRIPTS = [
    'Appsheet_通話_要約生成',
    'Appsheet_訪問看護_通常記録',
    'Appsheet_訪問看護_精神科記録',
    'Appsheet_訪問看護_報告書',
    'Appsheet_利用者_質疑応答',
    'Appsheet_営業レポート'
]

def get_model_for_script(script_name):
    """スクリプト名に応じて適切なモデルを返す"""
    for pro_script in PRO_SCRIPTS:
        if pro_script in script_name:
            return PRO_MODEL
    return FLASH_MODEL

def update_file(file_path, script_name):
    """ファイルのAPIキーとモデル名を更新"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        model = get_model_for_script(script_name)
        changed = False
        
        # APIキーを更新
        api_key_patterns = [
            (r"const\s+GEMINI_API_KEY\s*=\s*['\"][^'\"]+['\"]", f"const GEMINI_API_KEY = '{UNIFIED_API_KEY}'"),
            (r"const\s+API_KEY\s*=\s*['\"][^'\"]+['\"]", f"const API_KEY = '{UNIFIED_API_KEY}'"),
            (r'apiKey\s*:\s*["\'][^"\']+["\']', f'apiKey: "{UNIFIED_API_KEY}"'),
        ]
        
        for pattern, replacement in api_key_patterns:
            if re.search(pattern, content):
                content = re.sub(pattern, replacement, content)
                changed = True
        
        # モデル名を更新（gemini-で始まるモデル名を対象）
        model_patterns = [
            (r'gemini-1\.5-pro[a-z0-9-]*', model if model == PRO_MODEL else FLASH_MODEL),
            (r'gemini-1\.5-flash[a-z0-9-]*', FLASH_MODEL),
            (r'gemini-pro(?![a-z0-9-])', model if model == PRO_MODEL else FLASH_MODEL),
            (r'gemini-exp-[0-9]+', model if model == PRO_MODEL else FLASH_MODEL),
        ]
        
        for pattern, replacement in model_patterns:
            if re.search(pattern, content):
                content = re.sub(pattern, replacement, content)
                changed = True
        
        # 変更があった場合のみ保存
        if changed and content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        
        return False
        
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def process_project(project_dir):
    """プロジェクトを処理"""
    project_name = os.path.basename(project_dir)
    scripts_dir = os.path.join(project_dir, 'scripts')
    
    if not os.path.exists(scripts_dir):
        return 0
    
    updated_count = 0
    for file_name in os.listdir(scripts_dir):
        if file_name.endswith('.gs'):
            file_path = os.path.join(scripts_dir, file_name)
            if update_file(file_path, project_name):
                updated_count += 1
    
    return updated_count

def main():
    """メイン処理"""
    print("=" * 60)
    print("GASスクリプト API/モデル更新")
    print("=" * 60)
    print(f"API Key: {UNIFIED_API_KEY}")
    print(f"Flash Model: {FLASH_MODEL}")
    print(f"Pro Model: {PRO_MODEL}")
    print("=" * 60)
    
    total_updated = 0
    for project_name in sorted(os.listdir(GAS_PROJECTS_DIR)):
        project_dir = os.path.join(GAS_PROJECTS_DIR, project_name)
        if os.path.isdir(project_dir):
            model = get_model_for_script(project_name)
            updated = process_project(project_dir)
            if updated > 0:
                print(f"✓ {project_name} ({model}): {updated} file(s) updated")
                total_updated += updated
    
    print("=" * 60)
    print(f"✓ Total: {total_updated} file(s) updated")
    print("=" * 60)

if __name__ == '__main__':
    main()
