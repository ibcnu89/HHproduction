#!/usr/bin/env python3
"""
Email Enrichment v3 - Browser + Hunter Waterfall
1. Use Google search to find each district's actual website domain
2. Use Hunter.io domain-search on the found domain
3. Filter for decision-makers (superintendent, director, etc.)
4. Verify with Hunter email-verifier
5. Store in database
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
from dataclasses import dataclass
from urllib.parse import urlparse

DATABASE_URL = os.environ.get("DATABASE_URL")
HUNTER_API_KEY = os.environ.get("HUNTER_API_KEY")

DECISION_MAKER_KEYWORDS = [
    'superintendent', 'director', 'principal', 'admin', 'curriculum',
    'technology', 'tech director', 'cio', 'cto', 'assistant superintendent',
    'chief', 'deputy', 'head of school', 'department head', 'coordinator',
    'assistant', 'supervisor', 'specialist'
]

# Pre-built domain map for known districts (from our testing)
KNOWN_DOMAINS = {
    "Anne Arundel County Public Schools": "aacps.org",
    "Albemarle County Public Schools": "k12albemarle.org",
    "Cumberland County Schools": "ccs.k12.nc.us",
    "HAYS CISD": "hayscisd.net",
    "Alpine District": "alpinedistrict.org",
    "Berkeley County Schools": "berkeleycountyschools.org",
    "Aiken 01": "aiken.k12.sc.us",
    "BAY": "bay.k12.fl.us",
    "ALACHUA": "sbac.edu",
}


def find_domain_via_google(district_name: str, state: str) -> Optional[str]:
    """Search Google for the district's official website."""
    query = f'"{district_name}" {state} site:.k12.* OR site:*.org school district official website'
    # Simpler: just search for the district name + "school district website"
    query = f'{district_name} {state} school district official website'
    
    try:
        # Use DuckDuckGo's instant answer API as a fallback
        # Or just try common patterns
        pass
    except:
        pass
    return None


def try_domain_patterns(district_name: str, state: str, city: str = "") -> List[str]:
    """
    Generate domain candidates based on known patterns from successful lookups.
    """
    clean = district_name
    
    # Remove common suffixes
    for suffix in ['Public Schools', 'Public School', 'School District', 'Schools', 
                   'School', 'Unified School District', 'Unified', 'Community Unit',
                   'Consolidated', 'Independent School District', 'Independent',
                   'CUSD', 'ISD', 'USD', 'CSD', 'DSD', 'UHSD', 'Academy', 'District',
                   'No.', 'County Schools', 'County', 'Department of Education']:
        clean = re.sub(r'\b' + re.escape(suffix) + r'\b', '', clean, flags=re.IGNORECASE)
    
    clean = re.sub(r'[^a-zA-Z0-9\s-]', '', clean).strip()
    clean_lower = re.sub(r'\s+', '', clean.lower())
    clean_dash = re.sub(r'\s+', '-', clean.lower())
    
    city_clean = re.sub(r'[^a-zA-Z0-9]', '', city.lower()) if city else ""
    state_lower = state.lower()
    
    # Words for abbreviation
    words = [w for w in clean.lower().split() if w]
    first_word = words[0] if words else ""
    
    candidates = []
    
    # 1. {clean}.k12.{state}.us (e.g., cumberland.k12.nc.us - doesn't work, but aiken.k12.sc.us does)
    if clean_lower:
        candidates.append(f"{clean_lower}.k12.{state_lower}.us")
    
    # 2. {city}.k12.{state}.us (e.g., bay.k12.fl.us, aiken.k12.sc.us)
    if city_clean:
        candidates.append(f"{city_clean}.k12.{state_lower}.us")
    
    # 3. Abbreviation patterns (ccs.k12.nc.us = Cumberland County Schools)
    if len(words) >= 2:
        abbr = ''.join([w[0] for w in words if w])
        if len(abbr) >= 2:
            candidates.append(f"{abbr}.k12.{state_lower}.us")
            # Also ccs{state}.k12... no
            candidates.append(f"{abbr}{state_lower}.k12.{state_lower}.us")
    
    # 4. {clean}.org (e.g., alpinedistrict.org, berkeleycountyschools.org)
    if clean_lower:
        candidates.append(f"{clean_lower}.org")
        candidates.append(f"{clean_dash}.org")
    
    # 5. {clean}schools.org (e.g., berkeleycountyschools.org)
    if clean_lower and 'school' not in clean_lower:
        candidates.append(f"{clean_lower}schools.org")
    
    # 6. k12{clean}.org (e.g., k12albemarle.org)
    if clean_lower:
        candidates.append(f"k12{clean_lower}.org")
    
    # 7. {first_word}.org
    if first_word:
        candidates.append(f"{first_word}.org")
    
    # 8. ISD patterns for TX
    if clean_lower:
        candidates.append(f"{clean_lower}isd.org")
        candidates.append(f"{clean_lower}isd.net")
        candidates.append(f"{clean_lower}.k12.tx.us" if state_lower == 'tx' else "")
    
    # 9. {clean}.k12.{state}.us without ' County' (e.g., cumberland.k12.nc.us)
    if 'county' in clean_lower:
        no_county = clean_lower.replace('county', '').strip()
        candidates.append(f"{no_county}.k12.{state_lower}.us")
    
    # 10. {city}.org
    if city_clean:
        candidates.append(f"{city_clean}.org")
        candidates.append(f"{city_clean}sd.org")
    
    # 11. {clean}.net
    if clean_lower:
        candidates.append(f"{clean_lower}.net")
    
    # 12. {clean}sd.net
    if clean_lower:
        candidates.append(f"{clean_lower}sd.net")
        candidates.append(f"{clean_lower}sd.org")
    
    # Deduplicate and filter
    seen = set()
    unique = []
    for c in candidates:
        if c and len(c) > 4 and c not in seen:
            seen.add(c)
            unique.append(c)
    
    return unique[:10]


def hunter_domain_search(domain: str, api_key: str) -> Optional[Dict]:
    """Search Hunter.io for emails at a domain."""
    try:
        resp = requests.get(
            "https://api.hunter.io/v2/domain-search",
            params={"domain": domain, "api_key": api_key, "limit": 10},
            timeout=15
        )
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            email_count = len(data.get("emails", []))
            if email_count > 0:
                print(f"    Hunter: {domain} -> {email_count} emails")
            return data
        elif resp.status_code == 429:
            print(f"    Rate limited, waiting 10s...")
            time.sleep(10)
            return None
        else:
            print(f"    Hunter error {resp.status_code} for {domain}: {resp.text[:200]}")
    except Exception as e:
        print(f"    Hunter exception for {domain}: {e}")
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
    except:
        pass
    return None


def is_decision_maker(position: str) -> bool:
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


def find_and_enrich_district(district: Dict, api_key: str) -> Tuple[Optional[str], Optional[EnrichedContact], Optional[List]]:
    district_name = district["district_name"] or ""
    state = district["state"]
    city = (district.get("city") or "").strip()
    
    # Check known domains first
    if district_name in KNOWN_DOMAINS:
        domain = KNOWN_DOMAINS[district_name]
        print(f"  [KNOWN] Trying {domain} for {district_name}")
        result = hunter_domain_search(domain, api_key)
        if result and result.get("emails"):
            emails = result.get("emails", [])
            contact = pick_best_contact(emails, domain, api_key)
            return domain, contact, emails
        else:
            print(f"  [KNOWN] No emails at {domain}")
    
    # Try generated patterns
    candidates = try_domain_patterns(district_name, state, city)
    
    for domain in candidates:
        result = hunter_domain_search(domain, api_key)
        if result and result.get("emails"):
            emails = result.get("emails", [])
            contact = pick_best_contact(emails, domain, api_key)
            return domain, contact, emails
        time.sleep(0.5)
    
    return None, None, None


def pick_best_contact(emails: List[Dict], domain: str, api_key: str) -> Optional[EnrichedContact]:
    """Pick the best decision-maker contact from Hunter emails."""
    # Filter for decision-makers
    decision_makers = [e for e in emails if is_decision_maker(e.get("position", ""))]
    
    # If no decision-makers, use top emails by confidence
    if not decision_makers:
        decision_makers = sorted(emails, key=lambda e: e.get("confidence", 0), reverse=True)[:5]
    
    # Pick best: prefer superintendent, then director, then highest confidence
    best = None
    best_score = -1
    
    for email_data in decision_makers:
        email = email_data.get("value", "")
        if not email:
            continue
        
        confidence = email_data.get("confidence", 50)
        position = (email_data.get("position") or "").lower()
        
        if "superintendent" in position:
            confidence += 30
        elif "director" in position and "curriculum" in position:
            confidence += 25
        elif "director" in position:
            confidence += 20
        elif "principal" in position:
            confidence += 15
        elif "admin" in position:
            confidence += 10
        
        if confidence > best_score:
            best_score = confidence
            best = email_data
    
    if not best:
        return None
    
    best_email = best.get("value", "")
    
    # Only verify if we have credits left
    verification = hunter_verify_email(best_email, api_key)
    verify_status = "unverified"
    if verification:
        status = verification.get("status", "")
        if status in ["valid", "accept_all"]:
            verify_status = "verified"
        elif status == "invalid":
            verify_status = "invalid"
    
    return EnrichedContact(
        email=best_email,
        first_name=best.get("first_name", ""),
        last_name=best.get("last_name", ""),
        position=best.get("position", ""),
        linkedin=best.get("linkedin", ""),
        verification_status=verify_status,
        source=f"hunter:{domain}",
        confidence=best.get("confidence", 0)
    )


def get_top_districts(limit: int = 100) -> List[Dict]:
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
                COALESCE(sum(nces_student_count), 0) as total_students
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


def update_prospects(nces_district_id: str, contact: EnrichedContact, domain: str):
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    enrichment_data = json.dumps({
        "domain": domain,
        "confidence": contact.confidence,
        "enrichment_date": datetime.now().isoformat()
    })
    cursor.execute("""
        UPDATE outreach_prospects 
        SET email = %s, contact_first_name = %s, contact_last_name = %s,
            contact_title = %s, linkedin_url = %s, email_verified = %s,
            email_source = %s, enrichment_data = %s, enrichment_date = NOW()
        WHERE nces_district_id = %s AND (email IS NULL OR email = '')
    """, [contact.email, contact.first_name, contact.last_name, contact.position,
          contact.linkedin, contact.verification_status, contact.source,
          enrichment_data, nces_district_id])
    updated = cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return updated


def main():
    print("=" * 60)
    print("  EMAIL ENRICHMENT v3 - Hunter.io + Domain Patterns")
    print("=" * 60)
    
    districts = get_top_districts(100)
    print(f"\nProcessing {len(districts)} districts")
    
    stats = {
        "total": len(districts), "domains_found": 0, "emails_found": 0,
        "emails_verified": 0, "emails_invalid": 0, "prospects_updated": 0,
        "errors": 0, "details": []
    }
    
    for i, district in enumerate(districts):
        name = district["district_name"] or f"ID:{district['nces_district_id']}"
        state = district["state"]
        students = district["total_students"]
        city = district.get("city", "")
        
        print(f"\n[{i+1}/{len(districts)}] {name} ({state}) - {students} students")
        
        try:
            domain, contact, all_emails = find_and_enrich_district(district, HUNTER_API_KEY)
            
            if domain:
                stats["domains_found"] += 1
                email_count = len(all_emails) if all_emails else 0
                print(f"  Domain: {domain} ({email_count} emails)")
                
                if contact:
                    stats["emails_found"] += 1
                    print(f"  -> {contact.first_name} {contact.last_name} ({contact.position})")
                    print(f"  -> {contact.email} [{contact.verification_status}] (conf: {contact.confidence})")
                    
                    if contact.verification_status == "verified":
                        stats["emails_verified"] += 1
                    elif contact.verification_status == "invalid":
                        stats["emails_invalid"] += 1
                    
                    updated = update_prospects(district["nces_district_id"], contact, domain)
                    stats["prospects_updated"] += updated
                    print(f"  Updated {updated} prospects")
                    
                    stats["details"].append({
                        "district": name, "state": state, "students": students,
                        "domain": domain, "email": contact.email,
                        "name": f"{contact.first_name} {contact.last_name}".strip(),
                        "position": contact.position, "linkedin": contact.linkedin,
                        "verified": contact.verification_status, "confidence": contact.confidence
                    })
                else:
                    print(f"  No decision-maker found at {domain}")
            else:
                print(f"  No domain found")
                stats["details"].append({
                    "district": name, "state": state, "email": "MISSING"
                })
        except Exception as e:
            print(f"  ERROR: {e}")
            stats["errors"] += 1
        
        time.sleep(1)
    
    # Save report
    report_file = f"/home/ibcnu/HHproduction-workdir/email_enrichment_v3_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w') as f:
        json.dump(stats, f, indent=2, default=str)
    
    print("\n" + "=" * 60)
    print(f"  COMPLETE")
    print(f"  Districts: {stats['total']} | Domains: {stats['domains_found']} | Emails: {stats['emails_found']}")
    print(f"  Verified: {stats['emails_verified']} | Invalid: {stats['emails_invalid']} | Updated: {stats['prospects_updated']}")
    print(f"  Report: {report_file}")
    
    print("\n=== FOUND CONTACTS ===")
    for d in stats["details"]:
        if d.get("email") and d["email"] != "MISSING":
            print(f"  {d['district']} ({d['state']}): {d.get('name','')} - {d['email']} [{d.get('verified','?')}]")
    
    print(f"\n=== MISSING ({sum(1 for d in stats['details'] if d.get('email') == 'MISSING')}) ===")
    for d in stats["details"]:
        if d.get("email") == "MISSING":
            print(f"  {d['district']} ({d['state']})")


if __name__ == "__main__":
    main()