"""
Get folder information and verify access
"""
import pickle
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

FOLDER_ID = '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX'

def get_credentials():
    """Get credentials from token.pickle"""
    with open('token.pickle', 'rb') as token:
        creds = pickle.load(token)
    return creds

def main():
    print("Verifying folder access...")
    print(f"Folder ID: {FOLDER_ID}\n")
    
    creds = get_credentials()
    drive_service = build('drive', 'v3', credentials=creds)
    
    try:
        # Get folder metadata
        folder = drive_service.files().get(
            fileId=FOLDER_ID,
            fields="id, name, mimeType, owners, shared, capabilities, permissions",
            supportsAllDrives=True
        ).execute()
        
        print("Folder Information:")
        print(f"  Name: {folder.get('name')}")
        print(f"  MIME Type: {folder.get('mimeType')}")
        print(f"  Shared: {folder.get('shared', False)}")
        
        if 'owners' in folder:
            print(f"  Owners:")
            for owner in folder['owners']:
                print(f"    - {owner.get('displayName', owner.get('emailAddress'))}")
        
        if 'capabilities' in folder:
            caps = folder['capabilities']
            print(f"\n  Your Capabilities:")
            print(f"    - Can List Children: {caps.get('canListChildren', False)}")
            print(f"    - Can Read: {caps.get('canReadRevisions', False)}")
            print(f"    - Can Share: {caps.get('canShare', False)}")
        
        # Try to list children
        print("\n" + "="*50)
        print("Attempting to list folder contents...")
        
        results = drive_service.files().list(
            q=f"'{FOLDER_ID}' in parents and trashed=false",
            fields="files(id, name, mimeType)",
            pageSize=10,
            supportsAllDrives=True,
            includeItemsFromAllDrives=True
        ).execute()
        
        files = results.get('files', [])
        print(f"Found {len(files)} item(s):")
        for f in files:
            print(f"  - {f['name']} ({f['mimeType']})")
            
    except HttpError as error:
        print(f"Error accessing folder: {error}")
        print("\nPossible issues:")
        print("  1. Folder ID might be incorrect")
        print("  2. You might not have access to this folder")
        print("  3. Folder might be in a different Google account")

if __name__ == '__main__':
    main()
