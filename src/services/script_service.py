"""
Google Apps Script API service.
"""

import logging
from typing import Optional, Dict, Any

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2.credentials import Credentials

from ..models.gas_project import GASProject

logger = logging.getLogger(__name__)


class ScriptService:
    """Handle Google Apps Script API operations."""
    
    def __init__(self, credentials: Credentials):
        """
        Initialize Script service.
        
        Args:
            credentials: Google API credentials
        """
        self.service = build('script', 'v1', credentials=credentials)
        logger.info("Initialized Google Apps Script service")
    
    def get_project_content(self, script_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the complete content of an Apps Script project.
        
        Args:
            script_id: Apps Script project ID
            
        Returns:
            Project content dictionary or None if error
        """
        try:
            logger.debug(f"Fetching script content for {script_id}")
            content = self.service.projects().getContent(
                scriptId=script_id
            ).execute()
            
            logger.info(f"Retrieved script content: {len(content.get('files', []))} files")
            return content
            
        except HttpError as e:
            logger.error(f"Error getting script content for {script_id}: {e}")
            return None
    
    def parse_project(
        self,
        script_id: str,
        project_name: str,
        metadata: Dict[str, Any]
    ) -> Optional[GASProject]:
        """
        Parse Apps Script project into GASProject model.
        
        Args:
            script_id: Apps Script project ID
            project_name: Project name
            metadata: Project metadata from Drive
            
        Returns:
            GASProject instance or None if error
        """
        content = self.get_project_content(script_id)
        if not content:
            return None
        
        project = GASProject(
            project_id=script_id,
            project_name=project_name,
            metadata=metadata
        )
        
        # Parse metadata timestamps
        if 'createdTime' in metadata:
            from datetime import datetime
            project.created_time = datetime.fromisoformat(
                metadata['createdTime'].replace('Z', '+00:00')
            )
        
        if 'modifiedTime' in metadata:
            from datetime import datetime
            project.modified_time = datetime.fromisoformat(
                metadata['modifiedTime'].replace('Z', '+00:00')
            )
        
        # Parse owners
        project.owners = metadata.get('owners', [])
        
        # Parse script files
        for file in content.get('files', []):
            project.add_file(
                name=file.get('name', 'Untitled'),
                file_type=file.get('type', 'SERVER_JS'),
                source=file.get('source', '')
            )
        
        # Parse manifest
        if 'manifest' in content:
            project.manifest = content['manifest']
        
        return project
