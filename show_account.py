"""
Show which Google account is currently authenticated
"""
import pickle
from googleapiclient.discovery import build

def get_credentials():
    """Get credentials from token.pickle"""
    with open('token.pickle', 'rb') as token:
        creds = pickle.load(token)
    return creds

def main():
    print("Checking authenticated account...\n")
    
    creds = get_credentials()
    drive_service = build('drive', 'v3', credentials=creds)
    
    # Get user info
    about = drive_service.about().get(fields="user").execute()
    user = about.get('user', {})
    
    print("Currently authenticated as:")
    print(f"  Email: {user.get('emailAddress', 'Unknown')}")
    print(f"  Name: {user.get('displayName', 'Unknown')}")
    print(f"  Permission ID: {user.get('permissionId', 'Unknown')}")
    
    print("\n" + "="*50)
    print("\nTo use a different account:")
    print("  1. Delete token.pickle")
    print("  2. Run the script again")
    print("  3. Authenticate with the correct Google account")

if __name__ == '__main__':
    main()
