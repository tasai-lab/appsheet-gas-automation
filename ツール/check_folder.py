"""
Check folder contents to see what files exist
"""
import os
import pickle
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

FOLDER_ID = '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX'

def get_credentials():
    """Get credentials from token.pickle"""
    with open('token.pickle', 'rb') as token:
        creds = pickle.load(token)
    return creds

def main():
    print("Checking folder contents...")
    print(f"Folder ID: {FOLDER_ID}\n")
    
    creds = get_credentials()
    drive_service = build('drive', 'v3', credentials=creds)
    
    # Get all files in folder (including shared drives)
    query = f"'{FOLDER_ID}' in parents and trashed=false"
    results = drive_service.files().list(
        q=query,
        fields="files(id, name, mimeType, createdTime, modifiedTime)",
        pageSize=100,
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
        corpora='allDrives'
    ).execute()
    
    files = results.get('files', [])
    
    print(f"Total files in folder: {len(files)}\n")
    
    # Group by MIME type
    by_type = {}
    for f in files:
        mime = f.get('mimeType', 'unknown')
        if mime not in by_type:
            by_type[mime] = []
        by_type[mime].append(f)
    
    # Display results
    for mime_type, file_list in sorted(by_type.items()):
        print(f"\n{mime_type}:")
        print(f"  Count: {len(file_list)}")
        for f in file_list[:10]:  # Show first 10
            print(f"  - {f['name']}")
        if len(file_list) > 10:
            print(f"  ... and {len(file_list) - 10} more")
    
    # Look for Appsheet in any file name
    print("\n" + "="*50)
    print("Files containing 'Appsheet' (case-insensitive):")
    appsheet_files = [f for f in files if 'appsheet' in f['name'].lower()]
    if appsheet_files:
        for f in appsheet_files:
            print(f"  - {f['name']} ({f['mimeType']})")
    else:
        print("  None found")
    
    # Look for Apps Script specifically
    print("\n" + "="*50)
    print("Google Apps Script files:")
    gas_files = [f for f in files if f.get('mimeType') == 'application/vnd.google-apps.script']
    if gas_files:
        for f in gas_files:
            print(f"  - {f['name']}")
    else:
        print("  None found")

if __name__ == '__main__':
    main()
