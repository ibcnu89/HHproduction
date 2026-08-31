#!/usr/bin/env python3
"""
NCES CCD Data Enrichment Script
Downloads school directory from Urban Institute API for all states,
matches against existing prospects, and enriches with missing metadata.
"""

import os
import re
import json
import time
import requests
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urljoin
import psycopg2
from psycopg2.extras import RealDictCursor

# State FIPS codes
STATE_FIPS = {
    "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06", "CO": "08", "CT": "09", "DE": "10",
    "FL": "12", "GA": "13", "HI": "15", "ID": "16", "IL": "17", "IN": "18", "IA": "19", "KS": "20",
    "KY": "21", "LA": "22", "ME": "23", "MD": "24", "MA": "25", "MI": "26", "MN": "27", "MS": "28",
    "MO": "29", "MT": "30", "NE": "31", "NV": "32", "NH": "33", "NJ": "34", "NM": "35", "NY": "36",
    "NC": "37", "ND": "38", "OH": "39", "OK": "40", "OR": "41", "PA": "42", "RI": "44", "SC": "45",
    "SD": "46", "TN": "47", "TX": "48", "UT": "49", "VT": "50", "VA": "51", "WA": "53", "WV": "54",
    "WI": "55", "WY": "56", "DC": "11"
}

DATABASE_URL = os.environ.get("DATABASE_URL")

@dataclass
class NCESchool:
    nces_school_id: str
    nces_district_id: str
    school_name: str
    district_name: str
    city: str
    state: str
    zip_code: str
    phone: str
    website: str
    grade_span: str
    school_type: str
    student_count: Optional[int]
    teacher_count: Optional[float]
    is_magnet: bool
    is_charter: bool
    is_title1: bool
    urban_locale: str


def normalize_school_name(name: str) -> str:
    """Normalize school name for matching"""
    if not name:
        return ""
    # Remove common suffixes/prefixes, punctuation, extra spaces
    name = name.upper()
    name = re.sub(r'[^\w\s]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()
    # Remove common words that vary
    remove_words = ['ELEMENTARY', 'MIDDLE', 'HIGH', 'SCHOOL', 'JR', 'SR', 'JUNIOR', 'SENIOR', 'INTERMEDIATE']
    for word in remove_words:
        name = re.sub(rf'\b{word}\b', '', name)
    return name.strip()


def fetch_nces_schools_for_state(state_fips: str, year: int = 2024) -> List[NCESchool]:
    """Fetch all public schools for a state from Urban Institute API"""
    base_url = f"https://educationdata.urban.org/api/v1/schools/ccd/directory/{year}/"
    all_schools = []
    page = 1
    
    session = requests.Session()
    session.headers.update({
        "User-Agent": "HomeworkHelper Enrichment/1.0 (contact: skyler@letsmakeai.fun)"
    })
    
    while True:
        params = {"fips": state_fips, "page": page}
        try:
            resp = session.get(base_url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            
            results = data.get("results", [])
            if not results:
                break
            
            for school in results:
                # Filter for active public schools only
                if school.get("school_status") == 1 and school.get("school_type") == 1:
                    all_schools.append(NCESchool(
                        nces_school_id=str(school.get("ncessch", "")),
                        nces_district_id=str(school.get("leaid", "")),
                        school_name=school.get("school_name", ""),
                        district_name=school.get("lea_name", ""),
                        city=school.get("city_location", ""),
                        state=school.get("state_location", ""),
                        zip_code=school.get("zip_location", ""),
                        phone=school.get("phone", ""),
                        website=school.get("website", "") or "",
                        grade_span=f"{school.get('lowest_grade_offered', '')}-{school.get('highest_grade_offered', '')}",
                        school_type={1: "Regular", 2: "Special Ed", 3: "Vocational", 4: "Alternative"}.get(school.get("school_type", 1), "Regular"),
                        student_count=school.get("enrollment"),
                        teacher_count=school.get("teachers_fte"),
                        is_magnet=bool(school.get("magnet")),
                        is_charter=bool(school.get("charter")),
                        is_title1=bool(school.get("title_i_status")) if school.get("title_i_status") else False,
                        urban_locale=school.get("urban_centric_locale", "")
                    ))
            
            if not data.get("next"):
                break
            page += 1
            time.sleep(0.15)  # Rate limit
            
        except Exception as e:
            print(f"  Error fetching page {page}: {e}")
            break
    
    return all_schools


def match_prospects_to_nces(prospects: List[Dict], nces_schools: List[NCESchool]) -> List[Tuple[Dict, Optional[NCESchool]]]:
    """Match prospects to NCES schools by normalized name + state"""
    # Build lookup: (state, normalized_name) -> school
    nces_lookup = {}
    for school in nces_schools:
        key = (school.state, normalize_school_name(school.school_name))
        if key not in nces_lookup:
            nces_lookup[key] = school
    
    # Also build fuzzy lookup for district + name combo
    district_lookup = {}
    for school in nces_schools:
        key = (school.state, normalize_school_name(school.district_name), normalize_school_name(school.school_name))
        if key not in district_lookup:
            district_lookup[key] = school
    
    matches = []
    for prospect in prospects:
        prospect_state = prospect.get("state", "")
        prospect_school = prospect.get("school", "")
        
        # Try exact normalized match
        key = (prospect_state, normalize_school_name(prospect_school))
        nces_school = nces_lookup.get(key)
        
        # Try fuzzy match with district
        if not nces_school and prospect.get("district"):
            key2 = (prospect_state, normalize_school_name(prospect["district"]), normalize_school_name(prospect_school))
            nces_school = district_lookup.get(key2)
        
        matches.append((prospect, nces_school))
    
    return matches


def enrich_prospects_in_db(matches: List[Tuple[Dict, Optional[NCESchool]]]) -> Dict:
    """Update database with enriched NCES data"""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    stats = {
        "total": len(matches),
        "matched": 0,
        "updated": 0,
        "unmatched": 0,
        "errors": 0
    }
    
    for prospect, nces in matches:
        prospect_id = prospect["id"]
        
        if nces:
            stats["matched"] += 1
            try:
                cursor.execute("""
                    UPDATE outreach_prospects SET
                        nces_school_id = %s,
                        nces_district_id = %s,
                        school_website = COALESCE(NULLIF(%s, ''), school_website),
                        school_address_street = %s,
                        school_address_city = %s,
                        school_address_state = %s,
                        school_address_zip = %s,
                        nces_phone = %s,
                        nces_grade_span = %s,
                        nces_school_type = %s,
                        nces_student_count = %s,
                        nces_teacher_count = %s,
                        nces_magnet = %s,
                        nces_charter = %s,
                        nces_title1 = %s,
                        nces_urban_locale = %s,
                        enrichment_date = %s,
                        enrichment_status = 'matched',
                        updated_at = NOW()
                    WHERE id = %s
                """, [
                    nces.nces_school_id,
                    nces.nces_district_id,
                    nces.website,
                    "",  # Street not in CCD - would need separate lookup
                    nces.city,
                    nces.state,
                    nces.zip_code,
                    nces.phone,
                    nces.grade_span,
                    nces.school_type,
                    nces.student_count,
                    nces.teacher_count,
                    nces.is_magnet,
                    nces.is_charter,
                    nces.is_title1,
                    nces.urban_locale,
                    datetime.now(),
                    prospect_id
                ])
                stats["updated"] += 1
            except Exception as e:
                print(f"  Error updating {prospect_id}: {e}")
                stats["errors"] += 1
        else:
            stats["unmatched"] += 1
            # Mark as unmatched for tracking
            try:
                cursor.execute("""
                    UPDATE outreach_prospects SET
                        enrichment_date = %s,
                        enrichment_status = 'unmatched',
                        updated_at = NOW()
                    WHERE id = %s
                """, [datetime.now(), prospect_id])
            except Exception as e:
                stats["errors"] += 1
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return stats


def generate_report() -> Dict:
    """Generate enrichment report from database"""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Overall stats
    cursor.execute("""
        SELECT 
            count(*) as total,
            count(*) filter (where enrichment_status = 'matched') as matched,
            count(*) filter (where enrichment_status = 'unmatched') as unmatched,
            count(*) filter (where enrichment_status IS NULL) as not_processed,
            count(school_website) filter (where school_website IS NOT NULL) as with_website,
            count(school_address_city) filter (where school_address_city IS NOT NULL) as with_address,
            count(nces_student_count) filter (where nces_student_count IS NOT NULL) as with_students,
            count(nces_teacher_count) filter (where nces_teacher_count IS NOT NULL) as with_teachers
        FROM outreach_prospects
    """)
    overall = cursor.fetchone()
    if overall is None:
        overall = {"total": 0, "matched": 0, "unmatched": 0, "not_processed": 0, "with_website": 0, "with_address": 0, "with_students": 0, "with_teachers": 0}
    
    # By state
    cursor.execute("""
        SELECT 
            state,
            count(*) as total,
            count(*) filter (where enrichment_status = 'matched') as matched,
            count(*) filter (where enrichment_status = 'unmatched') as unmatched,
            count(school_website) filter (where school_website IS NOT NULL) as with_website
        FROM outreach_prospects
        GROUP BY state
        ORDER BY total DESC
    """)
    by_state = cursor.fetchall()
    
    # By status
    cursor.execute("""
        SELECT status, count(*) as count
        FROM outreach_prospects
        GROUP BY status
        ORDER BY count DESC
    """)
    by_status = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    return {
        "overall": overall,
        "by_state": by_state,
        "by_status": by_status
    }


def main():
    print("=== NCES CCD Enrichment Pipeline ===")
    print(f"Database: {DATABASE_URL[:50]}...")
    
    # Load all prospects from DB
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT id, school, district, state FROM outreach_prospects WHERE enrichment_status IS NULL OR enrichment_status = 'unmatched'")
    prospects = cursor.fetchall()
    cursor.close()
    conn.close()
    
    print(f"\nProspects to enrich: {len(prospects)}")
    
    # Group prospects by state
    prospects_by_state = {}
    for p in prospects:
        state = p["state"]
        if state not in prospects_by_state:
            prospects_by_state[state] = []
        prospects_by_state[state].append(p)
    
    total_stats = {"total": 0, "matched": 0, "updated": 0, "unmatched": 0, "errors": 0}
    
    # Process each state
    for state_abbr, state_prospects in prospects_by_state.items():
        state_fips = STATE_FIPS.get(state_abbr)
        if not state_fips:
            print(f"\n  Skipping {state_abbr}: No FIPS code")
            continue
        
        print(f"\n=== Processing {state_abbr} (FIPS: {state_fips}) ===")
        print(f"  Prospects: {len(state_prospects)}")
        
        # Fetch NCES schools for this state
        print(f"  Fetching NCES data...")
        nces_schools = fetch_nces_schools_for_state(state_fips)
        print(f"  NCES schools found: {len(nces_schools)}")
        
        # Match
        print(f"  Matching...")
        matches = match_prospects_to_nces(state_prospects, nces_schools)
        
        # Enrich
        print(f"  Updating database...")
        stats = enrich_prospects_in_db(matches)
        
        # Aggregate
        for k in total_stats:
            total_stats[k] += stats[k]
        
        print(f"  Matched: {stats['matched']}, Updated: {stats['updated']}, Unmatched: {stats['unmatched']}")
    
    # Final report
    print("\n" + "="*50)
    print("ENRICHMENT COMPLETE")
    print("="*50)
    print(f"Total processed: {total_stats['total']}")
    print(f"Matched: {total_stats['matched']} ({total_stats['matched']/total_stats['total']*100:.1f}%)")
    print(f"Updated: {total_stats['updated']}")
    print(f"Unmatched: {total_stats['unmatched']}")
    print(f"Errors: {total_stats['errors']}")
    
    # Generate detailed report
    print("\nGenerating detailed report...")
    report = generate_report()
    
    print(f"\n=== OVERALL ===")
    print(f"  Total prospects: {report['overall']['total']}")
    print(f"  Matched: {report['overall']['matched']}")
    print(f"  Unmatched: {report['overall']['unmatched']}")
    print(f"  Not processed: {report['overall']['not_processed']}")
    print(f"  With website: {report['overall']['with_website']}")
    print(f"  With address: {report['overall']['with_address']}")
    print(f"  With student count: {report['overall']['with_students']}")
    print(f"  With teacher count: {report['overall']['with_teachers']}")
    
    print(f"\n=== BY STATE ===")
    for row in report['by_state']:
        match_rate = row['matched'] / row['total'] * 100 if row['total'] > 0 else 0
        print(f"  {row['state']}: {row['total']} total, {row['matched']} matched ({match_rate:.1f}%), {row['with_website']} websites")
    
    print(f"\n=== BY OUTREACH STATUS ===")
    for row in report['by_status']:
        print(f"  {row['status']}: {row['count']}")
    
    # Save report to file
    report_file = f"/home/ibcnu/HHproduction-workdir/nces_enrichment_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w') as f:
        json.dump({
            "summary": total_stats,
            "detailed": report,
            "timestamp": datetime.now().isoformat()
        }, f, indent=2, default=str)
    print(f"\nReport saved to: {report_file}")


if __name__ == "__main__":
    main()