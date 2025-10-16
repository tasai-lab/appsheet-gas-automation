"""
Service for saving GAS projects to filesystem.
"""

import json
import logging
from pathlib import Path
from typing import Optional

from ..models.gas_project import GASProject
from ..utils.file_utils import ensure_directory, write_file_safely

logger = logging.getLogger(__name__)


class ProjectSaver:
    """Handle saving GAS projects to filesystem."""
    
    def __init__(self, output_dir: Path):
        """
        Initialize project saver.
        
        Args:
            output_dir: Base output directory
        """
        self.output_dir = output_dir
        ensure_directory(output_dir)
    
    def save_project(self, project: GASProject) -> Optional[Path]:
        """
        Save complete GAS project to filesystem.
        
        Args:
            project: GASProject instance
            
        Returns:
            Path to saved project directory or None if error
        """
        # Create project directory
        project_dir = self.output_dir / project.safe_name
        ensure_directory(project_dir)
        
        logger.info(f"Saving project: {project.project_name}")
        
        try:
            # Save script files
            self._save_scripts(project, project_dir)
            
            # Save spreadsheet data
            self._save_spreadsheets(project, project_dir)
            
            # Save manifest
            if project.manifest:
                self._save_manifest(project, project_dir)
            
            # Save metadata
            self._save_metadata(project, project_dir)
            
            # Generate README
            self._generate_readme(project, project_dir)
            
            logger.info(f"✓ Saved to: {project_dir}")
            return project_dir
            
        except Exception as e:
            logger.error(f"Error saving project {project.project_name}: {e}")
            return None
    
    def _save_scripts(self, project: GASProject, project_dir: Path) -> None:
        """Save all script files."""
        scripts_dir = project_dir / 'scripts'
        ensure_directory(scripts_dir)
        
        for file in project.files:
            file_path = scripts_dir / file.filename
            write_file_safely(file_path, file.source)
        
        logger.debug(f"Saved {len(project.files)} script file(s)")
    
    def _save_spreadsheets(self, project: GASProject, project_dir: Path) -> None:
        """Save spreadsheet metadata."""
        if not project.spreadsheets:
            return
        
        sheets_dir = project_dir / 'spreadsheets'
        ensure_directory(sheets_dir)
        
        for spreadsheet in project.spreadsheets:
            filename = f"{spreadsheet.title}_metadata.json"
            # Sanitize filename
            from ..utils.file_utils import sanitize_filename
            safe_filename = sanitize_filename(filename)
            
            file_path = sheets_dir / safe_filename
            data = {
                'spreadsheetId': spreadsheet.spreadsheet_id,
                'title': spreadsheet.title,
                'url': spreadsheet.url,
                'sheets': spreadsheet.sheets,
                'properties': spreadsheet.properties
            }
            
            write_file_safely(file_path, json.dumps(data, indent=2, ensure_ascii=False))
        
        logger.debug(f"Saved {len(project.spreadsheets)} spreadsheet metadata file(s)")
    
    def _save_manifest(self, project: GASProject, project_dir: Path) -> None:
        """Save appsscript.json manifest."""
        manifest_path = project_dir / 'appsscript.json'
        content = json.dumps(project.manifest, indent=2, ensure_ascii=False)
        write_file_safely(manifest_path, content)
    
    def _save_metadata(self, project: GASProject, project_dir: Path) -> None:
        """Save project metadata."""
        metadata_path = project_dir / 'project_metadata.json'
        
        metadata = {
            'project_id': project.project_id,
            'project_name': project.project_name,
            'created_time': project.created_time.isoformat() if project.created_time else None,
            'modified_time': project.modified_time.isoformat() if project.modified_time else None,
            'owners': project.owners,
            'file_count': len(project.files),
            'spreadsheet_count': len(project.spreadsheets),
            **project.metadata
        }
        
        content = json.dumps(metadata, indent=2, ensure_ascii=False)
        write_file_safely(metadata_path, content)
    
    def _generate_readme(self, project: GASProject, project_dir: Path) -> None:
        """Generate README file."""
        readme_path = project_dir / 'README.md'
        
        owners_text = ', '.join([
            owner.get('displayName', owner.get('emailAddress', 'Unknown'))
            for owner in project.owners
        ])
        
        spreadsheets_section = ""
        if project.spreadsheets:
            spreadsheets_section = "## Referenced Spreadsheets\n\n"
            for sheet in project.spreadsheets:
                spreadsheets_section += f"- **{sheet.title}** (ID: {sheet.spreadsheet_id})\n"
                spreadsheets_section += f"  URL: {sheet.url}\n"
        
        content = f"""# {project.project_name}

**Project ID:** {project.project_id}

**Created:** {project.created_time.isoformat() if project.created_time else 'N/A'}

**Modified:** {project.modified_time.isoformat() if project.modified_time else 'N/A'}

**Owners:** {owners_text}

## Structure

- `scripts/`: Contains all GAS script files ({len(project.files)} files)
- `spreadsheets/`: Contains metadata for referenced spreadsheets ({len(project.spreadsheets)} spreadsheets)
- `appsscript.json`: Project manifest
- `project_metadata.json`: Complete project metadata

{spreadsheets_section}
"""
        
        write_file_safely(readme_path, content)
