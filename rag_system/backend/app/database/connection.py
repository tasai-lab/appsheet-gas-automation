"""
データベース接続管理

Cloud SQL (MySQL) への接続とセッション管理を提供します。
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool, QueuePool

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class DatabaseConnectionManager:
    """データベース接続マネージャー"""

    def __init__(self):
        """初期化"""
        self._engine: AsyncEngine | None = None
        self._session_maker: async_sessionmaker[AsyncSession] | None = None

    def _build_connection_url(self) -> str:
        """
        MySQL接続URLを構築

        Returns:
            接続URL
        """
        # SSL設定
        ssl_params = ""
        if settings.mysql_ssl_enabled:
            ssl_args = []
            if settings.mysql_ssl_ca:
                ssl_args.append(f"ssl_ca={settings.mysql_ssl_ca}")
            if settings.mysql_ssl_cert:
                ssl_args.append(f"ssl_cert={settings.mysql_ssl_cert}")
            if settings.mysql_ssl_key:
                ssl_args.append(f"ssl_key={settings.mysql_ssl_key}")

            if ssl_args:
                ssl_params = "?" + "&".join(ssl_args)

        # aiomysql を使用した非同期MySQL接続URL
        # フォーマット: mysql+aiomysql://user:password@host:port/database
        url = (
            f"mysql+aiomysql://"
            f"{settings.mysql_user}:{settings.mysql_password}@"
            f"{settings.mysql_host}:{settings.mysql_port}/"
            f"{settings.mysql_database}"
            f"{ssl_params}"
        )

        return url

    async def initialize(self) -> None:
        """
        データベースエンジンとセッションメーカーを初期化
        """
        if self._engine is not None:
            logger.warning("Database engine already initialized")
            return

        try:
            connection_url = self._build_connection_url()

            # ログには接続URLをマスキングして出力
            masked_url = connection_url.replace(
                settings.mysql_password, "***MASKED***"
            )
            logger.info(f"Initializing database engine: {masked_url}")

            # 接続引数（タイムアウト設定）
            connect_args = {
                "connect_timeout": settings.mysql_connect_timeout,
                "read_timeout": settings.mysql_read_timeout,
                "write_timeout": settings.mysql_write_timeout,
            }

            # 非同期エンジン作成（ベストプラクティス準拠）
            self._engine = create_async_engine(
                connection_url,
                echo=settings.debug,  # デバッグ時にSQL出力
                echo_pool=settings.mysql_echo_pool,  # プールログ出力
                pool_size=settings.mysql_pool_size,  # 最大接続数
                max_overflow=settings.mysql_pool_max_overflow,  # オーバーフロー接続数
                pool_recycle=settings.mysql_pool_recycle,  # 接続再利用時間
                pool_timeout=settings.mysql_pool_timeout,  # プール待機タイムアウト
                pool_pre_ping=settings.mysql_pool_pre_ping,  # 接続前ヘルスチェック
                poolclass=QueuePool if settings.mysql_pool_size > 0 else NullPool,
                connect_args=connect_args,  # タイムアウト設定
            )

            # セッションメーカー作成
            self._session_maker = async_sessionmaker(
                self._engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autoflush=False,
                autocommit=False,
            )

            # 接続テスト
            await self._test_connection()

            logger.info("Database engine initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize database engine: {e}", exc_info=True)
            raise

    async def _test_connection(self) -> None:
        """
        データベース接続テスト
        """
        if not self._engine:
            raise RuntimeError("Database engine not initialized")

        try:
            async with self._engine.begin() as conn:
                result = await conn.execute(text("SELECT 1"))
                row = result.fetchone()
                if row and row[0] == 1:
                    logger.info("Database connection test successful")
                else:
                    raise RuntimeError("Database connection test failed")
        except Exception as e:
            logger.error(f"Database connection test failed: {e}", exc_info=True)
            raise

    async def close(self) -> None:
        """
        データベース接続をクローズ
        """
        if self._engine is None:
            logger.warning("Database engine not initialized")
            return

        try:
            await self._engine.dispose()
            self._engine = None
            self._session_maker = None
            logger.info("Database engine closed")
        except Exception as e:
            logger.error(f"Failed to close database engine: {e}", exc_info=True)
            raise

    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """
        データベースセッションを取得（コンテキストマネージャー）

        Yields:
            AsyncSession: データベースセッション

        Raises:
            RuntimeError: セッションメーカーが初期化されていない
        """
        if self._session_maker is None:
            raise RuntimeError("Database session maker not initialized")

        session = self._session_maker()
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}", exc_info=True)
            raise
        finally:
            await session.close()

    @property
    def engine(self) -> AsyncEngine:
        """
        エンジンを取得

        Returns:
            AsyncEngine: データベースエンジン

        Raises:
            RuntimeError: エンジンが初期化されていない
        """
        if self._engine is None:
            raise RuntimeError("Database engine not initialized")
        return self._engine

    async def health_check(self) -> dict:
        """
        データベースヘルスチェック

        Returns:
            ヘルスチェック結果
        """
        if self._engine is None:
            return {
                "status": "unhealthy",
                "error": "Database engine not initialized",
            }

        try:
            async with self._engine.begin() as conn:
                await conn.execute(text("SELECT 1"))

            return {
                "status": "healthy",
                "pool_size": self._engine.pool.size(),
                "pool_checked_out": self._engine.pool.checkedout(),
            }
        except Exception as e:
            logger.error(f"Database health check failed: {e}", exc_info=True)
            return {"status": "unhealthy", "error": str(e)}


# グローバル接続マネージャーインスタンス
db_manager = DatabaseConnectionManager()


# 便利な関数エイリアス
async def init_db() -> None:
    """データベース初期化"""
    await db_manager.initialize()


async def close_db() -> None:
    """データベースクローズ"""
    await db_manager.close()


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    データベースセッション取得（FastAPI依存関数）

    Yields:
        AsyncSession: データベースセッション
    """
    async with db_manager.get_session() as session:
        yield session


async def db_health_check() -> dict:
    """
    データベースヘルスチェック

    Returns:
        ヘルスチェック結果
    """
    return await db_manager.health_check()
