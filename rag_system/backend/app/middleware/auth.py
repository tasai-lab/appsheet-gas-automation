"""
認証ミドルウェア

Firebase ID Token検証による認証を提供します。
"""

import logging
from typing import Optional

from fastapi import Header, HTTPException, status
from firebase_admin import auth

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def verify_firebase_token(authorization: Optional[str] = Header(None)) -> dict:
    """
    Firebase ID Tokenを検証

    Args:
        authorization: Authorizationヘッダー ("Bearer <token>")

    Returns:
        dict: デコードされたトークン情報 (uid, email, etc.)

    Raises:
        HTTPException: 認証エラー時
    """
    # 認証が必須でない場合はスキップ
    if not settings.require_authentication:
        return {"uid": "anonymous", "email": None}

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # "Bearer <token>" から <token> を抽出
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication scheme",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Firebase ID Token検証
        decoded_token = auth.verify_id_token(token)
        logger.info(f"✅ Authentication successful: {decoded_token.get('uid')}")
        return decoded_token

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.InvalidIdTokenError as e:
        logger.error(f"❌ Invalid ID token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid ID token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.ExpiredIdTokenError as e:
        logger.error(f"❌ Expired ID token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"❌ Authentication error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication error",
        )
