@echo off
echo Google Apps Script Retriever - Setup
echo ====================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.7 or higher from https://www.python.org/
    pause
    exit /b 1
)

echo Python found!
echo.

REM Install dependencies
echo Installing required packages...
pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo ====================================
echo Setup completed successfully!
echo.
echo Next steps:
echo 1. Download OAuth credentials from Google Cloud Console
echo 2. Save credentials file as 'credentials.json' in this directory
echo 3. Run: python gas_retriever.py
echo.
echo See README.md for detailed instructions.
echo ====================================
pause
