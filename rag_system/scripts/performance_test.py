#!/usr/bin/env python3
"""
Phase 5.3: パフォーマンステスト
レイテンシ測定、スループット測定、ストレステスト
"""

import os
import sys
import time
import requests
import statistics
from pathlib import Path
from typing import List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed

# プロジェクトルートをPythonパスに追加
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv

# .env読み込み
env_path = project_root / 'backend' / '.env'
load_dotenv(env_path)

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")


def measure_search_latency(query: str, iterations: int = 10) -> Dict[str, float]:
    """検索レイテンシ測定"""
    latencies = []

    payload = {
        "query": query,
        "client_id": None,
        "limit": 10
    }

    for i in range(iterations):
        start_time = time.time()
        response = requests.post(f"{BASE_URL}/api/search", json=payload)
        elapsed_time = time.time() - start_time

        if response.status_code == 200:
            latencies.append(elapsed_time)
        else:
            print(f"  ⚠️ リクエスト失敗: {response.status_code}")

    return {
        "min": min(latencies) * 1000 if latencies else 0,
        "max": max(latencies) * 1000 if latencies else 0,
        "mean": statistics.mean(latencies) * 1000 if latencies else 0,
        "median": statistics.median(latencies) * 1000 if latencies else 0,
        "p95": statistics.quantiles(latencies, n=20)[18] * 1000 if len(latencies) >= 20 else 0,
        "p99": statistics.quantiles(latencies, n=100)[98] * 1000 if len(latencies) >= 100 else 0,
    }


def test_latency():
    """レイテンシテスト"""
    print("\n" + "="*70)
    print("Phase 5.3-A: レイテンシ測定")
    print("="*70)

    test_queries = [
        "訪問看護計画",
        "利用者基本情報",
        "通話記録要約",
    ]

    all_results = []

    for query in test_queries:
        print(f"\n📊 テストクエリ: '{query}'（10回実行）")

        results = measure_search_latency(query, iterations=10)
        all_results.append(results)

        print(f"  - 最小: {results['min']:.2f}ms")
        print(f"  - 最大: {results['max']:.2f}ms")
        print(f"  - 平均: {results['mean']:.2f}ms")
        print(f"  - 中央値: {results['median']:.2f}ms")
        print(f"  - P95: {results['p95']:.2f}ms" if results['p95'] > 0 else "  - P95: N/A")

    # 全体平均
    avg_latency = statistics.mean([r['mean'] for r in all_results])
    print(f"\n📈 総合平均レイテンシ: {avg_latency:.2f}ms")

    if avg_latency < 500:
        print("✅ 優秀（< 500ms）")
    elif avg_latency < 1000:
        print("✅ 良好（< 1000ms）")
    elif avg_latency < 2000:
        print("⚠️ 改善余地あり（< 2000ms）")
    else:
        print("❌ 要改善（>= 2000ms）")

    return avg_latency


def measure_throughput(query: str, concurrent_requests: int = 10, duration_sec: int = 30) -> Dict[str, Any]:
    """スループット測定"""
    def send_request():
        payload = {
            "query": query,
            "client_id": None,
            "limit": 10
        }
        start_time = time.time()
        try:
            response = requests.post(f"{BASE_URL}/api/search", json=payload, timeout=10)
            elapsed_time = time.time() - start_time
            return {
                "success": response.status_code == 200,
                "latency": elapsed_time,
                "status_code": response.status_code
            }
        except Exception as e:
            return {
                "success": False,
                "latency": time.time() - start_time,
                "error": str(e)
            }

    start_time = time.time()
    end_time = start_time + duration_sec
    results = []

    with ThreadPoolExecutor(max_workers=concurrent_requests) as executor:
        futures = []

        while time.time() < end_time:
            # 同時リクエスト送信
            for _ in range(concurrent_requests):
                if time.time() >= end_time:
                    break
                future = executor.submit(send_request)
                futures.append(future)

            # 少し待機してから次のバッチ
            time.sleep(0.5)

        # 全リクエスト完了を待つ
        for future in as_completed(futures):
            results.append(future.result())

    total_duration = time.time() - start_time
    successful_requests = sum(1 for r in results if r["success"])
    failed_requests = len(results) - successful_requests

    return {
        "total_requests": len(results),
        "successful_requests": successful_requests,
        "failed_requests": failed_requests,
        "success_rate": successful_requests / len(results) * 100 if results else 0,
        "throughput_rps": successful_requests / total_duration,
        "avg_latency": statistics.mean([r["latency"] for r in results if r["success"]]) * 1000 if successful_requests > 0 else 0,
    }


def test_throughput():
    """スループットテスト"""
    print("\n" + "="*70)
    print("Phase 5.3-B: スループット測定")
    print("="*70)

    query = "訪問看護計画"
    concurrent_requests = 5
    duration_sec = 10

    print(f"\n📊 並行リクエスト数: {concurrent_requests}")
    print(f"📊 測定時間: {duration_sec}秒")
    print(f"📊 テストクエリ: '{query}'")
    print("\n⏳ 測定中...\n")

    results = measure_throughput(query, concurrent_requests, duration_sec)

    print(f"  - 総リクエスト数: {results['total_requests']}")
    print(f"  - 成功: {results['successful_requests']}")
    print(f"  - 失敗: {results['failed_requests']}")
    print(f"  - 成功率: {results['success_rate']:.1f}%")
    print(f"  - スループット: {results['throughput_rps']:.2f} req/s")
    print(f"  - 平均レイテンシ: {results['avg_latency']:.2f}ms")

    if results['success_rate'] >= 99 and results['throughput_rps'] >= 5:
        print("\n✅ 優秀（成功率 >= 99%, スループット >= 5 req/s）")
    elif results['success_rate'] >= 95 and results['throughput_rps'] >= 3:
        print("\n✅ 良好（成功率 >= 95%, スループット >= 3 req/s）")
    else:
        print("\n⚠️ 改善余地あり")

    return results


def test_stress():
    """ストレステスト"""
    print("\n" + "="*70)
    print("Phase 5.3-C: ストレステスト")
    print("="*70)

    query = "看護記録"
    max_concurrent = 20

    print(f"\n📊 テストクエリ: '{query}'")
    print(f"📊 最大並行数: {max_concurrent}")
    print("\n⏳ 測定中...\n")

    stress_results = []

    for concurrent in [1, 5, 10, 15, 20]:
        print(f"  🔄 並行数: {concurrent}")

        results = measure_throughput(query, concurrent, duration_sec=5)

        stress_results.append({
            "concurrent": concurrent,
            "throughput": results['throughput_rps'],
            "success_rate": results['success_rate'],
            "avg_latency": results['avg_latency']
        })

        print(f"    - スループット: {results['throughput_rps']:.2f} req/s")
        print(f"    - 成功率: {results['success_rate']:.1f}%")
        print(f"    - 平均レイテンシ: {results['avg_latency']:.2f}ms\n")

    # 最適並行数の推定
    best_throughput = max(stress_results, key=lambda x: x['throughput'])
    print(f"\n📈 最適並行数: {best_throughput['concurrent']}")
    print(f"   最大スループット: {best_throughput['throughput']:.2f} req/s")

    return stress_results


def run_performance_test():
    """パフォーマンステスト実行"""

    print(f"\n{'='*70}")
    print("Phase 5.3: パフォーマンステスト")
    print(f"{'='*70}")
    print(f"Backend URL: {BASE_URL}")
    print(f"{'='*70}\n")

    try:
        # Phase 5.3-A: レイテンシ測定
        avg_latency = test_latency()

        # Phase 5.3-B: スループット測定
        throughput_results = test_throughput()

        # Phase 5.3-C: ストレステスト
        stress_results = test_stress()

        # サマリー
        print(f"\n{'='*70}")
        print("パフォーマンステスト結果サマリー")
        print(f"{'='*70}")
        print(f"平均レイテンシ: {avg_latency:.2f}ms")
        print(f"スループット: {throughput_results['throughput_rps']:.2f} req/s")
        print(f"成功率: {throughput_results['success_rate']:.1f}%")

        # 総合評価
        if (avg_latency < 1000 and
            throughput_results['throughput_rps'] >= 5 and
            throughput_results['success_rate'] >= 99):
            print("\n🎉 Phase 5.3: パフォーマンステスト合格！")
            print("次のPhase: Phase 4.4（Vercelデプロイ）")
            return True
        elif (avg_latency < 2000 and
              throughput_results['throughput_rps'] >= 3 and
              throughput_results['success_rate'] >= 95):
            print("\n✅ Phase 5.3: 良好 - 本番環境でのチューニングを推奨")
            return True
        else:
            print("\n⚠️ Phase 5.3: パフォーマンス改善を推奨")
            return False

    except Exception as e:
        print(f"❌ エラー: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    try:
        success = run_performance_test()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ エラー: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
