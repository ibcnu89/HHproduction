#!/usr/bin/env python3
"""
Email Enrichment - Hunter.io Waterfall
Searches for district domains, finds decision-maker emails, verifies them.

Apollo free tier: NO API access (all search/match endpoints require paid plan)
Clay v1 API: deprecated, v3 requires admin access
Hunter.io: WORKS - domain-search, email-finder, email-verifier

Strategy:
1. Get top 100 districts by student count
2. For each district, try common .k12.{state}.us domain patterns
3. Use Hunter domain-search to find emails at that domain
4. Filter for decision-makers (superintendent, director, principal, admin)
5. Verify each found email with Hunter email-verifier
6. Update prospect records in database
"""

import os
import re
import json
import time
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict

DATABASE_URL = os.environ.get("DATABASE_URL")
HUNTER_API_KEY = os.environ.get("HUNTER_API_KEY")

# Decision-maker keywords for filtering Hunter results
DECISION_MAKER_KEYWORDS = [
    'superintendent', 'director', 'principal', 'admin', 'curriculum',
    'technology', 'tech director', 'cio', 'cto', 'assistant superintendent',
    'chief', 'deputy', 'head of school', 'department head'
]

# Common school district domain patterns
def generate_domain_candidates(district_name: str, state: str, city: str = "") -> List[str]:
    """Generate likely domain names for a school district."""
    # Clean up district name - remove common suffixes
    clean = district_name
    
    # Remove common district suffixes
    for suffix in ['Public Schools', 'Public School', 'School District', 'Schools', 'School',
                   'Unified School District', 'Unified', 'Community Unit School District',
                   'Consolidated School District', 'Consolidated', 'Unit School District',
                   'Independent School District', 'Independent', 'CUSD', 'ISD', 'USD', 
                   'CSD', 'DSD', 'UHSD', 'BHSD', 'Academy', 'District', 'No.', 'No',
                   'County Schools', 'County', 'Department of Education']:
        clean = re.sub(r'\b' + re.escape(suffix) + r'\b', '', clean, flags=re.IGNORECASE)
    
    clean = re.sub(r'[^a-zA-Z0-9\s-]', '', clean).strip()
    clean = re.sub(r'\s+', '', clean.lower())
    
    # Also try first word only (common for large districts)
    first_word = clean.split()[0] if clean else ""
    
    city_clean = re.sub(r'[^a-zA-Z0-9]', '', city.lower()) if city else ""
    state_lower = state.lower()
    
    candidates = []
    
    # Patterns with k12.{state}.us
    if clean:
        candidates.append(f"{clean}.k12.{state_lower}.us")
        candidates.append(f"{first_word}.k12.{state_lower}.us")
    
    # Pattern: {city}.k12.{state}.us (very common)
    if city_clean:
        candidates.append(f"{city_clean}.k12.{state_lower}.us")
    
    # Pattern: {clean}{state}.k12.{state}.us (e.g., ccsnc.k12.nc.us -> no)
    # Try abbreviation: first letters of each word
    if len(clean.split()) > 1:
        abbr = ''.join([w[0] for w in clean.split() if w])
        if len(abbr) >= 2:
            candidates.append(f"{abbr}.k12.{state_lower}.us")
            candidates.append(f"{abbr}{state_lower}.k12.{state_lower}.us")
    
    # .org patterns
    if clean:
        candidates.append(f"{clean}.org")
        candidates.append(f"{clean}k12.org")
        candidates.append(f"{clean}sd.org")
    
    # .net patterns
    if clean:
        candidates.append(f"{clean}.net")
        candidates.append(f"{clean}k12.net")
    
    # .us patterns (without k12)
    if clean:
        candidates.append(f"{clean}.{state_lower}.us")
    
    # ISD patterns (common in TX)
    if clean:
        candidates.append(f"{clean}isd.org")
        candidates.append(f"{clean}isd.net")
        candidates.append(f"{clean}isd.com")
    
    # Deduplicate and limit
    seen = set()
    unique = []
    for c in candidates:
        if c and len(c) > 4 and c not in seen:
            seen.add(c)
            unique.append(c)
    
    return unique[:8]  # Limit to 8 candidates


def hunter_domain_search(domain: str, api_key: str) -> Optional[Dict]:
    """Search Hunter.io for emails at a domain."""
    try:
        resp = requests.get(
            "https://api.hunter.io/v2/domain-search",
            params={"domain": domain, "api_key": api_key, "limit": 20},
            timeout=15
        )
        if resp.status_code == 200:
            return resp.json().get("data", {})
        elif resp.status_code == 429:
            print(f"    Rate limited on Hunter, waiting 5s...")
            time.sleep(5)
            return None
    except Exception as e:
        print(f"    Hunter domain-search error for {domain}: {e}")
    return None


def hunter_email_finder(domain: str, first_name: str, last_name: str, api_key: str) -> Optional[Dict]:
    """Use Hunter.io to find an email for a specific person at a domain."""
    try:
        resp = requests.get(
            "https://api.hunter.io/v2/email-finder",
            params={
                "domain": domain,
                "first_name": first_name,
                "last_name": last_name,
                "api_key": api_key
            },
            timeout=15
        )
        if resp.status_code == 200:
            return resp.json().get("data", {})
    except Exception as e:
        print(f"    Hunter email-finder error: {e}")
    return None


def hunter_verify_email(email: str, api_key: str) -> Optional[Dict]:
    """Verify an email address using Hunter.io."""
    try:
        resp = requests.get(
            "https://api.hunter.io/v2/email-verifier",
            params={"email": email, "api_key": api_key},
            timeout=15
        )
        if resp.status_code == 200:
            return resp.json().get("data", {})
    except Exception as e:
        print(f"    Hunter verify error for {email}: {e}")
    return None


def is_decision_maker(position: str) -> bool:
    """Check if a position title suggests a decision-maker."""
    if not position:
        return False
    pos_lower = position.lower()
    return any(kw in pos_lower for kw in DECISION_MAKER_KEYWORDS)


@dataclass
class EnrichedContact:
    email: str
    first_name: str = ""
    last_name: str = ""
    position: str = ""
    linkedin: str = ""
    verification_status: str = "unverified"
    source: str = ""
    confidence: int = 0


def find_district_domain(district_name: str, state: str, city: str, api_key: str) -> Tuple[Optional[str], Optional[Dict]]:
    """Try multiple domain candidates and return the first with results."""
    candidates = generate_domain_candidates(district_name, state, city)
    
    for domain in candidates:
        result = hunter_domain_search(domain, api_key)
        if result and result.get("emails"):
            return domain, result
        # Also check if domain exists but has no emails (pattern found)
        if result and result.get("pattern"):
            # Domain exists but no emails indexed - still useful for email-finder later
            pass
        time.sleep(0.5)  # Rate limiting - Hunter allows ~1 req/sec on free
    
    return None, None


def enrich_district(district: Dict, api_key: str) -> Tuple[Optional[str], Optional[EnrichedContact], Optional[Dict]]:
    """
    Enrich a single district. Returns (domain, best_contact, all_emails).
    """
    district_name = district["district_name"] or f"District {district['nces_district_id']}"
    state = district["state"]
    city = district.get("city", "") or ""
    
    # Find domain via Hunter
    domain, domain_data = find_district_domain(district_name, state, city, api_key)
    
    if not domain or not domain_data:
        return None, None, None
    
    emails = domain_data.get("emails", [])
    pattern = domain_data.get("pattern")  # e.g., "{f}{last}"
    
    # Filter for decision-makers
    decision_makers = [
        e for e in emails if is_decision_maker(e.get("position", ""))
    ]
    
    # If no decision-makers found, use all emails but mark lower confidence
    if not decision_makers:
        decision_makers = emails[:5]
    
    # Pick the best contact (highest confidence, prefer superintendent)
    best = None
    best_score = -1
    
    for email_data in decision_makers:
        email = email_data.get("value", "")
        if not email:
            continue
        
        confidence = email_data.get("confidence", 50)
        position = email_data.get("position", "").lower()
        
        # Boost score for superintendent/director titles
        if "superintendent" in position:
            confidence += 20
        elif "director" in position:
            confidence += 15
        elif "principal" in position:
            confidence += 10
        
        if confidence > best_score:
            best_score = confidence
            best = email_data
    
    if not best:
        return domain, None, emails
    
    # Verify the best email
    best_email = best.get("value", "")
    verification = hunter_verify_email(best_email, api_key)
    
    verify_status = "unverified"
    if verification:
        status = verification.get("status", "")
        if status in ["valid", "accept_all"]:
            verify_status = "verified"
        elif status == "invalid":
            verify_status = "invalid"
        else:
            verify_status = "unverified"
    
    contact = EnrichedContact(
        email=best_email,
        first_name=best.get("first_name", ""),
        last_name=best.get("last_name", ""),
        position=best.get("position", ""),
        linkedin=best.get("linkedin", ""),
        verification_status=verify_status,
        source=f"hunter:domain-search:{domain}",
        confidence=best.get("confidence", 0)
    )
    
    return domain, contact, emails


def get_top_districts(limit: int = 100) -> List[Dict]:
    """Get top districts by student count."""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("""
        WITH district_agg AS (
            SELECT 
                nces_district_id,
                MAX(district) as district_name,
                MAX(state) as state,
                MAX(school_address_city) as city,
                count(*) as school_count,
                COALESCE(sum(nces_student_count), 0) as total_students,
                MAX(nces_phone) as phone
            FROM outreach_prospects
            WHERE nces_district_id IS NOT NULL
            GROUP BY nces_district_id
            ORDER BY total_students DESC
            LIMIT %s
        )
        SELECT * FROM district_agg ORDER BY total_students DESC
    """, [limit])
    
    results = [dict(row) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return results


def update_prospects_in_district(nces_district_id: str, contact: EnrichedContact, domain: str):
    """Update all prospects in a district with the enriched contact info."""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    enrichment_data = json.dumps({
        "domain": domain,
        "confidence": contact.confidence,
        "hunter_pattern": domain,
        "enrichment_date": datetime.now().isoformat()
    })
    
    cursor.execute("""
        UPDATE outreach_prospects 
        SET email = %s,
            contact_first_name = %s,
            contact_last_name = %s,
            contact_title = %s,
            linkedin_url = %s,
            email_verified = %s,
            email_source = %s,
            enrichment_data = %s,
            enrichment_date = NOW()
        WHERE nces_district_id = %s
        AND (email IS NULL OR email = '')
    """, [
        contact.email,
        contact.first_name,
        contact.last_name,
        contact.position,
        contact.linkedin,
        contact.verification_status,
        contact.source,
        enrichment_data,
        nces_district_id
    ])
    
    updated = cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return updated


def main():
    print("=" * 60)
    print("  EMAIL ENRICHMENT - Hunter.io Waterfall")
    print("=" * 60)
    
    if not HUNTER_API_KEY:
        print("ERROR: HUNTER_API_KEY not set")
        return
    
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set")
        return
    
    # Get top 100 districts
    districts = get_top_districts(100)
    print(f"\nFound {len(districts)} districts to enrich")
    
    stats = {
        "total": len(districts),
        "domains_found": 0,
        "emails_found": 0,
        "emails_verified": 0,
        "emails_invalid": 0,
        "prospects_updated": 0,
        "errors": 0,
        "rate_limits": 0,
        "details": []
    }
    
    for i, district in enumerate(districts):
        name = district["district_name"] or f"ID:{district['nces_district_id']}"
        state = district["state"]
        students = district["total_students"]
        
        print(f"\n[{i+1}/{len(districts)}] {name} ({state}) - {students} students")
        
        try:
            domain, contact, all_emails = enrich_district(district, HUNTER_API_KEY)
            
            if domain:
                stats["domains_found"] += 1
                print(f"  Domain: {domain} ({len(all_emails or [])} emails found)")
                
                if contact:
                    stats["emails_found"] += 1
                    print(f"  Contact: {contact.first_name} {contact.last_name} ({contact.position})")
                    print(f"  Email: {contact.email} [{contact.verification_status}] (confidence: {contact.confidence})")
                    
                    if contact.verification_status == "verified":
                        stats["emails_verified"] += 1
                    elif contact.verification_status == "invalid":
                        stats["emails_invalid"] += 1
                    
                    # Update database
                    updated = update_prospects_in_district(
                        district["nces_district_id"], contact, domain
                    )
                    stats["prospects_updated"] += updated
                    print(f"  Updated {updated} prospect records")
                    
                    stats["details"].append({
                        "district": name,
                        "state": state,
                        "students": students,
                        "domain": domain,
                        "email": contact.email,
                        "name": f"{contact.first_name} {contact.last_name}".strip(),
                        "position": contact.position,
                        "linkedin": contact.linkedin,
                        "verified": contact.verification_status,
                        "confidence": contact.confidence
                    })
                else:
                    print(f"  No decision-maker emails found at {domain}")
                    stats["details"].append({
                        "district": name, "state": state, "students": students,
                        "domain": domain, "email": "NO_DECISION_MAKER"
                    })
            else:
                print(f"  No domain found for {name}")
                stats["details"].append({
                    "district": name, "state": state, "students": students,
                    "domain": "NOT_FOUND", "email": "MISSING"
                })
                
        except Exception as e:
            print(f"  ERROR: {e}")
            stats["errors"] += 1
            stats["details"].append({
                "district": name, "state": state, "students": students,
                "error": str(e)
            })
        
        # Rate limiting between districts
        time.sleep(1)
    
    # Save report
    report_file = f"/home/ibcnu/HHproduction-workdir/email_enrichment_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w') as f:
        json.dump(stats, f, indent=2, default=str)
    
    print("\n" + "=" * 60)
    print("  ENRICHMENT COMPLETE")
    print("=" * 60)
    print(f"Districts processed:  {stats['total']}")
    print(f"Domains found:        {stats['domains_found']}")
    print(f"Emails found:         {stats['emails_found']}")
    print(f"Emails verified:     {stats['emails_verified']}")
    print(f"Emails invalid:       {stats['emails_invalid']}")
    print(f"Prospects updated:    {stats['prospects_updated']}")
    print(f"Errors:               {stats['errors']}")
    print(f"Report saved:         {report_file}")
    
    # Print all found contacts
    print("\n=== FOUND CONTACTS ===")
    for d in stats["details"]:
        if d.get("email") and d["email"] not in ("MISSING", "NO_DECISION_MAKER"):
            print(f"  {d['district']} ({d['state']}): {d.get('name', '')} - {d['email']} [{d.get('verified', '?')}]")
    
    print("\n=== MISSING ===")
    for d in stats["details"]:
        if not d.get("email") or d["email"] in ("MISSING", "NO_DECISION_MAKER"):
            print(f"  {d['district']} ({d['state']}): {d.get('domain', 'NO DOMAIN')}")


if __name__ == "__main__":
    main()