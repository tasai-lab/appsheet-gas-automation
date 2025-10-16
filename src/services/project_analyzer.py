"""
Service for analyzing GAS projects for duplication prevention.
"""

import logging
from pathlib import Path
from typing import List

from ..config import GEMINI_API_PATTERNS, WEBHOOK_PATTERNS, DEDUP_PATTERNS
from ..models.gas_project import ProjectAnalysis
from ..utils.file_utils import read_file_safely, detect_pattern_in_code, extract_record_id_fields

logger = logging.getLogger(__name__)


class ProjectAnalyzer:
    """Analyze GAS projects for Gemini API and webhook usage."""
    
    def __init__(self, projects_dir: Path):
        """
        Initialize project analyzer.
        
        Args:
            projects_dir: Base directory containing GAS projects
        """
        self.projects_dir = projects_dir
    
    def find_projects_needing_dedup(self) -> List[ProjectAnalysis]:
        """
        Find all projects that need duplication prevention.
        
        Returns:
            List of ProjectAnalysis for projects needing duplication prevention
        """
        logger.info("Analyzing projects for duplication prevention needs...")
        
        all_analyses = []
        projects_needing_dedup = []
        
        for project_dir in self.projects_dir.iterdir():
            if not project_dir.is_dir():
                continue
            
            analysis = self.analyze_project(project_dir)
            if analysis:
                all_analyses.append(analysis)
                if analysis.needs_duplication_prevention:
                    projects_needing_dedup.append(analysis)
        
        logger.info(f"Found {len(projects_needing_dedup)} project(s) needing duplication prevention")
        logger.info(f"Total projects analyzed: {len(all_analyses)}")
        
        return projects_needing_dedup
    
    def analyze_project(self, project_dir: Path) -> ProjectAnalysis:
        """
        Analyze a single project.
        
        Args:
            project_dir: Path to project directory
            
        Returns:
            ProjectAnalysis instance
        """
        scripts_dir = project_dir / 'scripts'
        if not scripts_dir.exists():
            return None
        
        analysis = ProjectAnalysis(
            project_name=project_dir.name,
            project_path=project_dir
        )
        
        # Analyze all script files
        for script_file in scripts_dir.glob('*.gs'):
            code = read_file_safely(script_file)
            if not code:
                continue
            
            # Check for Gemini API
            if detect_pattern_in_code(code, GEMINI_API_PATTERNS):
                analysis.has_gemini_api = True
                analysis.gemini_files.append(script_file)
            
            # Check for webhook
            if detect_pattern_in_code(code, WEBHOOK_PATTERNS, case_insensitive=False):
                analysis.has_webhook = True
                analysis.webhook_files.append(script_file)
                if not analysis.webhook_file:
                    analysis.webhook_file = script_file
                    # Extract record ID field
                    analysis.estimated_record_id_field = extract_record_id_fields(code)
            
            # Check for existing duplication prevention
            if detect_pattern_in_code(code, DEDUP_PATTERNS, case_insensitive=False):
                analysis.has_duplication_prevention = True
        
        logger.debug(
            f"Analyzed {project_dir.name}: "
            f"Gemini={analysis.has_gemini_api}, "
            f"Webhook={analysis.has_webhook}, "
            f"Dedup={analysis.has_duplication_prevention}"
        )
        
        return analysis
