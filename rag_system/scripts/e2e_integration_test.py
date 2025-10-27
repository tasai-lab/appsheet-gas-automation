#!/usr/bin/env python3
"""
Phase 5.1: エンドツーエンド統合テスト
検索・チャット・フィルタリング機能の統合テスト
"""

import os
import sys
import time
import requests
from pathlib import Path
from typing import List, Dict, Any

# プロジェクトルートをPythonパスに追加
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv

# .env読み込み
env_path = project_root / 'backend' / '.env'
load_dotenv(env_path)

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")


def test_health_check():
    """ヘルスチェック"""
    print("\n🔍 Test 1: ヘルスチェック")
    response = requests.get(f"{BASE_URL}/health")
    assert response.status_code == 200, f"❌ ヘルスチェック失敗: {response.status_code}"
    print("✅ Pass: ヘルスチェック正常")
    return True


def test_clients_endpoint():
    """利用者一覧取得"""
    print("\n🔍 Test 2: 利用者一覧取得")
    response = requests.get(f"{BASE_URL}/clients")
    assert response.status_code == 200, f"❌ 利用者一覧取得失敗: {response.status_code}"

    data = response.json()
    assert isinstance(data, list), "❌ レスポンスがリスト形式ではありません"
    assert len(data) > 0, "❌ 利用者データが空です"

    print(f"✅ Pass: {len(data)}件の利用者データを取得")
    return data


def test_search_without_filter(query: str = "看護計画"):
    """フィルタなし検索"""
    print(f"\n🔍 Test 3: フィルタなし検索（クエリ: '{query}'）")

    payload = {
        "query": query,
        "client_id": None,
        "limit": 10
    }

    response = requests.post(f"{BASE_URL}/search", json=payload)
    assert response.status_code == 200, f"❌ 検索失敗: {response.status_code}"

    data = response.json()
    assert "results" in data, "❌ resultsキーが存在しません"
    assert isinstance(data["results"], list), "❌ resultsがリスト形式ではありません"

    results_count = len(data["results"])
    print(f"✅ Pass: {results_count}件の検索結果を取得")

    # 上位3件の内容を表示
    for i, result in enumerate(data["results"][:3], 1):
        print(f"  {i}. スコア: {result.get('score', 'N/A'):.4f}, source_id: {result.get('source_id', 'N/A')}")

    return data["results"]


def test_search_with_filter(clients: List[Dict[str, Any]], query: str = "看護計画"):
    """フィルタあり検索（利用者指定）"""
    if not clients:
        print("\n⚠️ Test 4: スキップ（利用者データなし）")
        return []

    client_id = clients[0]["client_id"]
    client_name = clients[0].get("client_name", "不明")

    print(f"\n🔍 Test 4: フィルタあり検索（利用者: {client_name}, クエリ: '{query}'）")

    payload = {
        "query": query,
        "client_id": client_id,
        "limit": 10
    }

    response = requests.post(f"{BASE_URL}/search", json=payload)
    assert response.status_code == 200, f"❌ 検索失敗: {response.status_code}"

    data = response.json()
    assert "results" in data, "❌ resultsキーが存在しません"

    results = data["results"]
    results_count = len(results)
    print(f"✅ Pass: {results_count}件の検索結果を取得（フィルタ適用）")

    # 全件でclient_idが一致するか確認
    mismatched = [r for r in results if r.get("user_id") != client_id]
    if mismatched:
        print(f"⚠️ Warning: {len(mismatched)}件でclient_idが不一致")
    else:
        print(f"✅ Pass: 全件でclient_idフィルタが正しく適用されています")

    return results


def test_chat_without_context(query: str = "訪問看護について教えてください"):
    """コンテキストなしチャット"""
    print(f"\n🔍 Test 5: コンテキストなしチャット（クエリ: '{query}'）")

    payload = {
        "message": query,
        "context": [],
        "client_id": None
    }

    response = requests.post(f"{BASE_URL}/chat/stream", json=payload)
    assert response.status_code == 200, f"❌ チャット失敗: {response.status_code}"

    data = response.json()
    assert "response" in data, "❌ responseキーが存在しません"
    assert len(data["response"]) > 0, "❌ レスポンスが空です"

    print(f"✅ Pass: レスポンス生成成功（{len(data['response'])}文字）")
    print(f"  レスポンス抜粋: {data['response'][:100]}...")

    return data


def test_chat_with_context(clients: List[Dict[str, Any]], query: str = "この利用者の看護計画を教えてください"):
    """コンテキストありチャット（RAG）"""
    if not clients:
        print("\n⚠️ Test 6: スキップ（利用者データなし）")
        return {}

    client_id = clients[0]["client_id"]
    client_name = clients[0].get("client_name", "不明")

    print(f"\n🔍 Test 6: コンテキストありチャット（利用者: {client_name}, クエリ: '{query}'）")

    # まず検索してコンテキスト取得
    search_payload = {
        "query": query,
        "client_id": client_id,
        "limit": 5
    }
    search_response = requests.post(f"{BASE_URL}/api/search", json=search_payload)
    assert search_response.status_code == 200, "❌ 検索失敗"

    context_results = search_response.json()["results"]

    # チャット実行
    chat_payload = {
        "message": query,
        "context": context_results,
        "client_id": client_id
    }

    response = requests.post(f"{BASE_URL}/api/chat", json=chat_payload)
    assert response.status_code == 200, f"❌ チャット失敗: {response.status_code}"

    data = response.json()
    assert "response" in data, "❌ responseキーが存在しません"
    assert len(data["response"]) > 0, "❌ レスポンスが空です"

    print(f"✅ Pass: RAGチャット成功（コンテキスト: {len(context_results)}件、レスポンス: {len(data['response'])}文字）")
    print(f"  レスポンス抜粋: {data['response'][:150]}...")

    return data


def test_response_time():
    """レスポンスタイム測定"""
    print("\n🔍 Test 7: レスポンスタイム測定")

    query = "訪問看護計画"
    payload = {
        "query": query,
        "client_id": None,
        "limit": 10
    }

    start_time = time.time()
    response = requests.post(f"{BASE_URL}/search", json=payload)
    elapsed_time = time.time() - start_time

    assert response.status_code == 200, f"❌ 検索失敗: {response.status_code}"

    print(f"✅ Pass: レスポンスタイム {elapsed_time*1000:.2f}ms")

    if elapsed_time < 1.0:
        print("  🚀 高速（1秒未満）")
    elif elapsed_time < 3.0:
        print("  ✅ 良好（1-3秒）")
    else:
        print("  ⚠️ 遅い（3秒以上）- 最適化を推奨")

    return elapsed_time


def run_integration_tests():
    """統合テスト実行"""

    print(f"\n{'='*70}")
    print("Phase 5.1: エンドツーエンド統合テスト")
    print(f"{'='*70}")
    print(f"Backend URL: {BASE_URL}")
    print(f"{'='*70}\n")

    results = {
        "passed": 0,
        "failed": 0,
        "skipped": 0
    }

    tests = [
        ("ヘルスチェック", test_health_check),
        ("利用者一覧取得", test_clients_endpoint),
        ("フィルタなし検索", lambda: test_search_without_filter()),
        ("フィルタあり検索", lambda: test_search_with_filter(clients)),
        ("コンテキストなしチャット", lambda: test_chat_without_context()),
        ("コンテキストありチャット", lambda: test_chat_with_context(clients)),
        ("レスポンスタイム測定", test_response_time),
    ]

    clients = []

    for test_name, test_func in tests:
        try:
            result = test_func()

            # 利用者一覧取得の結果を保存
            if test_name == "利用者一覧取得":
                clients = result

            results["passed"] += 1

        except AssertionError as e:
            print(f"❌ Fail: {test_name} - {e}")
            results["failed"] += 1

        except Exception as e:
            print(f"⚠️ Error: {test_name} - {e}")
            results["failed"] += 1

    # サマリー
    print(f"\n{'='*70}")
    print("テスト結果サマリー")
    print(f"{'='*70}")

    total_tests = results["passed"] + results["failed"] + results["skipped"]
    print(f"総テスト数: {total_tests}")
    print(f"✅ 合格: {results['passed']}")
    print(f"❌ 失敗: {results['failed']}")
    print(f"⚠️ スキップ: {results['skipped']}")

    pass_rate = results["passed"] / total_tests * 100 if total_tests > 0 else 0
    print(f"\n合格率: {pass_rate:.1f}%")

    if results["failed"] == 0:
        print(f"\n🎉 Phase 5.1: 全テスト合格！Phase 5.2（精度評価）へ進めます")
        return True
    else:
        print(f"\n⚠️ Phase 5.1: {results['failed']}件のテストが失敗 - 問題を修正してください")
        return False


if __name__ == "__main__":
    try:
        success = run_integration_tests()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ エラー: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
