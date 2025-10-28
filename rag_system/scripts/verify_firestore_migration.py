#!/usr/bin/env python3
"""
Firestore移植の検証スクリプト

移植されたデータの統計と整合性を確認します。
"""

import os
import sys
from pathlib import Path
from google.cloud import firestore
from collections import Counter
import json

# プロジェクトルート
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# 環境変数読み込み
from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / "backend" / ".env")

GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "fractal-ecosystem")


def verify_migration():
    """Firestore移植を検証"""
    print("=" * 60)
    print("🔍 Firestore移植検証")
    print("=" * 60)
    print()

    # Firestoreクライアント
    db = firestore.Client(project=GCP_PROJECT_ID)
    collection = db.collection('knowledge_base')

    # ドキュメント数カウント
    print("📊 ドキュメント数を確認...")
    docs = collection.stream()

    total_count = 0
    domains = Counter()
    source_types = Counter()
    has_embedding = 0
    sample_docs = []

    for doc in docs:
        total_count += 1
        data = doc.to_dict()

        # 統計情報収集
        if 'domain' in data:
            domains[data['domain']] += 1
        if 'source_type' in data:
            source_types[data['source_type']] += 1
        if 'embedding' in data:
            has_embedding += 1
            # 埋め込みベクトルの次元数確認（最初の3件のみ）
            if len(sample_docs) < 3:
                embedding = data['embedding']
                if hasattr(embedding, '__len__'):
                    dim = len(embedding)
                else:
                    dim = "unknown"
                sample_docs.append({
                    'id': data.get('id'),
                    'domain': data.get('domain'),
                    'title': data.get('title', '')[:50],
                    'embedding_dim': dim
                })

    print(f"✅ 総ドキュメント数: {total_count:,}")
    print(f"✅ Embeddingあり: {has_embedding:,} ({has_embedding/total_count*100:.1f}%)")
    print()

    # ドメイン別統計
    print("📁 ドメイン別統計:")
    for domain, count in domains.most_common():
        print(f"  - {domain}: {count:,}件")
    print()

    # ソースタイプ別統計
    print("📄 ソースタイプ別統計:")
    for source_type, count in source_types.most_common():
        print(f"  - {source_type}: {count:,}件")
    print()

    # サンプルドキュメント
    print("📝 サンプルドキュメント (先頭3件):")
    for i, doc in enumerate(sample_docs, 1):
        print(f"\n{i}. ID: {doc['id']}")
        print(f"   ドメイン: {doc['domain']}")
        print(f"   タイトル: {doc['title']}")
        print(f"   Embedding次元: {doc['embedding_dim']}")
    print()

    # 期待値との比較
    expected_count = 3193
    difference = total_count - expected_count

    print("=" * 60)
    print("📊 検証結果")
    print("=" * 60)
    print(f"期待件数: {expected_count:,}")
    print(f"実際件数: {total_count:,}")

    if difference == 0:
        print("✅ 完全一致: 全てのドキュメントが正常に移植されました")
    elif difference > 0:
        print(f"⚠️  差分: +{difference}件多い")
    else:
        print(f"⚠️  差分: {difference}件少ない (スキップされた可能性)")

    print()

    # Embeddingの整合性
    if has_embedding == total_count:
        print("✅ Embedding整合性: 全ドキュメントにEmbeddingが存在")
    else:
        missing = total_count - has_embedding
        print(f"⚠️  Embedding欠損: {missing}件のドキュメントにEmbeddingなし")

    print()
    print("=" * 60)


if __name__ == "__main__":
    try:
        verify_migration()
    except Exception as e:
        print(f"\n❌ エラー: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
