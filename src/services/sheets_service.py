"""
Google Sheets API service.
"""

import logging
from typing import Optional, Dict, Any, List

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2.credentials import Credentials

from ..models.gas_project import SpreadsheetInfo

logger = logging.getLogger(__name__)


class SheetsService:
    """Handle Google Sheets API operations."""
    
    def __init__(self, credentials: Credentials):
        """
        Initialize Sheets service.
        
        Args:
            credentials: Google API credentials
        """
        self.service = build('sheets', 'v4', credentials=credentials)
        logger.info("Initialized Google Sheets service")
    
    def get_spreadsheet_metadata(self, spreadsheet_id: str) -> Optional[SpreadsheetInfo]:
        """
        Get metadata for a spreadsheet.
        
        Args:
            spreadsheet_id: Spreadsheet ID
            
        Returns:
            SpreadsheetInfo instance or None if error
        """
        try:
            logger.debug(f"Fetching spreadsheet metadata: {spreadsheet_id}")
            
            spreadsheet = self.service.spreadsheets().get(
                spreadsheetId=spreadsheet_id
            ).execute()
            
            return SpreadsheetInfo.from_api_response(spreadsheet)
            
        except HttpError as e:
            logger.warning(f"Error getting spreadsheet {spreadsheet_id}: {e}")
            return None
    
    def get_multiple_spreadsheets(
        self,
        spreadsheet_ids: List[str]
    ) -> List[SpreadsheetInfo]:
        """
        Get metadata for multiple spreadsheets.
        
        Args:
            spreadsheet_ids: List of spreadsheet IDs
            
        Returns:
            List of SpreadsheetInfo instances (excluding errors)
        """
        results = []
        
        for spreadsheet_id in spreadsheet_ids:
            info = self.get_spreadsheet_metadata(spreadsheet_id)
            if info:
                results.append(info)
        
        logger.info(f"Retrieved {len(results)}/{len(spreadsheet_ids)} spreadsheet(s)")
        return results
