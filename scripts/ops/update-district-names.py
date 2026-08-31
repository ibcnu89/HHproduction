#!/usr/bin/env python3
"""
Update district names in outreach_prospects from Urban Institute NCES data.
The 'district' column currently has state codes (NV, UT, etc) instead of actual 
district names (Clark County, etc). This script fetches the correct LEA names.
"""

import os
import json
import time
import requests
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get("DATABASE_URL")

# FIPS codes for all US states/territories
STATE_FIPS = {
    'AL': 1, 'AK': 2, 'AZ': 4, 'AR': 5, 'CA': 6, 'CO': 8, 'CT': 9,
    'DE': 10, 'DC': 11, 'FL': 12, 'GA': 13, 'HI': 15, 'ID': 16,
    'IL': 17, 'IN': 18, 'IA': 19, 'KS': 20, 'KY': 21, 'LA': 22,
    'ME': 23, 'MD': 24, 'MA': 25, 'MI': 26, 'MN': 27, 'MS': 28,
    'MO': 29, 'MT': 30, 'NE': 31, 'NV': 32, 'NH': 33, 'NJ': 34,
    'NM': 35, 'NY': 36, 'NC': 37, 'ND': 38, 'OH': 39, 'OK': 40,
    'OR': 41, 'PA': 42, 'RI': 44, 'SC': 45, 'SD': 46, 'TN': 47,
    'TX': 48, 'UT': 49, 'VT': 50, 'VA': 51, 'WA': 53, 'WV': 54,
    'WI': 55, 'WY': 56
}

def fetch_lea_names_for_state(state_code: str) -> dict:
    """Fetch LEA names from Urban Institute API for a state."""
    fips = STATE_FIPS.get(state_code)
    if not fips:
        return {}
    
    try:
        resp = requests.get(
            f"https://educationdata.urban.org/api/v1/schools/ccd/directory/2024/?fips={fips}",
            timeout=30
        )
        if resp.status_code != 200:
            print(f"  API error for {state_code}: {resp.status_code}")
            return {}
        
        data = resp.json()
        leas = {}
        for school in data.get("results", []):
            leaid = school.get("leaid", "")
            lea_name = school.get("lea_name", "")
            if leaid and lea_name:
                if leaid not in leas:
                    leas[leaid] = lea_name
        
        return leas
    except Exception as e:
        print(f"  Error fetching {state_code}: {e}")
        return {}


def main():
    print("=== Updating District Names from NCES ===")
    
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Get all unique states with districts
    cursor.execute("""
        SELECT DISTINCT state FROM outreach_prospects 
        WHERE nces_district_id IS NOT NULL ORDER BY state
    """)
    states = [row["state"] for row in cursor.fetchall()]
    print(f"Found {len(states)} states to process")
    
    total_updated = 0
    
    for state in states:
        print(f"\nProcessing {state}...")
        lea_names = fetch_lea_names_for_state(state)
        print(f"  Found {len(lea_names)} LEAs")
        
        if not lea_names:
            continue
        
        # Update prospects with real district names
        update_cursor = conn.cursor()
        for leaid, lea_name in lea_names.items():
            update_cursor.execute("""
                UPDATE outreach_prospects 
                SET district = %s
                WHERE nces_district_id = %s AND state = %s
            """, [lea_name, leaid, state])
            total_updated += update_cursor.rowcount
        
        conn.commit()
        update_cursor.close()
        time.sleep(0.5)  # Rate limit
    
    cursor.close()
    conn.close()
    
    print(f"\n=== Complete: Updated {total_updated} prospect records with real district names ===")


if __name__ == "__main__":
    main()