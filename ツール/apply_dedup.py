#!/usr/bin/env python3
"""
CLI for applying duplication prevention to GAS projects.

Usage:
    python apply_dedup.py [--projects-dir DIR] [--library-file FILE]
"""

import sys
import logging
import argparse
from pathlib import Path

# Add src to path (parent directory)
sys.path.insert(0, str(Path(__file__).parent.parent))

from src import config
from src.services import ProjectAnalyzer, DedupApplicator


def setup_logging(verbose: bool = False):
    """Setup logging configuration."""
    level = logging.DEBUG if verbose else logging.INFO
    
    logging.basicConfig(
        level=level,
        format=config.LOG_FORMAT,
        datefmt=config.LOG_DATE_FORMAT
    )


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Apply duplication prevention library to GAS projects',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        '--projects-dir',
        type=Path,
        default=config.OUTPUT_DIR,
        help=f'Projects directory (default: {config.OUTPUT_DIR})'
    )
    
    parser.add_argument(
        '--library-file',
        type=Path,
        default=config.LIBRARY_FILE,
        help=f'Duplication prevention library file (default: {config.LIBRARY_FILE})'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without making changes'
    )
    
    return parser.parse_args()


def main():
    """Main entry point."""
    args = parse_arguments()
    setup_logging(args.verbose)
    
    logger = logging.getLogger(__name__)
    
    print("="*70)
    print("Duplication Prevention Applicator v2.0")
    print("="*70)
    print()
    
    try:
        # Verify library file exists
        if not args.library_file.exists():
            logger.error(f"Library file not found: {args.library_file}")
            return 1
        
        # Analyze projects
        logger.info("Analyzing projects...")
        analyzer = ProjectAnalyzer(args.projects_dir)
        projects_needing_dedup = analyzer.find_projects_needing_dedup()
        
        if not projects_needing_dedup:
            logger.info("No projects need duplication prevention")
            return 0
        
        print()
        print(f"Found {len(projects_needing_dedup)} project(s) needing duplication prevention:")
        for analysis in projects_needing_dedup:
            status = "✅" if not analysis.has_duplication_prevention else "⚠️"
            print(f"  {status} {analysis.project_name}")
            if analysis.estimated_record_id_field:
                print(f"      Record ID: {analysis.estimated_record_id_field}")
        print()
        
        if args.dry_run:
            logger.info("Dry run mode - no changes will be made")
            return 0
        
        # Apply duplication prevention
        logger.info("Applying duplication prevention...")
        applicator = DedupApplicator(args.library_file)
        stats = applicator.apply_to_multiple(projects_needing_dedup)
        
        # Summary
        print()
        print("="*70)
        print(f"✅ Applied: {stats['applied']}")
        print(f"⏭️  Skipped: {stats['skipped']} (already exists)")
        print(f"❌ Failed: {stats['failed']}")
        print("="*70)
        print()
        print("Next steps:")
        print("  1. Review each project's MIGRATION_GUIDE.md")
        print("  2. Update doPost functions as recommended")
        print("  3. Test in Apps Script Editor")
        print("  4. Deploy to production")
        print()
        print("Documentation: DUPLICATION_PREVENTION_GUIDE.md")
        
        return 0
        
    except KeyboardInterrupt:
        logger.info("\nOperation cancelled by user")
        return 130
    
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=args.verbose)
        return 1


if __name__ == '__main__':
    sys.exit(main())
