#!/bin/bash
#
# 看護系5プロジェクト 一括デプロイスクリプト
#
# Vector DB同期機能を統合した看護系プロジェクトを一括デプロイします。
#

set -e  # エラー時に即座に終了

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ベースディレクトリ
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NURSING_BASE="${BASE_DIR}/gas_projects/projects/nursing"

# 対象プロジェクト
PROJECTS=(
    "Appsheet_訪問看護_書類仕分け"
    "Appsheet_訪問看護_計画書問題点"
    "Appsheet_訪問看護_計画書問題点_評価"
    "Appsheet_訪問看護_報告書"
    "Appsheet_訪問看護_定期スケジュール"
)

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}看護系5プロジェクト 一括デプロイスクリプト${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# DRY RUNモードのチェック
DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}🔍 DRY RUN モード（実際のデプロイは行いません）${NC}"
    echo ""
fi

# clasp がインストールされているか確認
if ! command -v clasp &> /dev/null; then
    echo -e "${RED}❌ エラー: clasp がインストールされていません${NC}"
    echo ""
    echo "インストール方法:"
    echo "  npm install -g @google/clasp"
    exit 1
fi

# clasp ログイン状態を確認
if ! clasp login --status &> /dev/null; then
    echo -e "${YELLOW}⚠️  clasp にログインしていません${NC}"
    echo ""
    echo "ログイン方法:"
    echo "  clasp login"
    exit 1
fi

echo -e "${GREEN}✅ clasp ログイン確認完了${NC}"
echo ""

# デプロイカウンター
SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
TOTAL_COUNT=${#PROJECTS[@]}

# 各プロジェクトをデプロイ
for PROJECT in "${PROJECTS[@]}"; do
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}📁 ${PROJECT}${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    PROJECT_DIR="${NURSING_BASE}/${PROJECT}"

    # プロジェクトディレクトリの存在確認
    if [[ ! -d "${PROJECT_DIR}" ]]; then
        echo -e "${RED}   ❌ プロジェクトディレクトリが見つかりません${NC}"
        ((SKIP_COUNT++))
        echo ""
        continue
    fi

    # .clasp.json の存在確認
    if [[ ! -f "${PROJECT_DIR}/.clasp.json" ]]; then
        echo -e "${YELLOW}   ⚠️  .clasp.json が見つかりません（スキップ）${NC}"
        ((SKIP_COUNT++))
        echo ""
        continue
    fi

    # vector_db_sync.gs の存在確認
    if [[ ! -f "${PROJECT_DIR}/scripts/vector_db_sync.gs" ]]; then
        echo -e "${YELLOW}   ⚠️  vector_db_sync.gs が見つかりません（スキップ）${NC}"
        ((SKIP_COUNT++))
        echo ""
        continue
    fi

    echo -e "${GREEN}   ✅ 事前チェック完了${NC}"

    # DRY RUNモードの場合はスキップ
    if [[ "$DRY_RUN" == true ]]; then
        echo -e "${YELLOW}   📝 デプロイ予定（DRY RUN）${NC}"
        ((SUCCESS_COUNT++))
        echo ""
        continue
    fi

    # デプロイ実行
    cd "${PROJECT_DIR}"

    echo -e "${BLUE}   🚀 デプロイ中...${NC}"

    if clasp push 2>&1 | tee /tmp/clasp_push_output.txt; then
        # デプロイ成功
        echo -e "${GREEN}   ✅ デプロイ完了${NC}"
        ((SUCCESS_COUNT++))
    else
        # デプロイ失敗
        echo -e "${RED}   ❌ デプロイ失敗${NC}"
        echo ""
        echo -e "${RED}エラー詳細:${NC}"
        cat /tmp/clasp_push_output.txt
        ((FAIL_COUNT++))
    fi

    cd "${BASE_DIR}"
    echo ""
done

# 結果サマリー
echo -e "${BLUE}============================================================${NC}"

if [[ "$DRY_RUN" == true ]]; then
    echo -e "${BLUE}✅ DRY RUN 完了${NC}"
else
    echo -e "${BLUE}✅ デプロイ完了${NC}"
fi

echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "${GREEN}成功: ${SUCCESS_COUNT}/${TOTAL_COUNT}${NC}"

if [[ $FAIL_COUNT -gt 0 ]]; then
    echo -e "${RED}失敗: ${FAIL_COUNT}/${TOTAL_COUNT}${NC}"
fi

if [[ $SKIP_COUNT -gt 0 ]]; then
    echo -e "${YELLOW}スキップ: ${SKIP_COUNT}/${TOTAL_COUNT}${NC}"
fi

echo ""

if [[ "$DRY_RUN" == false ]]; then
    if [[ $FAIL_COUNT -eq 0 ]]; then
        echo -e "${GREEN}🎉 全プロジェクトのデプロイが成功しました！${NC}"
        echo ""
        echo "次のステップ:"
        echo "1. AppSheetからテストWebhookを送信"
        echo "2. Vector DB Spreadsheetでデータ追加を確認"
        echo "3. 実行ログで正常動作を確認"
    else
        echo -e "${RED}⚠️  一部のプロジェクトでデプロイが失敗しました${NC}"
        echo ""
        echo "失敗したプロジェクトを個別にデプロイしてください:"
        echo "  cd gas_projects/projects/nursing/<PROJECT_NAME>"
        echo "  clasp push"
    fi
else
    echo "実際にデプロイするには、--dry-run オプションを外して実行してください:"
    echo "  bash rag_system/scripts/deploy_nursing_projects.sh"
fi

echo ""
echo -e "${BLUE}============================================================${NC}"

# 終了コード
if [[ $FAIL_COUNT -gt 0 ]]; then
    exit 1
else
    exit 0
fi
