#!/usr/bin/env python3
"""
Email Enrichment for Top 100 District-Level Contacts
Uses NCES CCD, Hunter.io, and district website scraping
"""

import os
import re
import json
import time
import asyncio
import requests
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urljoin
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.extras import RealDictRow

DATABASE_URL = os.environ.get("DATABASE_URL")

@dataclass
class DistrictContact:
    nces_district_id: str
    district_name: str
    state: str
    school_count: int
    email: str = ""
    phone: str = ""
    website: str = ""
    superintendent: str = ""
    source: str = ""
    verified: bool = False
    enrichment_date: Optional[datetime] = None


def get_top_districts(limit: int = 100) -> List[Dict]:
    """Get top 100 districts by school count"""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("""
        SELECT nces_district_id, district, state, count(*) as school_count
        FROM outreach_prospects
        WHERE nces_district_id IS NOT NULL
        GROUP BY nces_district_id, district, state
        ORDER BY school_count DESC
        LIMIT %s
    """, [limit])
    
    results = cursor.fetchall()
    cursor.close()
    conn.close()
    # Convert RealDictRow to dict
    return [dict(row) for row in results]


def fetch_nces_district_data(nces_district_id: str, state_fips: str) -> Optional[Dict]:
    """Try to fetch district data from Urban Institute API"""
    # The API endpoint for districts seems to not exist, but let's try
    # alternative: we can get district info from the school data we already have
    return None


def search_hunter_domain(domain: str, api_key: str = None) -> List[Dict]:
    """Search Hunter.io for emails at a domain"""
    if not api_key:
        return []
    
    try:
        url = "https://api.hunter.io/v2/domain-search"
        params = {
            "domain": domain,
            "api_key": api_key,
            "limit": 10
        }
        resp = requests.get(url, params=params, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("data", {}).get("emails", [])
    except Exception as e:
        print(f"  Hunter error for {domain}: {e}")
    return []


def verify_email_hunter(email: str, api_key: str) -> Dict:
    """Verify email using Hunter.io"""
    try:
        url = "https://api.hunter.io/v2/email-verifier"
        params = {"email": email, "api_key": api_key}
        resp = requests.get(url, params=params, timeout=10)
        if resp.status_code == 200:
            return resp.json().get("data", {})
    except Exception as e:
        print(f"  Verification error for {email}: {e}")
    return {}


def find_district_website(district_name: str, state: str) -> Optional[str]:
    """Search for district website using common patterns"""
    # Common district website patterns
    clean_name = re.sub(r'[^\w\s-]', '', district_name.lower())
    clean_name = re.sub(r'\s+', '-', clean_name).strip('-')
    
    patterns = [
        f"https://www.{clean_name}.k12.{state.lower()}.us",
        f"https://{clean_name}.k12.{state.lower()}.us",
        f"https://www.{clean_name}.org",
        f"https://{clean_name}.org",
        f"https://www.{clean_name}.net",
        f"https://{clean_name}.net",
        f"https://www.{clean_name}isd.org",
        f"https://{clean_name}isd.org",
    ]
    
    for url in patterns:
        try:
            resp = requests.head(url, timeout=5, allow_redirects=True)
            if resp.status_code == 200:
                return url
        except:
            continue
    return None


async def scrape_district_contacts(url: str) -> List[Dict]:
    """Use Playwright to scrape district staff directory - DISABLED for now"""
    # Playwright not available in this environment
    # Return empty list
    return []


def enrich_district(district: Dict, hunter_key: Optional[str] = None) -> DistrictContact:
    """Enrich a single district with contact info"""
    nces_id = district["nces_district_id"]
    name = district["district"]
    state = district["state"]
    count = district["school_count"]
    
    contact = DistrictContact(
        nces_district_id=nces_id,
        district_name=name,
        state=state,
        school_count=count,
        enrichment_date=datetime.now()
    )
    
    # Try to find district website
    print(f"  Finding website for {name}...")
    website = find_district_website(name, state)
    if website:
        contact.website = website
        contact.source += "website_found;"
        print(f"    Found website: {website}")
        
        # If Hunter key available, search domain
        if hunter_key and website:
            domain = website.replace("https://", "").replace("http://", "").split("/")[0]
            emails = search_hunter_domain(domain, hunter_key)
            for e in emails:
                email_addr = e.get("value", "")
                if email_addr and any(kw in email_addr.lower() for kw in ['super', 'director', 'admin', 'tech', 'curriculum', 'cio', 'cto']):
                    contact.email = email_addr
                    contact.source += "hunter;"
                    break
            
            # Verify if we got one
            if contact.email:
                result = verify_email_hunter(contact.email, hunter_key)
                contact.verified = result.get("status") == "valid"
    
    return contact


def update_database(contacts: List[DistrictContact]) -> Dict:
    """Update outreach_prospects with enriched district emails"""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    stats = {"updated": 0, "errors": 0}
    
    for contact in contacts:
        if not contact.email:
            continue
        
        try:
            # Update all prospects in this district with the email
            cursor.execute("""
                UPDATE outreach_prospects
                SET email = %s
                WHERE nces_district_id = %s
                AND (email IS NULL OR email = '')
            """, [contact.email, contact.nces_district_id])
            
            if cursor.rowcount > 0:
                stats["updated"] += cursor.rowcount
                print(f"  Updated {cursor.rowcount} prospects in {contact.district_name} with {contact.email}")
        except Exception as e:
            print(f"  Error updating {contact.district_name}: {e}")
            stats["errors"] += 1
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return stats


def generate_report(contacts: List[DistrictContact], stats: Dict) -> Dict:
    """Generate enrichment report"""
    found = sum(1 for c in contacts if c.email)
    verified = sum(1 for c in contacts if c.verified)
    missing = len(contacts) - found
    
    return {
        "total_districts": len(contacts),
        "emails_found": found,
        "emails_verified": verified,
        "emails_missing": missing,
        "prospects_updated": stats.get("updated", 0),
        "errors": stats.get("errors", 0),
        "details": [
            {
                "district": c.district_name,
                "state": c.state,
                "schools": c.school_count,
                "email": c.email or "MISSING",
                "verified": c.verified,
                "source": c.source,
                "website": c.website
            }
            for c in contacts
        ]
    }


def main():
    print("=== District Email Enrichment ===")
    
    # Get top 100 districts
    districts = get_top_districts(100)
    print(f"Found {len(districts)} districts to enrich")
    
    # Hunter.io API key (set as env var or leave None for free tier limits)
    hunter_key = os.environ.get("HUNTER_API_KEY")
    if hunter_key:
        print(f"Hunter.io API key configured")
    else:
        print("No Hunter.io API key - will use website scraping only")
    
    # Enrich each district
    contacts = []
    for i, district in enumerate(districts):
        print(f"\n[{i+1}/{len(districts)}] Enriching {district['district']} ({district['state']})...")
        contact = enrich_district(district, hunter_key)
        contacts.append(contact)
        time.sleep(0.5)  # Rate limiting
    
    # Update database
    print("\nUpdating database...")
    stats = update_database(contacts)
    
    # Generate report
    report = generate_report(contacts, stats)
    
    # Save report
    report_file = f"/home/ibcnu/HHproduction-workdir/district_email_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2, default=str)
    
    print(f"\n=== ENRICHMENT COMPLETE ===")
    print(f"Districts processed: {report['total_districts']}")
    print(f"Emails found: {report['emails_found']}")
    print(f"Emails verified: {report['emails_verified']}")
    print(f"Emails missing: {report['emails_missing']}")
    print(f"Prospects updated: {report['prospects_updated']}")
    print(f"Report saved: {report_file}")
    
    # Show missing
    print("\nMissing emails:")
    for d in report["details"]:
        if d["email"] == "MISSING":
            print(f"  {d['district']} ({d['state']}) - {d['schools']} schools")


if __name__ == "__main__":
    main()