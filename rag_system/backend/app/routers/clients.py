"""
利用者一覧API

利用者情報を取得するエンドポイントを提供します。
"""

import json
import logging
from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# ロガー
logger = logging.getLogger(__name__)

# ルーター
router = APIRouter()

# 利用者一覧データファイルのパス
CLIENT_LIST_FILE = Path(__file__).parent.parent.parent / "data" / "client_list.json"


class ClientInfo(BaseModel):
    """利用者情報モデル"""
    id: str
    name: str
    name_kana: str


class ClientListResponse(BaseModel):
    """利用者一覧レスポンスモデル"""
    clients: List[ClientInfo]
    total: int


@router.get("", response_model=ClientListResponse)
async def get_clients():
    """
    利用者一覧取得

    全ての利用者情報（ID + 名前）を返します。

    Returns:
        ClientListResponse: 利用者一覧

    Raises:
        HTTPException: ファイル読み込みエラー
    """
    logger.info("利用者一覧取得リクエスト")

    try:
        # ファイル読み込み
        if not CLIENT_LIST_FILE.exists():
            logger.error(f"利用者一覧ファイルが見つかりません: {CLIENT_LIST_FILE}")
            raise HTTPException(
                status_code=500,
                detail="利用者一覧ファイルが見つかりません"
            )

        with open(CLIENT_LIST_FILE, 'r', encoding='utf-8') as f:
            clients_data = json.load(f)

        # レスポンス作成
        clients = [ClientInfo(**client) for client in clients_data]

        logger.info(f"✅ 利用者一覧取得完了: {len(clients)}件")

        return ClientListResponse(
            clients=clients,
            total=len(clients)
        )

    except json.JSONDecodeError as e:
        logger.error(f"JSON解析エラー: {e}")
        raise HTTPException(
            status_code=500,
            detail="利用者一覧ファイルの解析に失敗しました"
        )
    except Exception as e:
        logger.error(f"利用者一覧取得エラー: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"利用者一覧の取得に失敗しました: {str(e)}"
        )


@router.get("/{client_id}")
async def get_client(client_id: str):
    """
    特定利用者情報取得

    Args:
        client_id: 利用者ID

    Returns:
        ClientInfo: 利用者情報

    Raises:
        HTTPException: 利用者が見つからない場合
    """
    logger.info(f"利用者情報取得リクエスト: {client_id}")

    try:
        # ファイル読み込み
        if not CLIENT_LIST_FILE.exists():
            raise HTTPException(
                status_code=500,
                detail="利用者一覧ファイルが見つかりません"
            )

        with open(CLIENT_LIST_FILE, 'r', encoding='utf-8') as f:
            clients_data = json.load(f)

        # 利用者検索
        for client_data in clients_data:
            if client_data.get("id") == client_id:
                client = ClientInfo(**client_data)
                logger.info(f"✅ 利用者情報取得完了: {client_id}")
                return client

        # 見つからない場合
        logger.warning(f"利用者が見つかりません: {client_id}")
        raise HTTPException(
            status_code=404,
            detail=f"利用者が見つかりません: {client_id}"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"利用者情報取得エラー: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"利用者情報の取得に失敗しました: {str(e)}"
        )
