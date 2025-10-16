"""
Service for applying duplication prevention to projects.
"""

import logging
import shutil
from pathlib import Path
from typing import List

from ..models.gas_project import ProjectAnalysis, MigrationGuide
from ..utils.file_utils import write_file_safely

logger = logging.getLogger(__name__)


class DedupApplicator:
    """Apply duplication prevention library to projects."""
    
    def __init__(self, library_file: Path):
        """
        Initialize duplication prevention applicator.
        
        Args:
            library_file: Path to DuplicationPrevention.gs
        """
        self.library_file = library_file
        
        if not library_file.exists():
            raise FileNotFoundError(f"Library file not found: {library_file}")
    
    def apply_to_project(self, analysis: ProjectAnalysis) -> bool:
        """
        Apply duplication prevention to a single project.
        
        Args:
            analysis: ProjectAnalysis instance
            
        Returns:
            True if successful
        """
        logger.info(f"Applying duplication prevention to: {analysis.project_name}")
        
        scripts_dir = analysis.project_path / 'scripts'
        dest_file = scripts_dir / 'utils_duplicationPrevention.gs'
        
        # Check if already exists
        if dest_file.exists():
            logger.warning(f"  ⚠️  Library file already exists")
            return False
        
        try:
            # Copy library file
            shutil.copy(self.library_file, dest_file)
            logger.info(f"  ✅ Added library: {dest_file.name}")
            
            # Generate migration guide
            self._generate_migration_guide(analysis)
            
            return True
            
        except Exception as e:
            logger.error(f"  ❌ Error applying library: {e}")
            return False
    
    def apply_to_multiple(self, analyses: List[ProjectAnalysis]) -> dict:
        """
        Apply duplication prevention to multiple projects.
        
        Args:
            analyses: List of ProjectAnalysis instances
            
        Returns:
            Dictionary with application statistics
        """
        stats = {
            'applied': 0,
            'skipped': 0,
            'failed': 0
        }
        
        for analysis in analyses:
            try:
                if self.apply_to_project(analysis):
                    stats['applied'] += 1
                else:
                    stats['skipped'] += 1
            except Exception as e:
                logger.error(f"Failed to process {analysis.project_name}: {e}")
                stats['failed'] += 1
        
        return stats
    
    def _generate_migration_guide(self, analysis: ProjectAnalysis) -> None:
        """
        Generate migration guide for a project.
        
        Args:
            analysis: ProjectAnalysis instance
        """
        guide = MigrationGuide(
            project_name=analysis.project_name,
            webhook_file=analysis.webhook_file.name if analysis.webhook_file else 'N/A',
            record_id_field=analysis.estimated_record_id_field,
            has_existing_prevention=analysis.has_duplication_prevention
        )
        
        guide_path = analysis.project_path / 'MIGRATION_GUIDE.md'
        write_file_safely(guide_path, guide.to_markdown())
        
        logger.info(f"  📄 Generated migration guide")
        
        if analysis.estimated_record_id_field:
            logger.info(f"  🔍 Estimated record ID field: {analysis.estimated_record_id_field}")
        else:
            logger.warning(f"  ⚠️  Could not estimate record ID field")
