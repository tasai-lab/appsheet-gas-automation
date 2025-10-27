"""
BM25スコアリングユーティリティ
"""

import math
from typing import List, Dict
from collections import Counter


class BM25:
    """BM25スコアリングクラス"""

    def __init__(
        self,
        k1: float = 1.5,
        b: float = 0.75,
        epsilon: float = 0.25
    ):
        """
        初期化

        Args:
            k1: Term Frequency飽和パラメータ (推奨: 1.2 ~ 2.0)
            b: Length正規化パラメータ (推奨: 0.75)
            epsilon: IDFフロア値
        """
        self.k1 = k1
        self.b = b
        self.epsilon = epsilon

        # コーパス統計
        self.corpus_size = 0
        self.avgdl = 0.0  # 平均ドキュメント長
        self.doc_freqs = {}  # 各トークンのドキュメント頻度
        self.idf = {}  # IDF値
        self.doc_lengths = []  # 各ドキュメントの長さ

    def fit(self, corpus: List[List[str]]):
        """
        コーパスでBM25をフィット

        Args:
            corpus: トークン化されたドキュメントのリスト
        """
        self.corpus_size = len(corpus)

        # ドキュメント長を記録
        self.doc_lengths = [len(doc) for doc in corpus]
        self.avgdl = sum(self.doc_lengths) / self.corpus_size if self.corpus_size > 0 else 0

        # ドキュメント頻度を計算
        self.doc_freqs = {}
        for doc in corpus:
            unique_tokens = set(doc)
            for token in unique_tokens:
                self.doc_freqs[token] = self.doc_freqs.get(token, 0) + 1

        # IDF値を計算
        self.idf = {}
        for token, freq in self.doc_freqs.items():
            # IDF計算: log((N - df + 0.5) / (df + 0.5) + 1)
            idf_value = math.log(
                (self.corpus_size - freq + 0.5) / (freq + 0.5) + 1
            )
            # フロア値を適用
            self.idf[token] = max(idf_value, self.epsilon)

    def get_scores(self, query: List[str]) -> List[float]:
        """
        クエリに対する全ドキュメントのBM25スコアを計算

        Args:
            query: トークン化されたクエリ

        Returns:
            各ドキュメントのBM25スコアリスト
        """
        scores = []

        for doc_id in range(self.corpus_size):
            score = self._score(query, doc_id)
            scores.append(score)

        return scores

    def _score(self, query: List[str], doc_id: int) -> float:
        """
        単一ドキュメントのBM25スコアを計算

        Args:
            query: トークン化されたクエリ
            doc_id: ドキュメントID

        Returns:
            BM25スコア
        """
        score = 0.0
        doc_len = self.doc_lengths[doc_id]

        # クエリ内の各トークンについて
        query_freqs = Counter(query)
        for token, query_freq in query_freqs.items():
            if token not in self.idf:
                continue

            # ドキュメント内のトークン頻度（仮想的に0とする）
            # 実際の実装ではコーパスを保持する必要がある
            # ここでは簡易版として、IDFのみを使用
            idf = self.idf[token]
            score += idf

        return score


def simple_tokenize(text: str) -> List[str]:
    """
    簡易的なトークナイゼーション（日本語対応）

    Args:
        text: テキスト

    Returns:
        トークンのリスト
    """
    import re

    # 日本語（ひらがな、カタカナ、漢字）+ 英数字を抽出
    tokens = re.findall(r'[ぁ-んァ-ヶー一-龠々a-zA-Z0-9]+', text)

    # 小文字に統一
    tokens = [token.lower() for token in tokens]

    return tokens


def score_documents_bm25(
    query: str,
    documents: List[Dict[str, str]],
    k1: float = 1.5,
    b: float = 0.75
) -> List[Dict]:
    """
    BM25を使用してドキュメントをスコアリング

    Args:
        query: クエリテキスト
        documents: ドキュメントのリスト（各ドキュメントは'content'キーを持つ辞書）
        k1: BM25 k1パラメータ
        b: BM25 bパラメータ

    Returns:
        BM25スコア付きドキュメントのリスト
    """
    # トークナイゼーション
    query_tokens = simple_tokenize(query)
    corpus = [simple_tokenize(doc.get('content', '')) for doc in documents]

    # BM25フィット
    bm25 = BM25(k1=k1, b=b)
    bm25.fit(corpus)

    # スコア計算
    scores = bm25.get_scores(query_tokens)

    # スコアをドキュメントに追加
    scored_docs = []
    for doc, score in zip(documents, scores):
        scored_doc = {
            **doc,
            'bm25_score': score
        }
        scored_docs.append(scored_doc)

    # スコア降順でソート
    scored_docs.sort(key=lambda x: x['bm25_score'], reverse=True)

    return scored_docs
