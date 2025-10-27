#!/usr/bin/env python3
"""
Main CLI for retrieving Google Apps Script projects.

Usage:
    python retrieve_gas.py [--folder-id FOLDER_ID] [--filter PATTERN] [--no-recursive]
"""

import sys
import logging
import argparse
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src import config
from src.services import AuthService, GASRetriever


def setup_logging(verbose: bool = False):
    """Setup logging configuration."""
    level = logging.DEBUG if verbose else logging.INFO
    
    logging.basicConfig(
        level=level,
        format=config.LOG_FORMAT,
        datefmt=config.LOG_DATE_FORMAT
    )
    
    # Suppress verbose Google API logs
    logging.getLogger('googleapiclient.discovery_cache').setLevel(logging.ERROR)
    logging.getLogger('googleapiclient.discovery').setLevel(logging.WARNING)


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Retrieve Google Apps Script projects from Google Drive',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        '--folder-id',
        default=config.FOLDER_ID,
        help=f'Google Drive folder ID (default: {config.FOLDER_ID})'
    )
    
    parser.add_argument(
        '--filter',
        default=config.PROJECT_NAME_FILTER,
        help=f'Filter projects by name (default: {config.PROJECT_NAME_FILTER})'
    )
    
    parser.add_argument(
        '--no-recursive',
        action='store_true',
        help='Do not search subfolders recursively'
    )
    
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=config.OUTPUT_DIR,
        help=f'Output directory (default: {config.OUTPUT_DIR})'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    
    parser.add_argument(
        '--clear-cache',
        action='store_true',
        help='Clear authentication cache and re-authenticate'
    )
    
    return parser.parse_args()


def main():
    """Main entry point."""
    args = parse_arguments()
    setup_logging(args.verbose)
    
    logger = logging.getLogger(__name__)
    
    print("="*70)
    print("Google Apps Script Retriever v2.0")
    print("="*70)
    print()
    
    try:
        # Initialize authentication
        logger.info("Initializing authentication...")
        auth_service = AuthService(
            credentials_file=config.CREDENTIALS_FILE,
            token_file=config.TOKEN_FILE,
            scopes=config.SCOPES,
            project_id=config.PROJECT_ID
        )
        
        # Clear cache if requested
        if args.clear_cache:
            logger.info("Clearing authentication cache...")
            auth_service.clear_cache()
        
        # Initialize retriever
        logger.info("Initializing GAS retriever...")
        retriever = GASRetriever(
            auth_service=auth_service,
            output_dir=args.output_dir
        )
        
        # Retrieve projects
        logger.info(f"Searching folder: {args.folder_id}")
        if args.filter:
            logger.info(f"Filtering by: '{args.filter}'")
        
        saved_projects = retriever.retrieve_projects(
            folder_id=args.folder_id,
            name_filter=args.filter,
            recursive=not args.no_recursive
        )
        
        # Summary
        print()
        print("="*70)
        print(f"✓ Successfully retrieved {len(saved_projects)} project(s)")
        print(f"✓ Output directory: {args.output_dir.absolute()}")
        print("="*70)
        
        return 0
        
    except KeyboardInterrupt:
        logger.info("\nOperation cancelled by user")
        return 130
    
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=args.verbose)
        return 1


if __name__ == '__main__':
    sys.exit(main())
