"""
Script to create OAuth 2.0 credentials for desktop application
"""
import json
import subprocess
import sys

PROJECT_ID = 'macro-shadow-458705-v8'

def create_oauth_client():
    """Create OAuth 2.0 client ID for desktop application."""
    print(f"Creating OAuth 2.0 client ID for project: {PROJECT_ID}")
    
    # Check if OAuth client already exists
    try:
        result = subprocess.run(
            ['gcloud', 'auth', 'application-default', 'print-access-token', '--project', PROJECT_ID],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            print("✓ Authentication already configured")
            print("\nNote: You need to manually create OAuth 2.0 credentials from Google Cloud Console:")
            print(f"1. Go to: https://console.cloud.google.com/apis/credentials?project={PROJECT_ID}")
            print("2. Click 'Create Credentials' > 'OAuth client ID'")
            print("3. Select 'Desktop app' as application type")
            print("4. Name it 'GAS Retriever'")
            print("5. Download the credentials JSON")
            print("6. Save it as 'credentials.json' in this directory")
            return True
    except Exception as e:
        print(f"Note: {e}")
    
    print("\nManual steps required:")
    print(f"1. Visit: https://console.cloud.google.com/apis/credentials?project={PROJECT_ID}")
    print("2. Click 'Create Credentials' > 'OAuth client ID'")
    print("3. If prompted, configure OAuth consent screen:")
    print("   - User Type: External")
    print("   - Add your email as test user")
    print("   - Add scopes: Drive API, Apps Script API, Sheets API")
    print("4. Create OAuth client ID:")
    print("   - Application type: Desktop app")
    print("   - Name: GAS Retriever")
    print("5. Download credentials and save as 'credentials.json'")
    
    return False

if __name__ == '__main__':
    create_oauth_client()
