"""
Re-authenticate with full scopes for spreadsheet creation
"""
import os
import pickle
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/script.projects',
]

PROJECT_ID = 'macro-shadow-458705-v8'

def main():
    print("Re-authenticating with full scopes...")
    print(f"Scopes: {SCOPES}\n")
    
    # Delete existing token
    if os.path.exists('token.pickle'):
        os.remove('token.pickle')
        print("✓ Removed old token.pickle")
    
    # Perform OAuth flow
    flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
    flow.oauth2session.project_id = PROJECT_ID
    
    creds = flow.run_local_server(port=0)
    
    # Save credentials
    with open('token.pickle', 'wb') as token:
        pickle.dump(creds, token)
    
    print("✓ Authentication successful!")
    print("✓ New token.pickle created with full scopes")

if __name__ == '__main__':
    main()
