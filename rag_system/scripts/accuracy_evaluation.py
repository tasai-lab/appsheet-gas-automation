#!/usr/bin/env python3
"""
Phase 5.2: 精度評価
NDCG@10測定、質疑応答精度、検索精度
"""

import os
import sys
import requests
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Tuple

# プロジェクトルートをPythonパスに追加
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv

# .env読み込み
env_path = project_root / 'backend' / '.env'
load_dotenv(env_path)

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")


# テストクエリと期待されるキーワード
TEST_QUERIES = [
    {
        "query": "訪問看護計画",
        "expected_keywords": ["計画書", "問題点", "看護", "目標"],
        "expected_source_types": ["care_plan"],
    },
    {
        "query": "利用者の基本情報",
        "expected_keywords": ["利用者", "基本情報", "氏名", "住所"],
        "expected_source_types": ["client_basic"],
    },
    {
        "query": "通話記録の要約",
        "expected_keywords": ["通話", "要約", "依頼", "アクション"],
        "expected_source_types": ["call_summary"],
    },
    {
        "query": "看護記録",
        "expected_keywords": ["看護", "記録", "訪問", "観察"],
        "expected_source_types": ["nursing_record"],
    },
]


def calculate_ndcg_at_k(relevance_scores: List[float], k: int = 10) -> float:
    """NDCG@K を計算"""
    relevance_scores = relevance_scores[:k]

    if not relevance_scores:
        return 0.0

    # DCG (Discounted Cumulative Gain)
    dcg = sum(
        (2 ** rel - 1) / np.log2(i + 2)
        for i, rel in enumerate(relevance_scores)
    )

    # IDCG (Ideal DCG)
    ideal_relevance = sorted(relevance_scores, reverse=True)
    idcg = sum(
        (2 ** rel - 1) / np.log2(i + 2)
        for i, rel in enumerate(ideal_relevance)
    )

    return dcg / idcg if idcg > 0 else 0.0


def evaluate_search_result(result: Dict[str, Any], expected_keywords: List[str],
                            expected_source_types: List[str]) -> float:
    """検索結果の関連度スコアを計算（0-3）"""
    score = 0.0

    # キーワードマッチング（最大2点）
    text = result.get("text", "").lower()
    keyword_matches = sum(1 for keyword in expected_keywords if keyword.lower() in text)
    score += min(keyword_matches / len(expected_keywords) * 2, 2.0)

    # ソースタイプマッチング（1点）
    source_table = result.get("source_table", "").lower()
    if any(st.lower() in source_table for st in expected_source_types):
        score += 1.0

    return score


def test_search_accuracy():
    """検索精度評価"""
    print("\n" + "="*70)
    print("Phase 5.2-A: 検索精度評価（NDCG@10）")
    print("="*70)

    ndcg_scores = []

    for test_case in TEST_QUERIES:
        query = test_case["query"]
        expected_keywords = test_case["expected_keywords"]
        expected_source_types = test_case["expected_source_types"]

        print(f"\n📊 テストクエリ: '{query}'")

        # 検索実行
        payload = {
            "query": query,
            "client_id": None,
            "limit": 10
        }

        response = requests.post(f"{BASE_URL}/api/search", json=payload)
        if response.status_code != 200:
            print(f"  ❌ 検索失敗: {response.status_code}")
            continue

        results = response.json()["results"]

        # 関連度スコア計算
        relevance_scores = [
            evaluate_search_result(result, expected_keywords, expected_source_types)
            for result in results
        ]

        # NDCG@10 計算
        ndcg = calculate_ndcg_at_k(relevance_scores, k=10)
        ndcg_scores.append(ndcg)

        print(f"  - 結果件数: {len(results)}")
        print(f"  - NDCG@10: {ndcg:.4f}")
        print(f"  - 平均関連度: {np.mean(relevance_scores):.2f}/3.0")

    # 全体平均
    avg_ndcg = np.mean(ndcg_scores) if ndcg_scores else 0.0
    print(f"\n📈 総合NDCG@10: {avg_ndcg:.4f}")

    if avg_ndcg >= 0.8:
        print("✅ 優秀（NDCG >= 0.8）")
    elif avg_ndcg >= 0.6:
        print("✅ 良好（NDCG >= 0.6）")
    elif avg_ndcg >= 0.4:
        print("⚠️ 改善余地あり（NDCG >= 0.4）")
    else:
        print("❌ 要改善（NDCG < 0.4）")

    return avg_ndcg


def test_qa_accuracy():
    """質疑応答精度評価"""
    print("\n" + "="*70)
    print("Phase 5.2-B: 質疑応答精度評価")
    print("="*70)

    qa_tests = [
        {
            "question": "訪問看護計画書の目的は何ですか？",
            "expected_keywords": ["計画", "目標", "問題点", "看護"],
        },
        {
            "question": "利用者の基本情報にはどのような項目がありますか？",
            "expected_keywords": ["氏名", "住所", "生年月日", "電話番号"],
        },
        {
            "question": "看護記録に記載すべき内容は？",
            "expected_keywords": ["観察", "記録", "状態", "対応"],
        },
    ]

    accuracy_scores = []

    for test_case in qa_tests:
        question = test_case["question"]
        expected_keywords = test_case["expected_keywords"]

        print(f"\n📊 質問: '{question}'")

        # チャット実行
        payload = {
            "message": question,
            "context": [],
            "client_id": None
        }

        response = requests.post(f"{BASE_URL}/api/chat", json=payload)
        if response.status_code != 200:
            print(f"  ❌ チャット失敗: {response.status_code}")
            continue

        answer = response.json()["response"]

        # キーワード含有率で精度評価
        keyword_matches = sum(1 for kw in expected_keywords if kw in answer)
        accuracy = keyword_matches / len(expected_keywords)
        accuracy_scores.append(accuracy)

        print(f"  - 回答長: {len(answer)}文字")
        print(f"  - キーワード一致: {keyword_matches}/{len(expected_keywords)}")
        print(f"  - 精度スコア: {accuracy:.2f}")
        print(f"  - 回答抜粋: {answer[:100]}...")

    # 全体平均
    avg_accuracy = np.mean(accuracy_scores) if accuracy_scores else 0.0
    print(f"\n📈 総合QA精度: {avg_accuracy:.2f}")

    if avg_accuracy >= 0.7:
        print("✅ 優秀（精度 >= 0.7）")
    elif avg_accuracy >= 0.5:
        print("✅ 良好（精度 >= 0.5）")
    else:
        print("⚠️ 改善余地あり（精度 < 0.5）")

    return avg_accuracy


def run_accuracy_evaluation():
    """精度評価実行"""

    print(f"\n{'='*70}")
    print("Phase 5.2: 精度評価")
    print(f"{'='*70}")
    print(f"Backend URL: {BASE_URL}")
    print(f"{'='*70}\n")

    try:
        # Phase 5.2-A: 検索精度評価
        ndcg_score = test_search_accuracy()

        # Phase 5.2-B: 質疑応答精度評価
        qa_score = test_qa_accuracy()

        # サマリー
        print(f"\n{'='*70}")
        print("精度評価結果サマリー")
        print(f"{'='*70}")
        print(f"NDCG@10（検索精度）: {ndcg_score:.4f}")
        print(f"QA精度（質疑応答）: {qa_score:.2f}")

        # 総合評価
        overall_score = (ndcg_score + qa_score) / 2

        print(f"\n総合スコア: {overall_score:.3f}")

        if overall_score >= 0.7:
            print("🎉 Phase 5.2: 精度評価合格！Phase 5.3（パフォーマンステスト）へ進めます")
            return True
        else:
            print("⚠️ Phase 5.2: 精度改善を推奨")
            return False

    except Exception as e:
        print(f"❌ エラー: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    try:
        success = run_accuracy_evaluation()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ エラー: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
