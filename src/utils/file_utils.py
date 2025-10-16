"""
Utility functions for file operations and text processing.
"""

import re
import logging
from pathlib import Path
from typing import List, Set, Optional

logger = logging.getLogger(__name__)


def sanitize_filename(name: str, max_length: int = 200) -> str:
    """
    Sanitize filename to be filesystem-safe.
    
    Args:
        name: Original filename
        max_length: Maximum length of the filename
        
    Returns:
        Sanitized filename
    """
    # Remove invalid characters
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    # Remove leading/trailing spaces and dots
    name = name.strip('. ')
    return name[:max_length]


def extract_spreadsheet_ids(source_code: str, patterns: List[str]) -> List[str]:
    """
    Extract spreadsheet IDs from source code using regex patterns.
    
    Args:
        source_code: GAS source code
        patterns: List of regex patterns to match spreadsheet IDs
        
    Returns:
        List of unique spreadsheet IDs
    """
    spreadsheet_ids: Set[str] = set()
    
    for pattern in patterns:
        matches = re.findall(pattern, source_code)
        spreadsheet_ids.update(matches)
    
    return list(spreadsheet_ids)


def detect_pattern_in_code(code: str, patterns: List[str], case_insensitive: bool = True) -> bool:
    """
    Check if any pattern matches in the code.
    
    Args:
        code: Source code to search
        patterns: List of regex patterns
        case_insensitive: Whether to ignore case
        
    Returns:
        True if any pattern matches
    """
    flags = re.IGNORECASE if case_insensitive else 0
    
    for pattern in patterns:
        if re.search(pattern, code, flags):
            return True
    
    return False


def extract_record_id_fields(code: str) -> Optional[str]:
    """
    Extract likely record ID field from code.
    
    Args:
        code: Source code to analyze
        
    Returns:
        Most likely record ID field name or None
    """
    # Patterns to match record ID fields
    patterns = [
        r'params\.(\w*[Ii]d)',
        r'data\.(\w*[Ii]d)',
    ]
    
    # Priority fields
    priority_fields = ['callId', 'recordId', 'recordNoteId', 'documentId']
    
    # Extract all ID fields
    id_fields: Set[str] = set()
    for pattern in patterns:
        matches = re.findall(pattern, code)
        id_fields.update(matches)
    
    # Return first priority field found
    for field in priority_fields:
        if field in id_fields:
            return field
    
    # Return any ID field found
    return next(iter(id_fields)) if id_fields else None


def ensure_directory(path: Path) -> None:
    """
    Ensure directory exists, create if not.
    
    Args:
        path: Directory path
    """
    path.mkdir(parents=True, exist_ok=True)
    logger.debug(f"Ensured directory exists: {path}")


def read_file_safely(file_path: Path, encoding: str = 'utf-8') -> Optional[str]:
    """
    Read file content safely with error handling.
    
    Args:
        file_path: Path to file
        encoding: File encoding
        
    Returns:
        File content or None if error
    """
    try:
        return file_path.read_text(encoding=encoding, errors='ignore')
    except Exception as e:
        logger.error(f"Error reading file {file_path}: {e}")
        return None


def write_file_safely(file_path: Path, content: str, encoding: str = 'utf-8') -> bool:
    """
    Write file content safely with error handling.
    
    Args:
        file_path: Path to file
        content: Content to write
        encoding: File encoding
        
    Returns:
        True if successful
    """
    try:
        ensure_directory(file_path.parent)
        file_path.write_text(content, encoding=encoding)
        logger.debug(f"Wrote file: {file_path}")
        return True
    except Exception as e:
        logger.error(f"Error writing file {file_path}: {e}")
        return False
