"""
Configuration module for Google Apps Script Retriever.

This module centralizes all configuration settings.
"""

from pathlib import Path
from typing import List

# ========================================
# Google Cloud Configuration
# ========================================

PROJECT_ID = 'macro-shadow-458705-v8'

SCOPES: List[str] = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/script.projects.readonly',
    'https://www.googleapis.com/auth/script.projects',  # For deployment management
    'https://www.googleapis.com/auth/script.deployments',  # For deployment updates
    'https://www.googleapis.com/auth/spreadsheets.readonly'
]

# ========================================
# File Paths
# ========================================

BASE_DIR = Path(__file__).parent.parent
CREDENTIALS_FILE = BASE_DIR / 'credentials.json'
TOKEN_FILE = BASE_DIR / 'token.pickle'
OUTPUT_DIR = BASE_DIR / 'gas_projects'
LIBRARY_FILE = BASE_DIR / 'DuplicationPrevention.gs'

# ========================================
# Google Drive Configuration
# ========================================

FOLDER_ID = '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX'
PROJECT_NAME_FILTER = 'appsheet'

# ========================================
# API Settings
# ========================================

API_PAGE_SIZE = 100
SUPPORTS_ALL_DRIVES = True
INCLUDE_ITEMS_FROM_ALL_DRIVES = True

# ========================================
# Regex Patterns
# ========================================

SPREADSHEET_ID_PATTERNS: List[str] = [
    r'SpreadsheetApp\.openById\(["\']([a-zA-Z0-9-_]+)["\']\)',
    r'SpreadsheetApp\.openByUrl\(["\']https://docs\.google\.com/spreadsheets/d/([a-zA-Z0-9-_]+)',
    r'["\']([a-zA-Z0-9-_]{44})["\']',
]

GEMINI_API_PATTERNS: List[str] = [
    r'gemini',
    r'generativelanguage\.googleapis\.com',
    r'generateContent'
]

WEBHOOK_PATTERNS: List[str] = [
    r'function\s+doPost\s*\(',
    r'function\s+doGet\s*\('
]

DEDUP_PATTERNS: List[str] = [
    r'executeWebhookWithDuplicationPrevention',
    r'checkDuplicateRequest',
    r'markAsProcessingWithLock'
]

# ========================================
# File Extensions
# ========================================

GAS_FILE_EXTENSIONS = {
    'SERVER_JS': '.gs',
    'HTML': '.html',
    'JSON': '.json'
}

DEFAULT_EXTENSION = '.txt'

# ========================================
# Logging
# ========================================

LOG_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
LOG_DATE_FORMAT = '%Y-%m-%d %H:%M:%S'
