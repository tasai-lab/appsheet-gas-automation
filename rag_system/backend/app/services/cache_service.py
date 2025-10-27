"""
キャッシュサービス

API使用量を削減するためのキャッシュ機能を提供します。
"""

import hashlib
import json
import logging
import time
from typing import Any, Dict, List, Optional, Callable
from datetime import datetime, timedelta
from functools import wraps

logger = logging.getLogger(__name__)


class CacheEntry:
    """キャッシュエントリ"""

    def __init__(self, value: Any, ttl: int):
        """
        初期化

        Args:
            value: キャッシュする値
            ttl: 有効期限（秒）
        """
        self.value = value
        self.created_at = time.time()
        self.expires_at = self.created_at + ttl
        self.hits = 0
        self.last_accessed = time.time()

    def is_expired(self) -> bool:
        """有効期限が切れているか確認"""
        return time.time() > self.expires_at

    def get_value(self) -> Any:
        """値を取得（ヒット数とアクセス時刻を更新）"""
        self.hits += 1
        self.last_accessed = time.time()
        return self.value


class CacheService:
    """キャッシュサービス"""

    def __init__(self, max_size: int = 1000):
        """
        初期化

        Args:
            max_size: 最大キャッシュエントリ数
        """
        self._cache: Dict[str, CacheEntry] = {}
        self._max_size = max_size
        self._metrics = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "total_requests": 0,
            "lru_evictions": 0
        }
        logger.info(f"CacheService initialized (max_size: {max_size})")

    def _generate_key(self, namespace: str, key: str) -> str:
        """
        キャッシュキーを生成

        Args:
            namespace: 名前空間
            key: キー

        Returns:
            生成されたキー
        """
        return f"{namespace}:{key}"

    def _hash_key(self, data: Any) -> str:
        """
        データからハッシュキーを生成

        Args:
            data: ハッシュ化するデータ

        Returns:
            SHA256ハッシュ
        """
        if isinstance(data, (dict, list)):
            data_str = json.dumps(data, sort_keys=True)
        else:
            data_str = str(data)

        return hashlib.sha256(data_str.encode()).hexdigest()

    def get(self, namespace: str, key: str) -> Optional[Any]:
        """
        キャッシュから値を取得

        Args:
            namespace: 名前空間
            key: キー

        Returns:
            キャッシュされた値、存在しない場合はNone
        """
        self._metrics["total_requests"] += 1
        cache_key = self._generate_key(namespace, key)

        if cache_key not in self._cache:
            self._metrics["misses"] += 1
            logger.debug(f"Cache miss: {cache_key}")
            return None

        entry = self._cache[cache_key]

        if entry.is_expired():
            self._metrics["misses"] += 1
            self._metrics["evictions"] += 1
            del self._cache[cache_key]
            logger.debug(f"Cache expired: {cache_key}")
            return None

        self._metrics["hits"] += 1
        logger.debug(f"Cache hit: {cache_key} (hits: {entry.hits + 1})")
        return entry.get_value()

    def _evict_lru(self):
        """LRU（Least Recently Used）に基づいて古いエントリを削除"""
        if len(self._cache) < self._max_size:
            return

        # 最もアクセスされていないエントリを見つける
        lru_key = min(
            self._cache.keys(),
            key=lambda k: self._cache[k].last_accessed
        )

        del self._cache[lru_key]
        self._metrics["lru_evictions"] += 1
        logger.info(f"LRU eviction: {lru_key} (cache size: {len(self._cache)})")

    def set(self, namespace: str, key: str, value: Any, ttl: int = 3600):
        """
        キャッシュに値を設定

        Args:
            namespace: 名前空間
            key: キー
            value: 値
            ttl: 有効期限（秒）、デフォルト1時間
        """
        # キャッシュサイズチェック
        self._evict_lru()

        cache_key = self._generate_key(namespace, key)
        self._cache[cache_key] = CacheEntry(value, ttl)
        logger.debug(f"Cache set: {cache_key} (ttl: {ttl}s)")

    def delete(self, namespace: str, key: str):
        """
        キャッシュから値を削除

        Args:
            namespace: 名前空間
            key: キー
        """
        cache_key = self._generate_key(namespace, key)
        if cache_key in self._cache:
            del self._cache[cache_key]
            logger.debug(f"Cache deleted: {cache_key}")

    def clear(self, namespace: Optional[str] = None):
        """
        キャッシュをクリア

        Args:
            namespace: 名前空間（指定しない場合は全てクリア）
        """
        if namespace is None:
            count = len(self._cache)
            self._cache.clear()
            logger.info(f"Cache cleared: {count} entries")
        else:
            prefix = f"{namespace}:"
            keys_to_delete = [key for key in self._cache.keys() if key.startswith(prefix)]
            for key in keys_to_delete:
                del self._cache[key]
            logger.info(f"Cache cleared for namespace '{namespace}': {len(keys_to_delete)} entries")

    def cleanup_expired(self):
        """期限切れのキャッシュを削除"""
        keys_to_delete = [
            key for key, entry in self._cache.items()
            if entry.is_expired()
        ]
        for key in keys_to_delete:
            del self._cache[key]
            self._metrics["evictions"] += 1

        if keys_to_delete:
            logger.info(f"Cleaned up {len(keys_to_delete)} expired cache entries")

    def get_metrics(self) -> Dict[str, Any]:
        """
        キャッシュメトリクスを取得

        Returns:
            メトリクス情報
        """
        total = self._metrics["total_requests"]
        hits = self._metrics["hits"]
        hit_rate = (hits / total * 100) if total > 0 else 0

        return {
            **self._metrics,
            "hit_rate": round(hit_rate, 2),
            "cache_size": len(self._cache),
            "total_hits_in_cache": sum(entry.hits for entry in self._cache.values())
        }

    def get_cache_info(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        キャッシュ情報を取得

        Args:
            namespace: 名前空間（指定しない場合は全て）

        Returns:
            キャッシュエントリ情報のリスト
        """
        info = []
        for key, entry in self._cache.items():
            if namespace is None or key.startswith(f"{namespace}:"):
                info.append({
                    "key": key,
                    "hits": entry.hits,
                    "created_at": datetime.fromtimestamp(entry.created_at).isoformat(),
                    "expires_at": datetime.fromtimestamp(entry.expires_at).isoformat(),
                    "ttl_remaining": max(0, int(entry.expires_at - time.time())),
                    "is_expired": entry.is_expired()
                })

        return sorted(info, key=lambda x: x["hits"], reverse=True)


# グローバルシングルトン
_cache_service: Optional[CacheService] = None


def get_cache_service() -> CacheService:
    """
    キャッシュサービスを取得（シングルトン）

    Returns:
        CacheService: キャッシュサービス
    """
    global _cache_service
    if _cache_service is None:
        # 設定から最大サイズを取得
        from app.config import get_settings
        settings = get_settings()
        _cache_service = CacheService(max_size=settings.cache_max_size)
    return _cache_service


def cached(namespace: str, ttl: int = 3600, key_func: Optional[Callable] = None):
    """
    関数の戻り値をキャッシュするデコレータ

    Args:
        namespace: 名前空間
        ttl: 有効期限（秒）
        key_func: キー生成関数（指定しない場合は引数からハッシュ生成）

    Usage:
        @cached(namespace="embeddings", ttl=3600)
        def generate_embeddings(text: str) -> List[float]:
            # ...実装...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            cache = get_cache_service()

            # キーを生成
            if key_func is not None:
                key = key_func(*args, **kwargs)
            else:
                # 引数からハッシュを生成
                key_data = {"args": args, "kwargs": kwargs}
                key = cache._hash_key(key_data)

            # キャッシュから取得
            cached_value = cache.get(namespace, key)
            if cached_value is not None:
                logger.debug(f"Returning cached result for {func.__name__}")
                return cached_value

            # 関数実行
            result = func(*args, **kwargs)

            # キャッシュに保存
            cache.set(namespace, key, result, ttl)

            return result

        return wrapper
    return decorator


def async_cached(namespace: str, ttl: int = 3600, key_func: Optional[Callable] = None):
    """
    非同期関数の戻り値をキャッシュするデコレータ

    Args:
        namespace: 名前空間
        ttl: 有効期限（秒）
        key_func: キー生成関数

    Usage:
        @async_cached(namespace="embeddings", ttl=3600)
        async def generate_embeddings(text: str) -> List[float]:
            # ...実装...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache = get_cache_service()

            # キーを生成
            if key_func is not None:
                key = key_func(*args, **kwargs)
            else:
                # 引数からハッシュを生成
                key_data = {"args": args, "kwargs": kwargs}
                key = cache._hash_key(key_data)

            # キャッシュから取得
            cached_value = cache.get(namespace, key)
            if cached_value is not None:
                logger.debug(f"Returning cached result for {func.__name__}")
                return cached_value

            # 関数実行
            result = await func(*args, **kwargs)

            # キャッシュに保存
            cache.set(namespace, key, result, ttl)

            return result

        return wrapper
    return decorator
