#!/usr/bin/env python3
"""
V3 Migration Validation Script

移行後のデータ整合性を検証します。

Usage:
    python backend/scripts/validate_migration.py \\
        --spreadsheet-id 1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA \\
        --project fractal-ecosystem \\
        --instance rag-mysql \\
        --database rag_system
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

# 外部ライブラリ
try:
    import aiomysql
    import google.auth
    from google.cloud import firestore
    from googleapiclient.discovery import build
    from tqdm import tqdm
except ImportError as e:
    print(f"❌ 必要なライブラリがインストールされていません: {e}")
    print("\n以下のコマンドでインストールしてください:")
    print("pip install aiomysql google-auth google-api-python-client google-cloud-firestore tqdm")
    sys.exit(1)

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('v3_validation.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class V3MigrationValidator:
    """V3 Migration Validation"""

    def __init__(
        self,
        spreadsheet_id: str,
        project_id: str,
        instance_name: str,
        database_name: str = 'rag_system',
        host: str = '127.0.0.1',
        port: int = 3306,
        user: str = 'root',
        password: str = ''
    ):
        self.spreadsheet_id = spreadsheet_id
        self.project_id = project_id
        self.instance_name = instance_name
        self.database_name = database_name
        self.host = host
        self.port = port
        self.user = user
        self.password = password

        # Google Sheets API
        self.sheets_service = None

        # Firestore Client
        self.firestore_db = firestore.Client(project=project_id)

        # MySQL Connection Pool
        self.pool = None

        # 検証結果
        self.validation_results = {
            'knowledge_base': {'passed': [], 'failed': []},
            'embeddings': {'passed': [], 'failed': []},
            'chat_sessions': {'passed': [], 'failed': []},
            'chat_messages': {'passed': [], 'failed': []},
            'vector_integrity': {'passed': [], 'failed': []},
            'summary': {}
        }

    def init_sheets_service(self):
        """Google Sheets API初期化"""
        try:
            credentials, _ = google.auth.default(
                scopes=[
                    'https://www.googleapis.com/auth/spreadsheets.readonly',
                    'https://www.googleapis.com/auth/drive.readonly',
                ]
            )
            self.sheets_service = build('sheets', 'v4', credentials=credentials)
            logger.info("✅ Google Sheets API初期化完了")
        except Exception as e:
            logger.error(f"❌ Google Sheets API初期化失敗: {e}")
            raise

    async def init_mysql_pool(self):
        """MySQL接続プール初期化"""
        try:
            self.pool = await aiomysql.create_pool(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                db=self.database_name,
                minsize=1,
                maxsize=10,
                autocommit=False,
                charset='utf8mb4'
            )
            logger.info("✅ MySQL接続プール初期化完了")
        except Exception as e:
            logger.error(f"❌ MySQL接続失敗: {e}")
            raise

    async def close_mysql_pool(self):
        """MySQL接続プール終了"""
        if self.pool:
            self.pool.close()
            await self.pool.wait_closed()

    # ==================================================
    # Validation 1: レコード数チェック
    # ==================================================

    async def validate_record_counts(self):
        """レコード数が一致するか検証"""
        logger.info("\n🔍 Validation 1: レコード数チェック")

        # Spreadsheet KnowledgeBase件数
        result = self.sheets_service.spreadsheets().values().get(
            spreadsheetId=self.spreadsheet_id,
            range='KnowledgeBase!A:A'
        ).execute()
        spreadsheet_kb_count = len(result.get('values', [])) - 1  # ヘッダー除く

        # Spreadsheet Embeddings件数
        result = self.sheets_service.spreadsheets().values().get(
            spreadsheetId=self.spreadsheet_id,
            range='Embeddings!A:A'
        ).execute()
        spreadsheet_emb_count = len(result.get('values', [])) - 1

        # Firestore chat_sessions件数
        firestore_sessions_count = len(list(self.firestore_db.collection('chat_sessions').stream()))

        # MySQL件数取得
        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT COUNT(*) FROM knowledge_base")
                mysql_kb_count = (await cur.fetchone())[0]

                await cur.execute("SELECT COUNT(*) FROM embeddings")
                mysql_emb_count = (await cur.fetchone())[0]

                await cur.execute("SELECT COUNT(*) FROM chat_sessions")
                mysql_sessions_count = (await cur.fetchone())[0]

                await cur.execute("SELECT COUNT(*) FROM chat_messages")
                mysql_messages_count = (await cur.fetchone())[0]

        # 検証
        checks = [
            ('knowledge_base', spreadsheet_kb_count, mysql_kb_count),
            ('embeddings', spreadsheet_emb_count, mysql_emb_count),
            ('chat_sessions', firestore_sessions_count, mysql_sessions_count)
        ]

        for table, source_count, mysql_count in checks:
            match = source_count == mysql_count
            result = {
                'table': table,
                'source_count': source_count,
                'mysql_count': mysql_count,
                'match': match
            }

            if match:
                self.validation_results[table]['passed'].append(result)
                logger.info(f"  ✅ {table}: {source_count} == {mysql_count}")
            else:
                self.validation_results[table]['failed'].append(result)
                logger.error(f"  ❌ {table}: {source_count} != {mysql_count}")

        logger.info(f"  📊 chat_messages: {mysql_messages_count} records")

    # ==================================================
    # Validation 2: サンプルデータ検証
    # ==================================================

    async def validate_sample_data(self, sample_size: int = 10):
        """ランダムサンプルデータの内容を検証"""
        logger.info(f"\n🔍 Validation 2: サンプルデータ検証（{sample_size}件）")

        # Spreadsheet KnowledgeBase読み込み
        result = self.sheets_service.spreadsheets().values().get(
            spreadsheetId=self.spreadsheet_id,
            range='KnowledgeBase!A:Z'
        ).execute()

        values = result.get('values', [])
        if not values:
            logger.warning("サンプルデータなし")
            return

        headers = values[0]
        sample_records = []

        # 最初の10件をサンプルとして取得
        for row in values[1:sample_size + 1]:
            row_data = row + [''] * (len(headers) - len(row))
            record = dict(zip(headers, row_data))
            sample_records.append(record)

        # MySQLと比較
        async with self.pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                for record in sample_records:
                    kb_id = record.get('id')
                    if not kb_id:
                        continue

                    await cur.execute(
                        "SELECT * FROM knowledge_base WHERE id = %s",
                        (kb_id,)
                    )
                    mysql_record = await cur.fetchone()

                    if mysql_record:
                        # 内容比較（主要フィールドのみ）
                        fields_to_check = ['domain', 'title', 'user_id', 'user_name']
                        match = all(
                            str(record.get(field, '')).strip() == str(mysql_record.get(field, '')).strip()
                            for field in fields_to_check
                        )

                        if match:
                            self.validation_results['knowledge_base']['passed'].append({
                                'id': kb_id,
                                'validation': 'content_match'
                            })
                            logger.info(f"  ✅ {kb_id}: Content match")
                        else:
                            self.validation_results['knowledge_base']['failed'].append({
                                'id': kb_id,
                                'validation': 'content_mismatch',
                                'details': f"Fields {fields_to_check} mismatch"
                            })
                            logger.error(f"  ❌ {kb_id}: Content mismatch")
                    else:
                        self.validation_results['knowledge_base']['failed'].append({
                            'id': kb_id,
                            'validation': 'missing_in_mysql'
                        })
                        logger.error(f"  ❌ {kb_id}: Missing in MySQL")

    # ==================================================
    # Validation 3: ベクトル整合性チェック
    # ==================================================

    async def validate_vector_integrity(self):
        """すべてのknowledge_baseレコードにembeddingが存在するか検証"""
        logger.info("\n🔍 Validation 3: ベクトル整合性チェック")

        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                # knowledge_base のID一覧取得
                await cur.execute("SELECT id FROM knowledge_base LIMIT 1000")
                kb_ids = [row[0] for row in await cur.fetchall()]

                # embeddings のID一覧取得
                await cur.execute("SELECT kb_id FROM embeddings")
                emb_ids_set = {row[0] for row in await cur.fetchall()}

                missing_embeddings = []
                for kb_id in tqdm(kb_ids, desc="Vector Integrity Check"):
                    if kb_id not in emb_ids_set:
                        missing_embeddings.append(kb_id)
                        self.validation_results['vector_integrity']['failed'].append({
                            'kb_id': kb_id,
                            'issue': 'missing_embedding'
                        })

                if missing_embeddings:
                    logger.error(f"  ❌ {len(missing_embeddings)} knowledge_base records missing embeddings")
                    logger.error(f"     Examples: {missing_embeddings[:5]}")
                else:
                    logger.info(f"  ✅ All {len(kb_ids)} knowledge_base records have embeddings")
                    self.validation_results['vector_integrity']['passed'].append({
                        'total_checked': len(kb_ids),
                        'all_have_embeddings': True
                    })

    # ==================================================
    # Validation 4: Vector Index動作確認
    # ==================================================

    async def validate_vector_index(self):
        """Vector Indexが正しく動作するか検証"""
        logger.info("\n🔍 Validation 4: Vector Index動作確認")

        async with self.pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                # Vector Indexの存在確認
                await cur.execute("""
                    SHOW INDEX FROM embeddings WHERE Key_name = 'idx_embedding'
                """)
                index_info = await cur.fetchall()

                if index_info:
                    logger.info("  ✅ Vector Index 'idx_embedding' exists")
                    self.validation_results['embeddings']['passed'].append({
                        'validation': 'vector_index_exists'
                    })
                else:
                    logger.error("  ❌ Vector Index 'idx_embedding' not found")
                    self.validation_results['embeddings']['failed'].append({
                        'validation': 'vector_index_missing'
                    })
                    return

                # サンプルベクトル検索テスト
                await cur.execute("SELECT kb_id, embedding FROM embeddings LIMIT 1")
                sample = await cur.fetchone()

                if sample:
                    kb_id = sample['kb_id']
                    logger.info(f"  🔍 Sample vector search test for kb_id: {kb_id}")

                    # コサイン類似度検索テスト（MySQL 9.0+ Vector Type）
                    try:
                        await cur.execute("""
                            SELECT kb_id,
                                   DISTANCE(embedding, (SELECT embedding FROM embeddings WHERE kb_id = %s), 'COSINE') AS distance
                            FROM embeddings
                            ORDER BY distance ASC
                            LIMIT 5
                        """, (kb_id,))

                        results = await cur.fetchall()
                        if results:
                            logger.info(f"  ✅ Vector search successful: {len(results)} results")
                            self.validation_results['embeddings']['passed'].append({
                                'validation': 'vector_search_works',
                                'sample_kb_id': kb_id,
                                'results_count': len(results)
                            })
                        else:
                            logger.error("  ❌ Vector search returned no results")
                            self.validation_results['embeddings']['failed'].append({
                                'validation': 'vector_search_no_results'
                            })

                    except Exception as e:
                        logger.error(f"  ❌ Vector search failed: {e}")
                        self.validation_results['embeddings']['failed'].append({
                            'validation': 'vector_search_error',
                            'error': str(e)
                        })

    # ==================================================
    # Validation 5: Foreign Key制約チェック
    # ==================================================

    async def validate_foreign_keys(self):
        """Foreign Key制約が正しく機能するか検証"""
        logger.info("\n🔍 Validation 5: Foreign Key制約チェック")

        async with self.pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                # embeddings.kb_id → knowledge_base.id
                await cur.execute("""
                    SELECT COUNT(*) as orphaned
                    FROM embeddings e
                    LEFT JOIN knowledge_base kb ON e.kb_id = kb.id
                    WHERE kb.id IS NULL
                """)
                result = await cur.fetchone()
                orphaned_embeddings = result['orphaned']

                if orphaned_embeddings == 0:
                    logger.info("  ✅ embeddings.kb_id → knowledge_base.id: No orphaned records")
                else:
                    logger.error(f"  ❌ embeddings: {orphaned_embeddings} orphaned records")

                # chat_messages.session_id → chat_sessions.session_id
                await cur.execute("""
                    SELECT COUNT(*) as orphaned
                    FROM chat_messages cm
                    LEFT JOIN chat_sessions cs ON cm.session_id = cs.session_id
                    WHERE cs.session_id IS NULL
                """)
                result = await cur.fetchone()
                orphaned_messages = result['orphaned']

                if orphaned_messages == 0:
                    logger.info("  ✅ chat_messages.session_id → chat_sessions.session_id: No orphaned records")
                else:
                    logger.error(f"  ❌ chat_messages: {orphaned_messages} orphaned records")

    # ==================================================
    # レポート生成
    # ==================================================

    def generate_report(self):
        """検証レポート生成"""
        logger.info("\n" + "=" * 80)
        logger.info("📊 Validation Report")
        logger.info("=" * 80)

        total_passed = sum(len(v['passed']) for v in self.validation_results.values() if 'passed' in v)
        total_failed = sum(len(v['failed']) for v in self.validation_results.values() if 'failed' in v)

        logger.info(f"Total Checks Passed: {total_passed}")
        logger.info(f"Total Checks Failed: {total_failed}")

        for table, results in self.validation_results.items():
            if table == 'summary':
                continue

            passed_count = len(results.get('passed', []))
            failed_count = len(results.get('failed', []))

            logger.info(f"\n{table}:")
            logger.info(f"  Passed: {passed_count}")
            logger.info(f"  Failed: {failed_count}")

            if failed_count > 0 and results.get('failed'):
                logger.info(f"  Failed Details:")
                for failure in results['failed'][:5]:  # 最初の5件のみ表示
                    logger.info(f"    - {failure}")

        # レポートファイル保存
        report_file = Path('v3_validation_report.json')
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(self.validation_results, f, ensure_ascii=False, indent=2)

        logger.info(f"\n📄 Validation report saved: {report_file}")
        logger.info("=" * 80)

        if total_failed == 0:
            logger.info("✅ All validations passed!")
            return True
        else:
            logger.error(f"❌ {total_failed} validations failed")
            return False

    # ==================================================
    # メイン実行
    # ==================================================

    async def run(self):
        """検証実行"""
        logger.info("=" * 80)
        logger.info("V3 Migration Validation")
        logger.info("=" * 80)
        logger.info(f"Project: {self.project_id}")
        logger.info(f"Instance: {self.instance_name}")
        logger.info(f"Database: {self.database_name}")
        logger.info("=" * 80)

        try:
            # 初期化
            self.init_sheets_service()
            await self.init_mysql_pool()

            # 検証実行
            await self.validate_record_counts()
            await self.validate_sample_data()
            await self.validate_vector_integrity()
            await self.validate_vector_index()
            await self.validate_foreign_keys()

            # レポート生成
            success = self.generate_report()

            return success

        except Exception as e:
            logger.error(f"❌ Validation failed: {e}", exc_info=True)
            return False

        finally:
            await self.close_mysql_pool()


async def main():
    parser = argparse.ArgumentParser(description='V3 Migration Validation')
    parser.add_argument('--spreadsheet-id', required=True, help='Spreadsheet ID')
    parser.add_argument('--project', required=True, help='GCP Project ID')
    parser.add_argument('--instance', required=True, help='Cloud SQL Instance Name')
    parser.add_argument('--database', default='rag_system', help='Database Name')
    parser.add_argument('--host', default='127.0.0.1', help='MySQL Host')
    parser.add_argument('--port', type=int, default=3306, help='MySQL Port')
    parser.add_argument('--user', default='root', help='MySQL User')
    parser.add_argument('--password', default='', help='MySQL Password')

    args = parser.parse_args()

    validator = V3MigrationValidator(
        spreadsheet_id=args.spreadsheet_id,
        project_id=args.project,
        instance_name=args.instance,
        database_name=args.database,
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password
    )

    success = await validator.run()

    sys.exit(0 if success else 1)


if __name__ == '__main__':
    asyncio.run(main())
