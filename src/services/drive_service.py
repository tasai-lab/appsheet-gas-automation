"""
Google Drive API service.
"""

import logging
from typing import List, Dict, Any, Optional

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2.credentials import Credentials

logger = logging.getLogger(__name__)


class DriveService:
    """Handle Google Drive API operations."""
    
    def __init__(self, credentials: Credentials):
        """
        Initialize Drive service.
        
        Args:
            credentials: Google API credentials
        """
        self.service = build('drive', 'v3', credentials=credentials)
        logger.info("Initialized Google Drive service")
    
    def list_gas_files_in_folder(
        self,
        folder_id: str,
        name_filter: Optional[str] = None,
        recursive: bool = True
    ) -> List[Dict[str, Any]]:
        """
        List all GAS files in a folder.
        
        Args:
            folder_id: Folder ID to search
            name_filter: Filter files by name (case-insensitive)
            recursive: Whether to search subfolders
            
        Returns:
            List of file metadata dictionaries
        """
        logger.info(f"Searching for GAS files in folder: {folder_id}")
        
        all_files = []
        
        try:
            # Get items in folder
            items = self._list_folder_contents(folder_id)
            
            for item in items:
                mime_type = item.get('mimeType', '')
                
                # Check if it's a GAS project
                if mime_type == 'application/vnd.google-apps.script':
                    all_files.append(item)
                
                # Recursively search subfolders
                elif recursive and mime_type == 'application/vnd.google-apps.folder':
                    folder_name = item.get('name', '')
                    logger.debug(f"Searching subfolder: {folder_name}")
                    subfolder_files = self.list_gas_files_in_folder(
                        item['id'],
                        name_filter,
                        recursive
                    )
                    all_files.extend(subfolder_files)
            
            # Apply name filter if specified
            if name_filter:
                all_files = [
                    f for f in all_files
                    if name_filter.lower() in f.get('name', '').lower()
                ]
            
            logger.info(f"Found {len(all_files)} GAS file(s)")
            return all_files
            
        except HttpError as e:
            logger.error(f"Error accessing folder {folder_id}: {e}")
            raise
    
    def _list_folder_contents(self, folder_id: str) -> List[Dict[str, Any]]:
        """
        List all items in a folder.
        
        Args:
            folder_id: Folder ID
            
        Returns:
            List of file/folder metadata
        """
        query = f"'{folder_id}' in parents and trashed=false"
        
        try:
            results = self.service.files().list(
                q=query,
                fields="files(id, name, mimeType, createdTime, modifiedTime, owners, parents)",
                pageSize=100,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True
            ).execute()
            
            return results.get('files', [])
            
        except HttpError as e:
            logger.error(f"Error listing folder contents: {e}")
            return []
    
    def get_file_metadata(self, file_id: str) -> Optional[Dict[str, Any]]:
        """
        Get metadata for a specific file.
        
        Args:
            file_id: File ID
            
        Returns:
            File metadata dictionary or None
        """
        try:
            file_metadata = self.service.files().get(
                fileId=file_id,
                fields="id, name, mimeType, owners, createdTime, modifiedTime, shared",
                supportsAllDrives=True
            ).execute()
            
            return file_metadata
            
        except HttpError as e:
            logger.error(f"Error getting file metadata for {file_id}: {e}")
            return None
    
    def get_user_info(self) -> Dict[str, str]:
        """
        Get information about the authenticated user.
        
        Returns:
            Dictionary with user email and display name
        """
        try:
            about = self.service.about().get(fields="user").execute()
            user = about.get('user', {})
            
            return {
                'email': user.get('emailAddress', 'Unknown'),
                'name': user.get('displayName', 'Unknown'),
                'permission_id': user.get('permissionId', 'Unknown')
            }
            
        except HttpError as e:
            logger.error(f"Error getting user info: {e}")
            return {'email': 'Unknown', 'name': 'Unknown', 'permission_id': 'Unknown'}
