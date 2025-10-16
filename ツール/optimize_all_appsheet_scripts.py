"""
Optimize all Appsheet GAS scripts
- Add webhook deduplication
- Standardize API key
- Optimize Gemini model selection
- Remove email notifications
- Add execution logging to spreadsheet
- Delete HTML files
"""

import os
import re
import json
from pathlib import Path

# Configuration
EXECUTION_LOG_SPREADSHEET_ID = '15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE'
API_KEY = 'AIzaSyDUKFlE6_NYGehDYOxiRQcHpjG2l7GZmTY'

# Model selection based on complexity
COMPLEX_MODELS = [
    '通話_要約生成',
    '訪問看護_通常記録',
    '訪問看護_精神科記録', 
    '訪問看護_報告書',
    '利用者_質疑応答',
    '営業レポート',
    '訪問看護_書類OCR',
    '訪問看護_計画書問題点',
    '訪問看護_計画書問題点_評価',
    '利用者_フェースシート',
]

FLASH_MODEL = 'gemini-2.0-flash-exp'
PRO_MODEL = 'gemini-1.5-pro-latest'


def should_use_pro_model(script_name):
    """Determine if script needs Pro model"""
    return any(keyword in script_name for keyword in COMPLEX_MODELS)


def create_deduplication_module():
    """Create reusable deduplication module"""
    return """/**
 * Webhook重複実行防止モジュール
 */
const DuplicationPrevention = {
  LOCK_TIMEOUT: 300000, // 5分
  CACHE_EXPIRATION: 3600, // 1時間
  
  /**
   * リクエストの重複チェック
   * @param {string} requestId - リクエストID（webhookデータのハッシュ値）
   * @return {boolean} - 処理を続行する場合はtrue
   */
  checkDuplicate: function(requestId) {
    const cache = CacheService.getScriptCache();
    const cacheKey = `processed_${requestId}`;
    
    // キャッシュチェック
    if (cache.get(cacheKey)) {
      Logger.log(`重複リクエストを検出: ${requestId}`);
      return false;
    }
    
    // ロック取得
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(this.LOCK_TIMEOUT);
      
      // 再度キャッシュチェック（ダブルチェック）
      if (cache.get(cacheKey)) {
        Logger.log(`ロック取得後、重複リクエストを検出: ${requestId}`);
        return false;
      }
      
      // 処理済みマークを設定
      cache.put(cacheKey, 'processed', this.CACHE_EXPIRATION);
      return true;
    } catch (e) {
      Logger.log(`ロック取得エラー: ${e.message}`);
      return false;
    } finally {
      lock.releaseLock();
    }
  },
  
  /**
   * リクエストIDを生成
   * @param {Object} data - Webhookデータ
   * @return {string} - リクエストID
   */
  generateRequestId: function(data) {
    const str = JSON.stringify(data);
    return Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      str,
      Utilities.Charset.UTF_8
    ).map(b => (b & 0xFF).toString(16).padStart(2, '0')).join('');
  }
};
"""


def create_logging_module(spreadsheet_id):
    """Create execution logging module"""
    return f"""/**
 * 実行ログモジュール
 */
const ExecutionLogger = {{
  SPREADSHEET_ID: '{spreadsheet_id}',
  SHEET_NAME: 'シート1',
  
  /**
   * ログを記録
   * @param {{string}} scriptName - スクリプト名
   * @param {{string}} status - ステータス (SUCCESS/ERROR/WARNING)
   * @param {{string}} processId - 処理ID
   * @param {{string}} message - メッセージ
   * @param {{string}} errorDetail - エラー詳細
   * @param {{number}} executionTime - 実行時間(秒)
   * @param {{Object}} inputData - 入力データ
   */
  log: function(scriptName, status, processId, message, errorDetail, executionTime, inputData) {{
    try {{
      const ss = SpreadsheetApp.openById(this.SPREADSHEET_ID);
      const sheet = ss.getSheetByName(this.SHEET_NAME);
      
      const timestamp = new Date();
      const user = Session.getActiveUser().getEmail();
      const inputDataStr = inputData ? JSON.stringify(inputData).substring(0, 1000) : '';
      
      sheet.appendRow([
        timestamp,
        scriptName,
        status,
        processId || '',
        message || '',
        errorDetail || '',
        executionTime || 0,
        user,
        inputDataStr
      ]);
    }} catch (e) {{
      Logger.log(`ログ記録エラー: ${{e.message}}`);
    }}
  }},
  
  /**
   * 成功ログ
   */
  success: function(scriptName, processId, message, executionTime, inputData) {{
    this.log(scriptName, 'SUCCESS', processId, message, '', executionTime, inputData);
  }},
  
  /**
   * エラーログ
   */
  error: function(scriptName, processId, message, error, executionTime, inputData) {{
    const errorDetail = error ? `${{error.message}}\\n${{error.stack}}` : '';
    this.log(scriptName, 'ERROR', processId, message, errorDetail, executionTime, inputData);
  }},
  
  /**
   * 警告ログ
   */
  warning: function(scriptName, processId, message, executionTime, inputData) {{
    this.log(scriptName, 'WARNING', processId, message, '', executionTime, inputData);
  }}
}};
"""


def update_api_key(content, api_key):
    """Update API key in script"""
    # Pattern 1: const API_KEY = '...'
    content = re.sub(
        r"const\s+API_KEY\s*=\s*['\"]AIzaSy[^'\"]+['\"]",
        f"const API_KEY = '{api_key}'",
        content
    )
    
    # Pattern 2: var API_KEY = '...'
    content = re.sub(
        r"var\s+API_KEY\s*=\s*['\"]AIzaSy[^'\"]+['\"]",
        f"var API_KEY = '{api_key}'",
        content
    )
    
    # Pattern 3: Direct use in URL
    content = re.sub(
        r"key=AIzaSy[a-zA-Z0-9_-]+",
        f"key={api_key}",
        content
    )
    
    return content


def update_model_name(content, model_name):
    """Update Gemini model name"""
    # Pattern 1: model: 'gemini-...'
    content = re.sub(
        r"model:\s*['\"]gemini-[^'\"]+['\"]",
        f"model: '{model_name}'",
        content
    )
    
    # Pattern 2: "model": "gemini-..."
    content = re.sub(
        r'"model"\s*:\s*"gemini-[^"]+"',
        f'"model": "{model_name}"',
        content
    )
    
    return content


def remove_email_code(content):
    """Remove email notification code"""
    # Remove MailApp.sendEmail calls
    content = re.sub(
        r'MailApp\.sendEmail\([^)]*\);?',
        '// Email removed - using execution log instead',
        content
    )
    
    # Remove GmailApp.sendEmail calls
    content = re.sub(
        r'GmailApp\.sendEmail\([^)]*\);?',
        '// Email removed - using execution log instead',
        content
    )
    
    return content


def add_deduplication_to_webhook(content, script_name):
    """Add deduplication logic to doPost function"""
    # Check if already has deduplication
    if 'DuplicationPrevention' in content:
        return content
    
    # Find doPost function
    dopost_pattern = r'function\s+doPost\s*\([^)]*\)\s*{([^}]*)}'
    match = re.search(dopost_pattern, content, re.DOTALL)
    
    if not match:
        return content
    
    # Add deduplication at the beginning of doPost
    dedup_code = """
  // Webhook重複実行防止
  const startTime = new Date().getTime();
  let requestId;
  
  try {
    const data = JSON.parse(e.postData.contents);
    requestId = DuplicationPrevention.generateRequestId(data);
    
    if (!DuplicationPrevention.checkDuplicate(requestId)) {
      ExecutionLogger.warning(
        '""" + script_name + """',
        requestId,
        '重複リクエストのためスキップ',
        0,
        data
      );
      return ContentService.createTextOutput(JSON.stringify({
        status: 'skipped',
        message: '重複リクエスト'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
"""
    
    # Replace doPost function
    new_dopost = f"function doPost(e) {{{dedup_code}{match.group(1)}}}"
    content = re.sub(dopost_pattern, new_dopost, content, flags=re.DOTALL)
    
    return content


def add_logging_to_function(content, script_name):
    """Add execution logging to main function"""
    # Check if already has logging
    if 'ExecutionLogger' in content:
        return content
    
    # Find main function (doPost or main processing function)
    functions = ['doPost', 'main', 'processWebhook', 'execute']
    
    for func_name in functions:
        pattern = rf'function\s+{func_name}\s*\([^)]*\)\s*{{([^{{}}]*(?:{{[^{{}}]*}}[^{{}}]*)*)}}'
        match = re.search(pattern, content, re.DOTALL)
        
        if match:
            func_body = match.group(1)
            
            # Add try-catch with logging
            new_body = f"""
  const startTime = new Date().getTime();
  let requestId = '';
  
  try {{
{func_body}
    
    const executionTime = (new Date().getTime() - startTime) / 1000;
    ExecutionLogger.success(
      '{script_name}',
      requestId,
      '処理完了',
      executionTime,
      typeof e !== 'undefined' ? e.postData?.contents : null
    );
  }} catch (error) {{
    const executionTime = (new Date().getTime() - startTime) / 1000;
    ExecutionLogger.error(
      '{script_name}',
      requestId,
      '処理エラー',
      error,
      executionTime,
      typeof e !== 'undefined' ? e.postData?.contents : null
    );
    throw error;
  }}
"""
            
            content = re.sub(pattern, f"function {func_name}(e) {{{new_body}}}", content, flags=re.DOTALL)
            break
    
    return content


def optimize_script_file(file_path, script_name):
    """Optimize a single script file"""
    print(f"  Optimizing: {file_path.name}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Determine model
    model = PRO_MODEL if should_use_pro_model(script_name) else FLASH_MODEL
    
    # Apply optimizations
    content = update_api_key(content, API_KEY)
    content = update_model_name(content, model)
    content = remove_email_code(content)
    
    # Add modules at the beginning if not already present
    if 'DuplicationPrevention' not in content:
        content = create_deduplication_module() + '\n\n' + content
    
    if 'ExecutionLogger' not in content:
        content = create_logging_module(EXECUTION_LOG_SPREADSHEET_ID) + '\n\n' + content
    
    # Add deduplication to webhook handler
    if 'doPost' in content:
        content = add_deduplication_to_webhook(content, script_name)
    
    # Add logging
    content = add_logging_to_function(content, script_name)
    
    # Write back
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"    ✓ Optimized with model: {model}")
        return True
    else:
        print(f"    - No changes needed")
        return False


def delete_html_files(project_dir):
    """Delete HTML files from project"""
    scripts_dir = project_dir / 'scripts'
    deleted = []
    
    if scripts_dir.exists():
        for html_file in scripts_dir.glob('*.html'):
            html_file.unlink()
            deleted.append(html_file.name)
    
    if deleted:
        print(f"    ✓ Deleted HTML files: {', '.join(deleted)}")
    
    return deleted


def optimize_project(project_dir):
    """Optimize a single GAS project"""
    script_name = project_dir.name
    print(f"\n[{script_name}]")
    
    scripts_dir = project_dir / 'scripts'
    if not scripts_dir.exists():
        print(f"  ✗ No scripts directory found")
        return False
    
    # Delete HTML files
    delete_html_files(project_dir)
    
    # Optimize GS files
    optimized = False
    for gs_file in scripts_dir.glob('*.gs'):
        if optimize_script_file(gs_file, script_name):
            optimized = True
    
    return optimized


def main():
    print("=" * 70)
    print("Appsheet GAS Scripts Optimization")
    print("=" * 70)
    print(f"Execution Log Spreadsheet: {EXECUTION_LOG_SPREADSHEET_ID}")
    print(f"API Key: {API_KEY[:20]}...")
    print(f"Flash Model: {FLASH_MODEL}")
    print(f"Pro Model: {PRO_MODEL}")
    print("=" * 70)
    
    gas_projects_dir = Path('gas_projects')
    
    if not gas_projects_dir.exists():
        print("✗ gas_projects directory not found")
        return
    
    # Process all Appsheet projects
    projects = [d for d in gas_projects_dir.iterdir() if d.is_dir() and 'appsheet' in d.name.lower()]
    
    total = len(projects)
    optimized_count = 0
    
    for idx, project_dir in enumerate(sorted(projects), 1):
        print(f"\n[{idx}/{total}] ", end='')
        if optimize_project(project_dir):
            optimized_count += 1
    
    print("\n" + "=" * 70)
    print(f"✓ Optimization complete!")
    print(f"  Total projects: {total}")
    print(f"  Optimized: {optimized_count}")
    print(f"  Skipped: {total - optimized_count}")
    print("=" * 70)


if __name__ == '__main__':
    main()
