import sqlite3
import json
import os

# 1. SETUP PATHS
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(script_dir, '..', 'backend')
db_path = os.path.join(backend_dir, 'users.db')

# 2. DATA
data = [
  {
    "username": "admin",
    "userUID": 1,
    "userEmail": "LegionCinemaAdmin@gmail.com",
    "userTier": "Free",
    "userLanguage": "en",
    "searchCount": 0,
    "viewCount": 0,
    "allUIDs": [1],
    "userPassword": "$2b$10$cNEPvsPkiIiwzSqw1A.qEutpmYK..DtbImPv.xz/VOMzMNMN/xf3a"
  }
]

# 3. DATABASE OPERATIONS
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Wipe the table
cursor.execute('DELETE FROM users')

# Insert data using EXPLICIT column names to avoid "datatype mismatch"
for user in data:
    cursor.execute('''
        INSERT INTO users (
            userUID, 
            username, 
            userEmail, 
            userTier, 
            userLanguage, 
            searchCount, 
            viewCount, 
            allUIDs, 
            userPassword
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        user['userUID'],
        user['username'],
        user['userEmail'],
        user['userTier'],
        user['userLanguage'],
        user['searchCount'],
        user['viewCount'],
        json.dumps(user['allUIDs']),
        user['userPassword']
    ))

conn.commit()
conn.close()

print(f"Success! Data wiped and reset in: {db_path}")