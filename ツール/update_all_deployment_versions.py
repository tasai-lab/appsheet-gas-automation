"""
Update deployment versions for all Appsheet GAS projects
"""
import os
import json
import pickle
from pathlib import Path
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

def get_credentials():
    """Get credentials from token.pickle"""
    with open('token.pickle', 'rb') as token:
        creds = pickle.load(token)
    return creds


def get_script_id_from_metadata(project_dir):
    """Get script ID from project metadata"""
    metadata_file = project_dir / 'project_metadata.json'
    
    if not metadata_file.exists():
        return None
    
    with open(metadata_file, 'r', encoding='utf-8') as f:
        metadata = json.load(f)
    
    return metadata.get('id')


def get_or_create_deployment(service, script_id):
    """Get existing deployment or create new one"""
    try:
        # List existing deployments
        response = service.projects().deployments().list(
            scriptId=script_id
        ).execute()
        
        deployments = response.get('deployments', [])
        
        # Find non-HEAD deployment
        for deployment in deployments:
            if deployment.get('deploymentConfig', {}).get('description') != '@HEAD':
                return deployment['deploymentId']
        
        # Create new deployment if none exists
        print("    Creating new deployment...")
        deploy_response = service.projects().deployments().create(
            scriptId=script_id,
            body={
                'deploymentConfig': {
                    'scriptId': script_id,
                    'description': 'Version 1 - Initial deployment',
                    'manifestFileName': 'appsscript',
                    'versionNumber': 1
                }
            }
        ).execute()
        
        return deploy_response['deploymentId']
    
    except HttpError as error:
        print(f"    ✗ Error getting/creating deployment: {error}")
        return None


def update_deployment_version(service, script_id, deployment_id):
    """Update deployment to latest version"""
    try:
        # Get latest version
        versions = service.projects().versions().list(scriptId=script_id).execute()
        version_list = versions.get('versions', [])
        
        if not version_list:
            print("    ✗ No versions found")
            return False
        
        latest_version = version_list[0]['versionNumber']
        
        print(f"    Latest version: {latest_version}")
        
        # Update deployment
        service.projects().deployments().update(
            scriptId=script_id,
            deploymentId=deployment_id,
            body={
                'deploymentConfig': {
                    'scriptId': script_id,
                    'versionNumber': latest_version,
                    'manifestFileName': 'appsscript',
                    'description': f'Version {latest_version} - Updated deployment'
                }
            }
        ).execute()
        
        print(f"    ✓ Deployment updated to version {latest_version}")
        return True
    
    except HttpError as error:
        error_message = str(error)
        
        # If deployment is read-only, create new one
        if 'Read-only' in error_message or 'may not be modified' in error_message:
            print("    ! Read-only deployment, creating new one...")
            
            try:
                versions = service.projects().versions().list(scriptId=script_id).execute()
                version_list = versions.get('versions', [])
                latest_version = version_list[0]['versionNumber'] if version_list else 1
                
                service.projects().deployments().create(
                    scriptId=script_id,
                    body={
                        'versionNumber': latest_version,
                        'manifestFileName': 'appsscript',
                        'description': f'Version {latest_version} - New deployment'
                    }
                ).execute()
                
                print(f"    OK New deployment created with version {latest_version}")
                return True
            except HttpError as create_error:
                print(f"    X Failed to create new deployment: {str(create_error)[:100]}")
                return False
        else:
            print(f"    ✗ Error updating deployment: {error}")
            return False


def update_project_deployment(project_dir):
    """Update deployment for a single project"""
    project_name = project_dir.name
    print(f"\n[{project_name}]")
    
    # Get script ID
    script_id = get_script_id_from_metadata(project_dir)
    
    if not script_id:
        print("  ✗ Script ID not found in metadata")
        return False
    
    print(f"  Script ID: {script_id}")
    
    # Get credentials and service
    creds = get_credentials()
    service = build('script', 'v1', credentials=creds)
    
    # Get or create deployment
    deployment_id = get_or_create_deployment(service, script_id)
    
    if not deployment_id:
        return False
    
    print(f"  Deployment ID: {deployment_id}")
    
    # Update deployment version
    return update_deployment_version(service, script_id, deployment_id)


def main():
    print("=" * 70)
    print("Update Deployment Versions for All Appsheet Projects")
    print("=" * 70)
    
    gas_projects_dir = Path('gas_projects')
    
    if not gas_projects_dir.exists():
        print("✗ gas_projects directory not found")
        return
    
    # Get all Appsheet projects
    projects = [d for d in gas_projects_dir.iterdir() 
                if d.is_dir() and 'appsheet' in d.name.lower()]
    
    total = len(projects)
    success_count = 0
    
    for idx, project_dir in enumerate(sorted(projects), 1):
        print(f"\n[{idx}/{total}] ", end='')
        if update_project_deployment(project_dir):
            success_count += 1
    
    print("\n" + "=" * 70)
    print(f"✓ Update complete!")
    print(f"  Total projects: {total}")
    print(f"  Successful: {success_count}")
    print(f"  Failed: {total - success_count}")
    print("=" * 70)


if __name__ == '__main__':
    main()
