"""
医療用語処理サービス

医療用語の抽出、シノニム展開、用語提案を提供します。
"""

import logging
import re
from typing import List, Dict, Any, Set, Optional
from functools import lru_cache

from app.config import get_settings
from app.services.spreadsheet import get_spreadsheet_client

logger = logging.getLogger(__name__)
settings = get_settings()


class MedicalTermsService:
    """医療用語処理サービス"""

    def __init__(self):
        """初期化"""
        self.spreadsheet_client = get_spreadsheet_client()
        self._terms_cache: Optional[List[Dict[str, Any]]] = None
        self._canonical_map: Optional[Dict[str, Dict[str, Any]]] = None
        self._synonym_map: Optional[Dict[str, str]] = None

        logger.info("Medical Terms Service initialized")

    def load_terms(self) -> List[Dict[str, Any]]:
        """
        医療用語辞書を読み込み（キャッシュ付き）

        Returns:
            医療用語レコードのリスト
        """
        if self._terms_cache is None:
            self._terms_cache = self.spreadsheet_client.read_medical_terms()
            self._build_maps()

        return self._terms_cache

    def _build_maps(self):
        """内部マップを構築"""
        if self._terms_cache is None:
            return

        self._canonical_map = {}
        self._synonym_map = {}

        for term in self._terms_cache:
            canonical = term.get('canonical', '')
            synonyms = term.get('synonyms', [])

            # canonical_mapを構築
            self._canonical_map[canonical] = term

            # synonym_mapを構築（シノニム → canonical）
            self._synonym_map[canonical] = canonical

            if isinstance(synonyms, list):
                for synonym in synonyms:
                    self._synonym_map[synonym] = canonical
            elif isinstance(synonyms, str):
                # JSONパースされていない場合
                import json
                try:
                    synonyms_list = json.loads(synonyms)
                    for synonym in synonyms_list:
                        self._synonym_map[synonym] = canonical
                except json.JSONDecodeError:
                    pass

        logger.info(
            f"Built maps - Canonical: {len(self._canonical_map)}, "
            f"Synonyms: {len(self._synonym_map)}"
        )

    def extract_medical_terms(self, text: str) -> List[str]:
        """
        テキストから医療用語を抽出

        Args:
            text: 入力テキスト

        Returns:
            抽出された医療用語のリスト（canonical形式）
        """
        if not self._synonym_map:
            self.load_terms()

        extracted_terms = []

        # 辞書に登録されている全ての用語（canonical + synonyms）でマッチング
        for term, canonical in self._synonym_map.items():
            if term in text:
                extracted_terms.append(canonical)

        # 重複を除去してユニークなリストを返す
        unique_terms = list(dict.fromkeys(extracted_terms))

        logger.debug(f"Extracted {len(unique_terms)} medical terms from text")
        return unique_terms

    def expand_synonyms(
        self,
        terms: List[str],
        max_synonyms: Optional[int] = None
    ) -> List[str]:
        """
        医療用語をシノニムに展開

        Args:
            terms: canonical形式の医療用語リスト
            max_synonyms: 展開する最大シノニム数（Noneの場合は全て）

        Returns:
            展開されたシノニムリスト
        """
        if not self._canonical_map:
            self.load_terms()

        if max_synonyms is None:
            max_synonyms = settings.medical_terms_max_synonyms

        expanded = []

        for term in terms:
            # canonicalを追加
            expanded.append(term)

            # シノニムを追加
            term_entry = self._canonical_map.get(term)
            if term_entry:
                synonyms = term_entry.get('synonyms', [])
                if isinstance(synonyms, list):
                    expanded.extend(synonyms[:max_synonyms])

        logger.debug(f"Expanded {len(terms)} terms to {len(expanded)} terms")
        return expanded

    def suggest_alternative_terms(
        self,
        query: str,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        代替用語を提案

        Args:
            query: クエリテキスト
            top_k: 返す提案数

        Returns:
            提案リスト
        """
        if not self._canonical_map:
            self.load_terms()

        # クエリから医療用語を抽出
        extracted_terms = self.extract_medical_terms(query)

        suggestions = []

        for term in extracted_terms:
            term_entry = self._canonical_map.get(term)
            if term_entry:
                synonyms = term_entry.get('synonyms', [])
                if isinstance(synonyms, list):
                    suggestions.append({
                        'original': term,
                        'canonical': term,
                        'alternatives': synonyms[:3],  # Top 3
                        'category': term_entry.get('category', ''),
                        'frequency': term_entry.get('frequency', 0)
                    })

        # 頻度順でソート
        suggestions.sort(key=lambda x: x['frequency'], reverse=True)

        logger.info(f"Generated {len(suggestions)} alternative term suggestions")
        return suggestions[:top_k]

    def enrich_query(self, query: str) -> Dict[str, Any]:
        """
        クエリを医療用語で拡張

        Args:
            query: 元のクエリ

        Returns:
            拡張情報を含む辞書
            {
                'original_query': str,
                'extracted_terms': List[str],
                'expanded_terms': List[str],
                'enriched_query': str
            }
        """
        # 医療用語を抽出
        extracted_terms = self.extract_medical_terms(query)

        # シノニムに展開
        expanded_terms = self.expand_synonyms(extracted_terms)

        # 拡張クエリを構築（元のクエリ + 展開された用語）
        enriched_query = f"{query} {' '.join(expanded_terms)}"

        return {
            'original_query': query,
            'extracted_terms': extracted_terms,
            'expanded_terms': expanded_terms,
            'enriched_query': enriched_query
        }


# モジュールレベルのシングルトン
_medical_terms_service: Optional[MedicalTermsService] = None


def get_medical_terms_service() -> MedicalTermsService:
    """
    医療用語サービスを取得（シングルトン）

    Returns:
        MedicalTermsService: 医療用語サービス
    """
    global _medical_terms_service
    if _medical_terms_service is None:
        _medical_terms_service = MedicalTermsService()
    return _medical_terms_service
