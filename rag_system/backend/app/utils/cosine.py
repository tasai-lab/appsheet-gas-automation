"""
コサイン類似度計算ユーティリティ
"""

import math
from typing import List


def calculate_cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    2つのベクトルのコサイン類似度を計算

    Args:
        vec1: ベクトル1
        vec2: ベクトル2

    Returns:
        コサイン類似度 (0.0 ~ 1.0)

    Raises:
        ValueError: ベクトルの長さが異なる場合
        ValueError: ゼロベクトルの場合
    """
    if len(vec1) != len(vec2):
        raise ValueError(
            f"Vector dimensions don't match: {len(vec1)} vs {len(vec2)}"
        )

    if not vec1 or not vec2:
        raise ValueError("Empty vectors")

    # 内積を計算
    dot_product = sum(a * b for a, b in zip(vec1, vec2))

    # ベクトルのノルムを計算
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))

    # ゼロベクトルチェック
    if norm1 == 0 or norm2 == 0:
        raise ValueError("Zero vector detected")

    # コサイン類似度を計算
    similarity = dot_product / (norm1 * norm2)

    # 浮動小数点誤差で1を超える場合があるのでクリップ
    similarity = max(-1.0, min(1.0, similarity))

    return similarity


def calculate_cosine_similarities(
    query_vec: List[float],
    doc_vecs: List[List[float]]
) -> List[float]:
    """
    クエリベクトルと複数のドキュメントベクトルのコサイン類似度を計算

    Args:
        query_vec: クエリベクトル
        doc_vecs: ドキュメントベクトルのリスト

    Returns:
        コサイン類似度のリスト
    """
    similarities = []

    for doc_vec in doc_vecs:
        try:
            similarity = calculate_cosine_similarity(query_vec, doc_vec)
            similarities.append(similarity)
        except ValueError as e:
            # エラーが発生した場合は類似度0とする
            similarities.append(0.0)

    return similarities
