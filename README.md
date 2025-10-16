# Google Apps Script Retriever

Professional tool to retrieve Google Apps Script (GAS) files containing "Appsheet" from Google Drive and organize them with their referenced spreadsheet data.

## Features

- 🔍 Searches for all GAS files containing "Appsheet" in the specified Google Drive folder
- 📥 Downloads complete script content (all .gs, .html, and .json files)
- 📊 Automatically detects and retrieves referenced spreadsheet metadata
- 📁 Organizes each GAS project in a professional folder structure
- 📝 Generates comprehensive README files for each project

## Folder Structure

Each retrieved GAS project is organized as follows:

```
gas_projects/
└── [Project Name]/
    ├── README.md                    # Project overview and documentation
    ├── project_metadata.json        # Complete project metadata
    ├── appsscript.json             # Apps Script manifest
    ├── scripts/                     # All script files
    │   ├── Code.gs
    │   ├── Utils.gs
    │   └── Page.html
    └── spreadsheets/                # Referenced spreadsheet metadata
        └── [Spreadsheet Name]_metadata.json
```

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Drive API
   - Google Apps Script API
   - Google Sheets API
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Desktop app" as the application type
   - Download the credentials JSON file
   - Save it as `credentials.json` in this directory

### 3. Run the Script

```bash
python gas_retriever.py
```

On first run, the script will:
- Open your browser for Google authentication
- Request permissions to read your Drive files, Apps Script projects, and Spreadsheets
- Save authentication token in `token.pickle` for future use

## Configuration

To search a different folder, modify the `FOLDER_ID` variable in `gas_retriever.py`:

```python
FOLDER_ID = '16swPUizvdlyPxUjbDpVl9-VBDJZO91kX'  # Replace with your folder ID
```

To change the output directory:

```python
OUTPUT_DIR = 'gas_projects'  # Replace with desired directory name
```

## Output

The script will:
1. Search the specified Google Drive folder
2. Find all GAS files with "Appsheet" in the name
3. Download each GAS project's content
4. Extract spreadsheet IDs from the code
5. Retrieve metadata for each referenced spreadsheet
6. Organize everything in professional folder structures
7. Generate documentation for each project

## Troubleshooting

### "credentials.json not found"
- Make sure you've downloaded the OAuth credentials from Google Cloud Console
- Save the file as `credentials.json` in the same directory as the script

### "Authentication failed"
- Delete `token.pickle` and run the script again
- Make sure you're using the correct Google account

### "Permission denied" errors
- Ensure all required APIs are enabled in Google Cloud Console
- Check that your OAuth consent screen is properly configured

### No files found
- Verify the folder ID is correct
- Ensure the folder contains GAS files with "Appsheet" in the name
- Check that you have access to the folder with the authenticated account

## Security Notes

- Never commit `credentials.json` or `token.pickle` to version control
- Add these files to `.gitignore`
- Keep your credentials secure and private

## License

MIT License - Feel free to use and modify as needed.
