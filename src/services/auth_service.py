"""
Google API authentication service.
"""

import pickle
import logging
from pathlib import Path
from typing import Optional

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

logger = logging.getLogger(__name__)


class AuthService:
    """Handle Google API authentication."""
    
    def __init__(
        self,
        credentials_file: Path,
        token_file: Path,
        scopes: list,
        project_id: Optional[str] = None
    ):
        """
        Initialize authentication service.
        
        Args:
            credentials_file: Path to credentials.json
            token_file: Path to token.pickle
            scopes: List of required scopes
            project_id: Google Cloud project ID
        """
        self.credentials_file = credentials_file
        self.token_file = token_file
        self.scopes = scopes
        self.project_id = project_id
        self._credentials: Optional[Credentials] = None
    
    def get_credentials(self) -> Credentials:
        """
        Get valid credentials, prompting for authorization if needed.
        
        Returns:
            Valid credentials object
            
        Raises:
            FileNotFoundError: If credentials.json is missing
        """
        if self._credentials:
            return self._credentials
        
        # Try to load cached credentials
        self._credentials = self._load_cached_credentials()
        
        # Check if credentials are valid
        if not self._credentials or not self._credentials.valid:
            if self._credentials and self._credentials.expired and self._credentials.refresh_token:
                logger.info("Refreshing expired credentials...")
                self._refresh_credentials()
            else:
                logger.info("Obtaining new credentials...")
                self._obtain_new_credentials()
        
        # Cache credentials
        self._save_credentials()
        
        return self._credentials
    
    def _load_cached_credentials(self) -> Optional[Credentials]:
        """Load credentials from cache file."""
        if not self.token_file.exists():
            logger.debug("No cached credentials found")
            return None
        
        try:
            with open(self.token_file, 'rb') as token:
                creds = pickle.load(token)
                logger.info("Loaded cached credentials")
                return creds
        except Exception as e:
            logger.warning(f"Failed to load cached credentials: {e}")
            return None
    
    def _refresh_credentials(self) -> None:
        """Refresh expired credentials."""
        try:
            self._credentials.refresh(Request())
            logger.info("Successfully refreshed credentials")
        except Exception as e:
            logger.error(f"Failed to refresh credentials: {e}")
            # If refresh fails, get new credentials
            self._obtain_new_credentials()
    
    def _obtain_new_credentials(self) -> None:
        """Obtain new credentials through OAuth flow."""
        if not self.credentials_file.exists():
            raise FileNotFoundError(
                f"Credentials file not found: {self.credentials_file}\n"
                f"Please download OAuth credentials from Google Cloud Console."
            )
        
        try:
            flow = InstalledAppFlow.from_client_secrets_file(
                str(self.credentials_file),
                self.scopes
            )
            
            # Set project ID if provided
            if self.project_id:
                flow.oauth2session.project_id = self.project_id
            
            self._credentials = flow.run_local_server(port=0)
            logger.info("Successfully obtained new credentials")
            
        except Exception as e:
            logger.error(f"Failed to obtain credentials: {e}")
            raise
    
    def _save_credentials(self) -> None:
        """Save credentials to cache file."""
        try:
            self.token_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.token_file, 'wb') as token:
                pickle.dump(self._credentials, token)
            logger.debug(f"Saved credentials to {self.token_file}")
        except Exception as e:
            logger.warning(f"Failed to save credentials: {e}")
    
    def clear_cache(self) -> None:
        """Clear cached credentials."""
        if self.token_file.exists():
            self.token_file.unlink()
            logger.info("Cleared credential cache")
        self._credentials = None
