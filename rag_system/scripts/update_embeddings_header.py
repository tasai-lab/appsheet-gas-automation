#!/usr/bin/env python3
"""Embeddingsシートのヘッダーを更新"""
import sys
sys.path.append('..')
from backend.config import get_sheets_service

SPREADSHEET_ID = '1roSp4WKubXVzZ6iWd6OY5lMU5OpvFsVNQHy11_Ym-wA'

service = get_sheets_service()
values = [['kb_id', 'model', 'dimension', 'embedding_part1', 'embedding_part2', 'embedding_part3', 'created_at']]
result = service.spreadsheets().values().update(
    spreadsheetId=SPREADSHEET_ID,
    range='Embeddings!A1:G1',
    valueInputOption='RAW',
    body={'values': values}
).execute()
print(f'✅ ヘッダー更新完了: {result.get("updatedCells")}セル')
