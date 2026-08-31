#!/usr/bin/env python3
"""
Teacher Prospecting Pipeline - Using Urban Institute Education Data API
- Fetches school data from CCD via Urban Institute API for any US state
- Enriches with school website staff directories to find teacher emails
- Outputs prospects compatible with outreach_db.json schema
"""

import os
import re
import json
import time
import argparse
import requests
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

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

@dataclass
class TeacherProspect:
    """Schema matching outreach_db.json leads"""
    key: str
    business_name: str
    service: str
    city: str
    website: str
    email: str
    phone: str
    facebook: str
    notes: str
    score: int
    channel: str
    status: str
    created_at: str
    updated_at: str
    last_outreach_at: str
    last_outreach_channel: str
    last_outreach_subject: str
    follow_up_due: str
    history: List[Dict]


class UrbanInstituteClient:
    """Client for Urban Institute Education Data API (CCD school directory)"""
    
    BASE_URL = "https://educationdata.urban.org/api/v1/schools/ccd/directory"
    
    def __init__(self, year: int = 2024):
        self.year = year
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "HomeworkHelper Teacher Outreach/1.0 (contact: skyler@letsmakeai.fun)"
        })
    
    def get_schools_by_state(self, state_fips: str, max_pages: int = 10) -> List[Dict]:
        """Fetch public school directory for a state via Urban Institute API"""
        all_schools = []
        page = 1
        
        while page <= max_pages:
            url = f"{self.BASE_URL}/{self.year}/"
            params = {"fips": state_fips, "page": page}
            
            try:
                resp = self.session.get(url, params=params, timeout=30)
                resp.raise_for_status()
                data = resp.json()
                
                results = data.get("results", [])
                if not results:
                    break
                
                # Filter for active public schools only
                for school in results:
                    if school.get("school_status") == 1 and school.get("school_type") == 1:
                        all_schools.append(school)
                
                # Check if there's a next page
                if not data.get("next"):
                    break
                    
                page += 1
                time.sleep(0.2)  # Be nice to the API
                
            except Exception as e:
                print(f"[API] Error fetching page {page}: {e}")
                break
        
        print(f"[API] Fetched {len(all_schools)} active public schools for FIPS {state_fips}")
        return all_schools


class SchoolWebsiteEnricher:
    """Enrich school data by scraping school website staff directories"""
    
    def __init__(self, delay: float = 1.0):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (compatible; HomeworkHelper Bot/1.0; +https://letsmakeai.fun)"
        })
        self.delay = delay
    
    def find_school_website(self, school_name: str, district_name: str, city: str, state: str) -> Optional[str]:
        """Find school website via common patterns"""
        slug = re.sub(r'[^a-z0-9]+', '-', school_name.lower()).strip('-')
        district_slug = re.sub(r'[^a-z0-9]+', '-', district_name.lower()).strip('-')
        state_abbr = state.lower()
        
        candidates = [
            f"https://{slug}.{district_slug}.k12.{state_abbr}.us",
            f"https://{slug}.{district_slug}.org",
            f"https://{district_slug}.k12.{state_abbr}.us/{slug}",
            f"https://www.{district_slug}.k12.{state_abbr}.us/{slug}",
            f"https://{slug}.org",
            f"https://{slug}.net",
        ]
        
        for url in candidates:
            try:
                resp = self.session.head(url, timeout=5, allow_redirects=True)
                if resp.status_code == 200:
                    return resp.url
            except:
                continue
        return None
    
    def extract_staff_emails(self, website: str) -> List[Dict]:
        """Extract teacher emails from school staff directory"""
        emails = []
        
        try:
            resp = self.session.get(website, timeout=10)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, 'html.parser')
            
            # Look for staff directory links
            staff_links = []
            for link in soup.find_all('a', href=True):
                text = link.get_text().lower()
                href = link['href'].lower()
                if any(kw in text or kw in href for kw in ['staff', 'directory', 'faculty', 'teachers', 'team', 'our-staff']):
                    staff_links.append(urljoin(website, link['href']))
            
            # Common staff directory paths
            common_paths = ['/staff', '/directory', '/faculty', '/teachers', '/our-team', '/meet-the-staff', '/staff-directory']
            for path in common_paths:
                staff_links.append(urljoin(website, path))
            
            staff_links = list(set(staff_links))
            
            for link in staff_links[:5]:
                try:
                    time.sleep(self.delay)
                    page_resp = self.session.get(link, timeout=10)
                    if page_resp.status_code != 200:
                        continue
                    
                    page_soup = BeautifulSoup(page_resp.text, 'html.parser')
                    email_pattern = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
                    
                    for match in email_pattern.finditer(page_resp.text):
                        email = match.group().lower()
                        if not any(skip in email for skip in ['admin', 'info', 'office', 'principal', 'superintendent', 'hr', 'payroll', 'tech', 'it@', 'webmaster', 'noreply', 'no-reply']):
                            name = self._extract_name_near_email(page_soup, email)
                            emails.append({
                                'email': email,
                                'name': name,
                                'source_url': link
                            })
                except Exception as e:
                    continue
                    
        except Exception as e:
            print(f"[Enricher] Error fetching {website}: {e}")
        
        return emails
    
    def _extract_name_near_email(self, soup: BeautifulSoup, email: str) -> str:
        """Try to find a name near an email in the HTML"""
        for text_node in soup.find_all(string=re.compile(re.escape(email), re.I)):
            parent = text_node.parent
            context = parent.get_text() if parent else ""
            name_match = re.search(r'([A-Z][a-z]+\s+[A-Z][a-z]+)[\s\-\:]*\s*' + re.escape(email), context, re.I)
            if name_match:
                return name_match.group(1)
        return ""


class TeacherProspector:
    """Main prospecting pipeline"""
    
    def __init__(self, states: List[str], output_dir: str, year: int = 2024):
        self.states = [s.upper() for s in states]
        self.output_dir = output_dir
        self.year = year
        self.api = UrbanInstituteClient(year)
        self.enricher = SchoolWebsiteEnricher()
        os.makedirs(output_dir, exist_ok=True)
    
    def run(self, max_schools_per_state: int = 100, enrich: bool = True) -> List[TeacherProspect]:
        all_prospects = []
        
        for state_abbr in self.states:
            print(f"\n=== Processing {state_abbr} ===")
            state_fips = STATE_FIPS.get(state_abbr)
            if not state_fips:
                print(f"  Unknown state: {state_abbr}")
                continue
            
            print(f"  Fetching schools from Urban Institute API...")
            schools = self.api.get_schools_by_state(state_fips)
            
            if not schools:
                print(f"  No schools returned from API")
                continue
            
            schools = schools[:max_schools_per_state]
            print(f"  Processing {len(schools)} schools...")
            
            for i, school in enumerate(schools):
                prospects = self._process_school(school, state_abbr, enrich)
                all_prospects.extend(prospects)
                
                if (i + 1) % 25 == 0:
                    self._save_progress(all_prospects)
                    print(f"  Processed {i + 1}/{len(schools)} schools...")
        
        self._save_progress(all_prospects)
        return all_prospects
    
    def _process_school(self, school: Dict, state_abbr: str, enrich: bool) -> List[TeacherProspect]:
        prospects = []
        
        school_name = school.get('school_name', '').strip()
        district_name = school.get('lea_name', '').strip()
        city = school.get('city_location', '').strip()
        phone = school.get('phone', '').strip()
        street = school.get('street_location', '').strip()
        zip_code = school.get('zip_location', '').strip()
        teachers_fte = school.get('teachers_fte', 0)
        
        if not school_name:
            return prospects
        
        address_parts = [street, city, state_abbr, zip_code]
        address = ", ".join([p for p in address_parts if p])
        
        # Find website
        website = ""
        if enrich:
            website = self.enricher.find_school_website(school_name, district_name, city, state_abbr) or ""
        
        # Extract teacher emails from website
        teacher_emails = []
        if enrich and website:
            teacher_emails = self.enricher.extract_staff_emails(website)
        
        # Determine service/subject from school level
        school_level = school.get('school_level', 1)
        level_map = {1: "Elementary", 2: "Middle", 3: "High", 4: "Other"}
        grade_level = level_map.get(school_level, "K-12")
        
        if not teacher_emails:
            prospect = self._create_prospect(
                business_name=school_name,
                service=f"Teacher ({grade_level})",
                city=f"{city}, {state_abbr}",
                website=website,
                email="",
                phone=phone,
                address=address,
                score=3
            )
            prospects.append(prospect)
        else:
            for teacher in teacher_emails[:5]:
                prospect = self._create_prospect(
                    business_name=school_name,
                    service=f"Teacher - {teacher.get('name', grade_level)}",
                    city=f"{city}, {state_abbr}",
                    website=website,
                    email=teacher['email'],
                    phone=phone,
                    address=address,
                    score=8
                )
                prospects.append(prospect)
        
        return prospects
    
    def _create_prospect(self, business_name: str, service: str, city: str,
                         website: str, email: str, phone: str, address: str, score: int) -> TeacherProspect:
        now = datetime.now().isoformat(timespec='seconds')
        
        key_base = email if email else f"{business_name}|{city}".lower()
        key_base = re.sub(r'[^a-z0-9]+', '_', key_base).strip('_')
        key = f"namecity:{key_base}"
        
        channel = "email" if email else ("call" if phone and phone != "(none found)" else "manual")
        
        notes_parts = []
        if address:
            notes_parts.append(f"Address: {address}")
        if teachers_fte := getattr(self, '_last_teachers_fte', 0):
            notes_parts.append(f"Teachers FTE: {teachers_fte}")
        notes_parts.append(f"score={score} | channel={channel}")
        notes = " | ".join(notes_parts)
        
        return TeacherProspect(
            key=key,
            business_name=business_name,
            service=service,
            city=city,
            website=website or "(not found)",
            email=email or "(none found)",
            phone=phone or "(none found)",
            facebook="",
            notes=notes,
            score=score,
            channel=channel,
            status="new",
            created_at=now,
            updated_at=now,
            last_outreach_at="",
            last_outreach_channel="",
            last_outreach_subject="",
            follow_up_due="",
            history=[]
        )
    
    def _save_progress(self, prospects: List[TeacherProspect]):
        output_path = os.path.join(self.output_dir, "outreach_db.json")
        
        existing = {"leads": {}}
        if os.path.exists(output_path):
            try:
                with open(output_path, 'r') as f:
                    existing = json.load(f)
            except:
                pass
        
        for p in prospects:
            existing["leads"][p.key] = asdict(p)
        
        with open(output_path, 'w') as f:
            json.dump(existing, f, indent=2, ensure_ascii=False)
        
        print(f"  Saved {len(prospects)} prospects to {output_path} (total: {len(existing['leads'])})")


def main():
    parser = argparse.ArgumentParser(description="Teacher Prospecting Pipeline for HomeworkHelper")
    parser.add_argument("--states", required=True, help="Comma-separated state abbreviations (e.g., IL,CA,TX)")
    parser.add_argument("--output-dir", default="/home/ibcnu/HHproduction-workdir/prospects",
                        help="Output directory for prospects")
    parser.add_argument("--max-per-state", type=int, default=100, help="Max schools per state")
    parser.add_argument("--year", type=int, default=2024, help="School year (e.g., 2024 for 2024-2025)")
    parser.add_argument("--no-enrich", action="store_true", help="Skip website enrichment (faster, no emails)")
    
    args = parser.parse_args()
    
    states = [s.strip().upper() for s in args.states.split(",")]
    
    print(f"Starting teacher prospecting for states: {', '.join(states)}")
    print(f"Year: {args.year}-{args.year+1}")
    print(f"Output directory: {args.output_dir}")
    print(f"Max schools per state: {args.max_per_state}")
    print(f"Enrichment: {'disabled' if args.no_enrich else 'enabled'}")
    
    prospector = TeacherProspector(states, args.output_dir, args.year)
    prospects = prospector.run(
        max_schools_per_state=args.max_per_state,
        enrich=not args.no_enrich
    )
    
    print(f"\n=== COMPLETE ===")
    print(f"Total prospects generated: {len(prospects)}")
    
    by_state = {}
    for p in prospects:
        state = p.city.split(', ')[-1] if ', ' in p.city else 'Unknown'
        by_state[state] = by_state.get(state, 0) + 1
    
    for state, count in sorted(by_state.items()):
        print(f"  {state}: {count} prospects")


if __name__ == "__main__":
    main()