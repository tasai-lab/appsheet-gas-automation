"""
Firebase Admin SDK初期化

ID Token検証とユーザー管理を提供します。
"""

import json
import logging
from typing import Optional, Dict, Any

import firebase_admin
from firebase_admin import auth, credentials
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# グローバルFirebase Adminインスタンス
_firebase_app: Optional[firebase_admin.App] = None


def initialize_firebase_admin():
    """
    Firebase Admin SDKを初期化

    環境変数からサービスアカウント認証情報を読み込みます。
    """
    global _firebase_app

    if _firebase_app is not None:
        logger.info("Firebase Admin SDK already initialized")
        return _firebase_app

    try:
        # 認証情報の読み込み
        if settings.firebase_admin_credentials_json:
            # JSON文字列から読み込み（Cloud Run推奨）
            cred_dict = json.loads(settings.firebase_admin_credentials_json)
            cred = credentials.Certificate(cred_dict)
            logger.info("Firebase credentials loaded from JSON string")
        elif settings.firebase_admin_credentials_path:
            # ファイルパスから読み込み（ローカル開発）
            cred = credentials.Certificate(settings.firebase_admin_credentials_path)
            logger.info(f"Firebase credentials loaded from {settings.firebase_admin_credentials_path}")
        else:
            # デフォルト認証情報を使用（GCP環境）
            cred = credentials.ApplicationDefault()
            logger.info("Firebase using Application Default Credentials")

        # Firebase Admin初期化
        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info("✅ Firebase Admin SDK initialized successfully")

        return _firebase_app

    except Exception as e:
        logger.error(f"Failed to initialize Firebase Admin SDK: {e}", exc_info=True)
        # 認証が必須でない場合は警告のみ
        if not settings.require_authentication:
            logger.warning("⚠️ Firebase initialization failed but authentication is not required")
            return None
        raise


def verify_id_token(id_token: str) -> Dict[str, Any]:
    """
    Firebase ID Tokenを検証

    Args:
        id_token: Firebase ID Token

    Returns:
        検証済みユーザー情報（claims）

    Raises:
        ValueError: トークンが無効な場合
    """
    try:
        # トークン検証
        decoded_token = auth.verify_id_token(id_token)

        logger.info(f"✅ Token verified for user: {decoded_token.get('email')}")

        return decoded_token

    except firebase_admin.auth.InvalidIdTokenError:
        logger.warning("Invalid ID token")
        raise ValueError("Invalid authentication token")
    except firebase_admin.auth.ExpiredIdTokenError:
        logger.warning("Expired ID token")
        raise ValueError("Authentication token expired")
    except Exception as e:
        logger.error(f"Token verification error: {e}", exc_info=True)
        raise ValueError(f"Token verification failed: {str(e)}")


def get_firebase_app() -> Optional[firebase_admin.App]:
    """
    Firebase Adminインスタンスを取得

    Returns:
        Firebase Admin App（初期化されていない場合はNone）
    """
    if _firebase_app is None:
        return initialize_firebase_admin()
    return _firebase_app
