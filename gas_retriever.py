"""
Google Apps Script Retriever
Retrieves all GAS files containing "Appsheet" from a Google Drive folder
and organizes them with their referenced spreadsheet data.
"""

import os
import json
import re
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import pickle

# If modifying these scopes, delete the file token.pickle.
SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/script.projects.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly'
]

FOLDER_ID = '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX'
OUTPUT_DIR = 'gas_projects'
PROJECT_ID = 'macro-shadow-458705-v8'


def get_credentials():
    """Get valid user credentials from storage or prompt for authorization."""
    creds = None
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            flow.oauth2session.project_id = PROJECT_ID
            creds = flow.run_local_server(port=0)
        
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)
    
    return creds


def sanitize_filename(name):
    """Sanitize filename to be filesystem-safe."""
    # Remove invalid characters
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    # Remove leading/trailing spaces and dots
    name = name.strip('. ')
    return name[:200]  # Limit length


def get_gas_files_from_folder(drive_service, folder_id, recursive=True):
    """Retrieve all GAS files containing 'Appsheet' or 'Automation' from the specified folder."""
    try:
        all_gas_files = []
        
        if recursive:
            # Get all descendants (including subfolders)
            query = f"'{folder_id}' in parents and trashed=false"
            results = drive_service.files().list(
                q=query,
                fields="files(id, name, mimeType, createdTime, modifiedTime, owners, parents)",
                pageSize=100,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True
            ).execute()
            
            items = results.get('files', [])
            
            # Process GAS files
            for item in items:
                if item.get('mimeType') == 'application/vnd.google-apps.script':
                    all_gas_files.append(item)
                elif item.get('mimeType') == 'application/vnd.google-apps.folder':
                    # Recursively search subfolders
                    print(f"  Searching subfolder: {item['name']}")
                    subfolder_files = get_gas_files_from_folder(drive_service, item['id'], recursive=True)
                    all_gas_files.extend(subfolder_files)
        else:
            # Only search direct children
            query = f"'{folder_id}' in parents and mimeType='application/vnd.google-apps.script' and trashed=false"
            results = drive_service.files().list(
                q=query,
                fields="files(id, name, createdTime, modifiedTime, owners, parents)",
                pageSize=100,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True
            ).execute()
            
            all_gas_files = results.get('files', [])
        
        # Debug: Show all files found
        print(f"\nDebug: Found {len(all_gas_files)} total GAS file(s):")
        for f in all_gas_files:
            print(f"  - {f['name']}")
        
        # Filter files containing "Appsheet" or "Automation" in the name
        filtered_files = [f for f in all_gas_files if 'appsheet' in f['name'].lower() or 'automation' in f['name'].lower()]
        
        return filtered_files
    except HttpError as error:
        print(f'An error occurred: {error}')
        return []


def get_script_content(script_service, script_id):
    """Get the content of a Google Apps Script project."""
    try:
        script_project = script_service.projects().getContent(
            scriptId=script_id
        ).execute()
        return script_project
    except HttpError as error:
        print(f'Error getting script content for {script_id}: {error}')
        return None


def extract_spreadsheet_ids(script_content):
    """Extract spreadsheet IDs referenced in the script."""
    spreadsheet_ids = set()
    
    if not script_content or 'files' not in script_content:
        return list(spreadsheet_ids)
    
    # Patterns to match spreadsheet IDs
    patterns = [
        r'SpreadsheetApp\.openById\(["\']([a-zA-Z0-9-_]+)["\']\)',
        r'SpreadsheetApp\.openByUrl\(["\']https://docs\.google\.com/spreadsheets/d/([a-zA-Z0-9-_]+)',
        r'["\']([a-zA-Z0-9-_]{44})["\']',  # Generic spreadsheet ID pattern
    ]
    
    for file in script_content['files']:
        if 'source' in file:
            source_code = file['source']
            for pattern in patterns:
                matches = re.findall(pattern, source_code)
                spreadsheet_ids.update(matches)
    
    return list(spreadsheet_ids)


def get_spreadsheet_data(sheets_service, spreadsheet_id):
    """Get spreadsheet metadata and data."""
    try:
        # Get spreadsheet metadata
        spreadsheet = sheets_service.spreadsheets().get(
            spreadsheetId=spreadsheet_id
        ).execute()
        
        return spreadsheet
    except HttpError as error:
        print(f'Error getting spreadsheet {spreadsheet_id}: {error}')
        return None


def save_script_project(project_name, script_id, script_content, spreadsheets_data, metadata):
    """Save script project and related data to organized folder structure."""
    # Create main project folder
    safe_name = sanitize_filename(project_name)
    project_dir = os.path.join(OUTPUT_DIR, safe_name)
    os.makedirs(project_dir, exist_ok=True)
    
    # Create subdirectories
    scripts_dir = os.path.join(project_dir, 'scripts')
    data_dir = os.path.join(project_dir, 'spreadsheets')
    os.makedirs(scripts_dir, exist_ok=True)
    os.makedirs(data_dir, exist_ok=True)
    
    # Save project metadata
    metadata_file = os.path.join(project_dir, 'project_metadata.json')
    with open(metadata_file, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    # Save script files
    if script_content and 'files' in script_content:
        for file in script_content['files']:
            file_name = file.get('name', 'Untitled')
            file_type = file.get('type', 'SERVER_JS')
            
            # Determine file extension
            if file_type == 'SERVER_JS':
                ext = '.gs'
            elif file_type == 'HTML':
                ext = '.html'
            elif file_type == 'JSON':
                ext = '.json'
            else:
                ext = '.txt'
            
            file_path = os.path.join(scripts_dir, f"{file_name}{ext}")
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(file.get('source', ''))
    
    # Save manifest
    if script_content and 'manifest' in script_content:
        manifest_file = os.path.join(project_dir, 'appsscript.json')
        with open(manifest_file, 'w', encoding='utf-8') as f:
            json.dump(script_content['manifest'], f, indent=2, ensure_ascii=False)
    
    # Save spreadsheet data
    for idx, spreadsheet_data in enumerate(spreadsheets_data):
        if spreadsheet_data:
            sheet_name = sanitize_filename(spreadsheet_data.get('properties', {}).get('title', f'spreadsheet_{idx}'))
            sheet_file = os.path.join(data_dir, f"{sheet_name}_metadata.json")
            with open(sheet_file, 'w', encoding='utf-8') as f:
                json.dump(spreadsheet_data, f, indent=2, ensure_ascii=False)
    
    # Create README
    readme_path = os.path.join(project_dir, 'README.md')
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(f"# {project_name}\n\n")
        f.write(f"**Script ID:** {script_id}\n\n")
        f.write(f"**Created:** {metadata.get('createdTime', 'N/A')}\n\n")
        f.write(f"**Modified:** {metadata.get('modifiedTime', 'N/A')}\n\n")
        f.write(f"**Owners:** {', '.join([owner.get('displayName', owner.get('emailAddress', 'Unknown')) for owner in metadata.get('owners', [])])}\n\n")
        f.write(f"## Structure\n\n")
        f.write(f"- `scripts/`: Contains all GAS script files\n")
        f.write(f"- `spreadsheets/`: Contains metadata for referenced spreadsheets\n")
        f.write(f"- `appsscript.json`: Project manifest\n")
        f.write(f"- `project_metadata.json`: Complete project metadata\n\n")
        if spreadsheets_data:
            f.write(f"## Referenced Spreadsheets\n\n")
            for spreadsheet_data in spreadsheets_data:
                if spreadsheet_data:
                    title = spreadsheet_data.get('properties', {}).get('title', 'Unknown')
                    ss_id = spreadsheet_data.get('spreadsheetId', 'Unknown')
                    f.write(f"- **{title}** (ID: {ss_id})\n")


def main():
    """Main execution function."""
    print("Google Apps Script Retriever")
    print("=" * 50)
    
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Get credentials
    print("Authenticating...")
    creds = get_credentials()
    
    # Build services
    drive_service = build('drive', 'v3', credentials=creds)
    script_service = build('script', 'v1', credentials=creds)
    sheets_service = build('sheets', 'v4', credentials=creds)
    
    # Get GAS files containing "Appsheet" or "Automation"
    print(f"\nSearching for GAS files containing 'Appsheet' or 'Automation' in folder {FOLDER_ID}...")
    gas_files = get_gas_files_from_folder(drive_service, FOLDER_ID)
    
    if not gas_files:
        print("No GAS files containing 'Appsheet' or 'Automation' found.")
        return
    
    print(f"Found {len(gas_files)} GAS file(s) containing 'Appsheet' or 'Automation':\n")
    
    # Process each GAS file
    for idx, gas_file in enumerate(gas_files, 1):
        file_name = gas_file['name']
        file_id = gas_file['id']
        
        print(f"\n[{idx}/{len(gas_files)}] Processing: {file_name}")
        print(f"    ID: {file_id}")
        
        # Get script content
        print("    Retrieving script content...")
        script_content = get_script_content(script_service, file_id)
        
        # Extract spreadsheet IDs
        print("    Extracting spreadsheet references...")
        spreadsheet_ids = extract_spreadsheet_ids(script_content)
        print(f"    Found {len(spreadsheet_ids)} spreadsheet reference(s)")
        
        # Get spreadsheet data
        spreadsheets_data = []
        for ss_id in spreadsheet_ids:
            print(f"    Retrieving spreadsheet data: {ss_id}")
            spreadsheet_data = get_spreadsheet_data(sheets_service, ss_id)
            if spreadsheet_data:
                spreadsheets_data.append(spreadsheet_data)
        
        # Save everything
        print("    Saving project...")
        save_script_project(
            file_name,
            file_id,
            script_content,
            spreadsheets_data,
            gas_file
        )
        print(f"    ✓ Saved to: {OUTPUT_DIR}/{sanitize_filename(file_name)}/")
    
    print("\n" + "=" * 50)
    print(f"✓ Successfully processed {len(gas_files)} GAS project(s)")
    print(f"✓ Output directory: {os.path.abspath(OUTPUT_DIR)}")


if __name__ == '__main__':
    main()
