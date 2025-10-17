#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
processRequest関数をparamsオブジェクトから個別引数に変更するスクリプト

AppSheetとの連携を改善するため、各関数が個別の引数を直接受け取るように修正します。
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Tuple
import json

# プロジェクトのルートディレクトリ
PROJECT_ROOT = Path(__file__).parent.parent
GAS_PROJECTS_DIR = PROJECT_ROOT / "gas_projects"


# 各プロジェクトの引数定義
PROJECT_PARAMS = {
    "Appsheet_通話_ファイルID取得": ["callId", "folderId", "filePath"],
    "Appsheet_関係機関_作成": ["orgId", "commonName", "fullAddress"],
    "Appsheet_通話_要約生成": ["callId", "callDatetime", "filePath", "fileId", "callContextText", "userInfoText", "clientId"],
    "Appsheet_通話_新規依頼作成": [
        "callId", "callDatetime", "summary", "fullTranscript", "request_ids",
        "requesterOrgId", "requesterId", "creatorId",
        "existing_request_reason", "existing_client_info", "existing_next_action"
    ],
    "Appsheet_通話_タスク作成": ["actionId", "title", "details", "dueDateTime", "assigneeEmail"],
    "Appsheet_通話_スレッド投稿": [
        "queryId", "targetThreadId", "targetSpaceId", "questionText",
        "answerText", "posterName", "posterEmail", "rowUrl"
    ],
    "Appsheet_通話_クエリ": [
        "queryId", "promptText", "callSummary", "callTranscript",
        "call_info", "modelKeyword"
    ],
    "Appsheet_通話_イベント作成": [
        "actionId", "title", "details", "startDateTime",
        "endDateTime", "assigneeEmail", "rowUrl"
    ],
    "Appsheet_訪問看護_通常記録": [
        "recordNoteId", "staffId", "recordText", "recordType", "filePath", "fileId"
    ],
    "Appsheet_訪問看護_計画書問題点_評価": [
        "problemId", "planText", "latestRecords", "statusToSet", "staffId"
    ],
    "Appsheet_訪問看護_計画書問題点": [
        "problemId", "contextText", "problemPoint", "problemIdentifiedDate"
    ],
    "Appsheet_訪問看護_精神科記録": [
        "recordNoteId", "staffId", "recordText", "fileId"
    ],
    "Appsheet_訪問看護_書類仕分け": [
        "documentId", "clientId", "documentType", "staffId",
        "ocrText", "driveFileId", "clientBirthDate", "clientName", "staffName"
    ],
    "Appsheet_訪問看護_書類OCR": [
        "recordId", "fileId", "documentType"
    ],
    "Appsheet_訪問看護_報告書": [
        "reportId", "clientId", "reportMonth", "recordsText", "staffId"
    ],
    "Appsheet_訪問看護_定期スケジュール": [
        "scheduleId", "clientId", "visitPattern", "startDate", "endDate"
    ],
    "Appsheet_訪問看護_訪問者自動": [
        "visitId", "clientId", "visitDate", "staffId"
    ],
    "Appsheet_営業_音声記録": [
        "recordId", "fileId", "salesmanId", "customerInfo"
    ],
    "Appsheet_営業_ファイルID取得": [
        "recordId", "folderId", "fileName"
    ],
    "Appsheet_営業レポート": [
        "reportId", "salesmanId", "visitDate", "customerName", "reportText"
    ],
    "Appsheet_利用者_質疑応答": [
        "qaId", "userId", "question", "contextInfo"
    ],
    "Appsheet_利用者_家族情報作成": [
        "userId", "familyInfo", "relationship"
    ],
    "Appsheet_利用者_基本情報上書き": [
        "userId", "basicInfo", "updateFields"
    ],
    "Appsheet_利用者_反映": [
        "userId", "sourceData", "targetTable"
    ],
    "Appsheet_利用者_フェースシート": [
        "userId", "sheetData", "sheetType"
    ],
    "Appsheet_名刺取り込み": [
        "cardId", "imageId", "ocrText"
    ],
    "Appsheet_All_ファイル検索＋ID挿入": [
        "searchQuery", "folderId", "targetTable"
    ],
    "AppSheet_ALL_ファイルID": [
        "fileName", "folderId"
    ],
    "Appsheet_ALL_スレッド更新": [
        "threadId", "updateText", "userId"
    ],
    "Appsheet_ALL_スレッド投稿": [
        "threadId", "messageText", "userId"
    ],
    "Appsheet_ALL_Event": [
        "eventType", "eventData", "timestamp"
    ]
}


def extract_params_usage(code: str) -> List[str]:
    """
    コードから実際に使用されているparams.xxxを抽出

    Args:
        code: 解析するコード

    Returns:
        使用されているパラメータ名のリスト
    """
    # params.xxx または params['xxx'] の形式を抽出
    pattern1 = r'params\.(\w+)'
    pattern2 = r"params\['([^']+)'\]"
    pattern3 = r'params\["([^"]+)"\]'

    params = set()

    for pattern in [pattern1, pattern2, pattern3]:
        matches = re.findall(pattern, code)
        params.update(matches)

    # scriptName, timestamp, requestMethodなどの共通パラメータは除外
    exclude_params = {'scriptName', 'timestamp', 'requestMethod', 'enableDuplicationCheck', 'processId'}
    params = params - exclude_params

    return sorted(list(params))


def refactor_process_request(code: str, project_name: str) -> Tuple[str, List[str]]:
    """
    processRequest関数を個別引数に変更

    Args:
        code: 元のコード
        project_name: プロジェクト名

    Returns:
        (修正後のコード, 使用されたパラメータリスト)
    """
    # プロジェクトのパラメータリストを取得
    if project_name in PROJECT_PARAMS:
        params_list = PROJECT_PARAMS[project_name]
    else:
        # 定義がない場合はコードから抽出
        params_list = extract_params_usage(code)
        if not params_list:
            print(f"  [WARNING] {project_name} のパラメータを検出できませんでした")
            return code, []

    # processRequest関数のシグネチャを変更
    # パターン1: function processRequest(params) {
    pattern1 = r'function\s+processRequest\s*\(\s*params\s*\)\s*\{'

    # 新しいシグネチャを作成（全パラメータをオプションにする）
    new_signature = f"function processRequest({', '.join(params_list)}) {{"

    # 関数シグネチャを置換
    new_code = re.sub(pattern1, new_signature, code)

    if new_code == code:
        print(f"  [INFO] {project_name} のprocessRequest関数シグネチャの変更なし")
        return code, params_list

    # params.xxx を直接変数参照に変更
    for param in params_list:
        # params.param を param に置換
        new_code = re.sub(rf'params\.{param}\b', param, new_code)
        # params['param'] を param に置換
        new_code = re.sub(rf"params\['{param}'\]", param, new_code)
        # params["param"] を param に置換
        new_code = re.sub(rf'params\["{param}"\]', param, new_code)

    # const xxx = params.xxx; の行を削除
    for param in params_list:
        # const param = params.param; の行を削除
        new_code = re.sub(rf'^\s*const\s+{param}\s*=\s*params\.{param}\s*;\s*\n', '', new_code, flags=re.MULTILINE)

    return new_code, params_list


def refactor_dopost(code: str, params_list: List[str]) -> str:
    """
    doPost関数を修正してprocessRequestに個別引数を渡すようにする

    Args:
        code: 元のコード
        params_list: processRequestが受け取る引数のリスト

    Returns:
        修正後のコード
    """
    if not params_list:
        return code

    # doPost関数内のprocessRequest呼び出しを探す
    # パターン1: return processRequest(params);
    pattern1 = r'return\s+processRequest\s*\(\s*params\s*\)'

    # 個別引数を渡す形式に変更
    param_access = ', '.join([f'params.{p} || params.data?.{p}' for p in params_list])
    new_call = f"return processRequest({param_access})"

    new_code = re.sub(pattern1, new_call, code)

    # パターン2: const result = processFunction(params);
    pattern2 = r'processFunction\s*\(\s*params\s*\)'

    # まず processFunction の存在を確認
    if 'processFunction' in code:
        # CommonWebhook.handleDoPost を使っている場合
        # processFunction内でprocessRequestを呼び出すように修正

        # function(params) { ... return processRequest(params); } の形式を探す
        pattern3 = r'function\s*\(\s*params\s*\)\s*\{([^}]*?)return\s+processRequest\s*\(\s*params\s*\)([^}]*?)\}'

        def replace_func(match):
            before = match.group(1)
            after = match.group(2)
            param_extraction = '\n    '.join([f'const {p} = params.{p} || params.data?.{p};' for p in params_list])
            param_pass = ', '.join(params_list)
            return f"function(params) {{{before}\n    // 個別パラメータを抽出\n    {param_extraction}\n    return processRequest({param_pass}){after}}}"

        new_code = re.sub(pattern3, replace_func, new_code)

    return new_code


def refactor_test_function(code: str, params_list: List[str]) -> str:
    """
    testProcessRequest関数を修正

    Args:
        code: 元のコード
        params_list: processRequestが受け取る引数のリスト

    Returns:
        修正後のコード
    """
    if not params_list or 'testProcessRequest' not in code:
        return code

    # testProcessRequest関数内のprocessRequest呼び出しを探す
    pattern = r'return\s+processRequest\s*\(\s*testParams\s*\)'

    # 個別引数を渡す形式に変更
    param_access = ', '.join([f'testParams.{p}' for p in params_list])
    new_call = f"return processRequest({param_access})"

    new_code = re.sub(pattern, new_call, code)

    # CommonTest.runTest の呼び出しも修正
    if 'CommonTest.runTest' in new_code:
        # runTest(processRequest, testParams, ...) の形式を
        # runTest((params) => processRequest(...), testParams, ...) に変更

        pattern2 = r'CommonTest\.runTest\s*\(\s*processRequest\s*,\s*testParams'

        # ラムダ関数でラップ
        param_access = ', '.join([f'params.{p}' for p in params_list])
        new_call = f"CommonTest.runTest((params) => processRequest({param_access}), testParams"

        new_code = re.sub(pattern2, new_call, new_code)

    return new_code


def process_file(file_path: Path) -> bool:
    """
    ファイルを処理

    Args:
        file_path: 処理するファイルのパス

    Returns:
        変更があった場合True
    """
    # プロジェクト名を取得
    project_name = file_path.parts[-3]  # gas_projects/PROJECT_NAME/scripts/xxx.gs

    # コードを読み込み
    with open(file_path, 'r', encoding='utf-8') as f:
        original_code = f.read()

    # processRequest関数がない場合はスキップ
    if 'function processRequest' not in original_code:
        return False

    print(f"\n処理中: {project_name}/{file_path.name}")

    # processRequest関数を修正
    modified_code, params_list = refactor_process_request(original_code, project_name)

    if params_list:
        print(f"  パラメータ: {', '.join(params_list)}")

        # doPost関数も修正
        modified_code = refactor_dopost(modified_code, params_list)

        # テスト関数も修正
        modified_code = refactor_test_function(modified_code, params_list)

    # 変更があった場合のみ書き込み
    if modified_code != original_code:
        # バックアップを作成
        backup_path = file_path.with_suffix('.gs.backup_individual_params')
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(original_code)

        # 修正したコードを書き込み
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(modified_code)

        print(f"  [OK] 修正完了 (バックアップ: {backup_path.name})")
        return True
    else:
        print(f"  [INFO] 変更なし")
        return False


def main():
    """メイン処理"""
    print("=" * 60)
    print("processRequest関数を個別引数に変更")
    print("=" * 60)

    # 処理対象ファイルを検索
    target_files = []
    for project_dir in GAS_PROJECTS_DIR.iterdir():
        if project_dir.is_dir() and project_dir.name != "共通モジュール":
            scripts_dir = project_dir / "scripts"
            if scripts_dir.exists():
                # コード.gs または main.gs を対象とする
                for file_name in ["コード.gs", "main.gs", "core_webhook.gs", "core_webhook_v3.gs"]:
                    file_path = scripts_dir / file_name
                    if file_path.exists():
                        target_files.append(file_path)

    print(f"\n対象ファイル数: {len(target_files)}")

    # 各ファイルを処理
    modified_count = 0
    for file_path in target_files:
        if process_file(file_path):
            modified_count += 1

    print("\n" + "=" * 60)
    print(f"処理結果: {modified_count}/{len(target_files)} ファイルを修正")

    if modified_count > 0:
        print("\n[SUCCESS] 個別引数への変更が完了しました。")
        print("          AppSheetからの直接呼び出しがより簡単になりました。")


if __name__ == "__main__":
    main()