"""
Main retriever service that orchestrates the entire process.
"""

import logging
from typing import List
from pathlib import Path

from ..config import SPREADSHEET_ID_PATTERNS
from ..models.gas_project import GASProject
from ..services.auth_service import AuthService
from ..services.drive_service import DriveService
from ..services.script_service import ScriptService
from ..services.sheets_service import SheetsService
from ..services.project_saver import ProjectSaver
from ..utils.file_utils import extract_spreadsheet_ids

logger = logging.getLogger(__name__)


class GASRetriever:
    """Main service to retrieve and save GAS projects."""
    
    def __init__(
        self,
        auth_service: AuthService,
        output_dir: Path
    ):
        """
        Initialize GAS retriever.
        
        Args:
            auth_service: Authentication service
            output_dir: Output directory for projects
        """
        self.auth_service = auth_service
        self.output_dir = output_dir
        
        # Get credentials
        credentials = auth_service.get_credentials()
        
        # Initialize services
        self.drive_service = DriveService(credentials)
        self.script_service = ScriptService(credentials)
        self.sheets_service = SheetsService(credentials)
        self.project_saver = ProjectSaver(output_dir)
    
    def retrieve_projects(
        self,
        folder_id: str,
        name_filter: str = None,
        recursive: bool = True
    ) -> List[Path]:
        """
        Retrieve all GAS projects from a folder.
        
        Args:
            folder_id: Google Drive folder ID
            name_filter: Filter projects by name
            recursive: Search subfolders
            
        Returns:
            List of saved project directories
        """
        logger.info(f"Starting GAS project retrieval from folder: {folder_id}")
        
        # Get user info
        user_info = self.drive_service.get_user_info()
        logger.info(f"Authenticated as: {user_info['email']} ({user_info['name']})")
        
        # Find GAS files
        gas_files = self.drive_service.list_gas_files_in_folder(
            folder_id,
            name_filter,
            recursive
        )
        
        if not gas_files:
            logger.warning("No GAS files found")
            return []
        
        logger.info(f"Found {len(gas_files)} GAS project(s)")
        
        # Process each project
        saved_projects = []
        for idx, file_metadata in enumerate(gas_files, 1):
            logger.info(f"\n[{idx}/{len(gas_files)}] Processing: {file_metadata['name']}")
            
            project_path = self._process_project(file_metadata)
            if project_path:
                saved_projects.append(project_path)
        
        logger.info(f"\n{'='*60}")
        logger.info(f"✓ Successfully processed {len(saved_projects)}/{len(gas_files)} project(s)")
        logger.info(f"✓ Output directory: {self.output_dir.absolute()}")
        
        return saved_projects
    
    def _process_project(self, file_metadata: dict) -> Path:
        """
        Process a single GAS project.
        
        Args:
            file_metadata: Project metadata from Drive
            
        Returns:
            Path to saved project or None
        """
        script_id = file_metadata['id']
        project_name = file_metadata['name']
        
        try:
            # Parse project
            logger.info(f"  Retrieving script content...")
            project = self.script_service.parse_project(
                script_id,
                project_name,
                file_metadata
            )
            
            if not project:
                logger.error(f"  Failed to parse project")
                return None
            
            # Extract spreadsheet references
            logger.info(f"  Extracting spreadsheet references...")
            spreadsheet_ids = self._extract_all_spreadsheet_ids(project)
            logger.info(f"  Found {len(spreadsheet_ids)} spreadsheet reference(s)")
            
            # Get spreadsheet metadata
            if spreadsheet_ids:
                spreadsheets = self.sheets_service.get_multiple_spreadsheets(spreadsheet_ids)
                for spreadsheet in spreadsheets:
                    project.add_spreadsheet(spreadsheet)
            
            # Save project
            logger.info(f"  Saving project...")
            project_path = self.project_saver.save_project(project)
            
            return project_path
            
        except Exception as e:
            logger.error(f"  Error processing project: {e}")
            return None
    
    def _extract_all_spreadsheet_ids(self, project: GASProject) -> List[str]:
        """
        Extract all spreadsheet IDs from project files.
        
        Args:
            project: GASProject instance
            
        Returns:
            List of unique spreadsheet IDs
        """
        all_ids = set()
        
        for file in project.files:
            ids = extract_spreadsheet_ids(file.source, SPREADSHEET_ID_PATTERNS)
            all_ids.update(ids)
        
        return list(all_ids)
