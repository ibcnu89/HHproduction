#!/usr/bin/env python3
"""
Extract Illinois Learning Standards from ISBE PDFs.
Outputs structured JSON: subject -> grade -> [{ code, description }]
"""

import pdfplumber
import json
import re
from pathlib import Path

SOURCE_DIR = Path(__file__).parent / "standards-source"
OUTPUT_FILE = Path(__file__).parent.parent / "api" / "_standards_data.json"

SUBJECT_CONFIG = {
    "Math": {
        "file": "math-standards.pdf",
        "grade_patterns": {
            "K": [r"Kindergarten", r"Grade K"],
            "1st": [r"Grade 1\b", r"1st Grade"],
            "2nd": [r"Grade 2\b", r"2nd Grade"],
            "3rd": [r"Grade 3\b", r"3rd Grade"],
            "4th": [r"Grade 4\b", r"4th Grade"],
            "5th": [r"Grade 5\b", r"5th Grade"],
            "6th": [r"Grade 6\b", r"6th Grade"],
            "7th": [r"Grade 7\b", r"7th Grade"],
            "8th": [r"Grade 8\b", r"8th Grade"],
            "9th": [r"Grade 9\b", r"9th Grade", r"High School", r"Algebra I", r"Geometry"],
            "10th": [r"Grade 10\b", r"10th Grade", r"Geometry", r"Algebra II"],
            "11th": [r"Grade 11\b", r"11th Grade", r"Algebra II", r"Precalculus"],
            "12th": [r"Grade 12\b", r"12th Grade", r"Precalculus", r"Calculus", r"Statistics"],
        }
    },
    "ELA": {
        "file": "ela-standards.pdf",
        "grade_patterns": {
            "K": [r"Kindergarten", r"Grade K"],
            "1st": [r"Grade 1\b", r"1st Grade"],
            "2nd": [r"Grade 2\b", r"2nd Grade"],
            "3rd": [r"Grade 3\b", r"3rd Grade"],
            "4th": [r"Grade 4\b", r"4th Grade"],
            "5th": [r"Grade 5\b", r"5th Grade"],
            "6th": [r"Grade 6\b", r"6th Grade"],
            "7th": [r"Grade 7\b", r"7th Grade"],
            "8th": [r"Grade 8\b", r"8th Grade"],
            "9th": [r"Grade 9\b", r"9th Grade", r"Grades 9-10"],
            "10th": [r"Grade 10\b", r"10th Grade", r"Grades 9-10"],
            "11th": [r"Grade 11\b", r"11th Grade", r"Grades 11-12"],
            "12th": [r"Grade 12\b", r"12th Grade", r"Grades 11-12"],
        }
    },
    "Science": {
        "file": "science-standards.pdf",
        "grade_patterns": {
            "K": [r"Kindergarten", r"Grade K"],
            "1st": [r"Grade 1\b", r"1st Grade"],
            "2nd": [r"Grade 2\b", r"2nd Grade"],
            "3rd": [r"Grade 3\b", r"3rd Grade"],
            "4th": [r"Grade 4\b", r"4th Grade"],
            "5th": [r"Grade 5\b", r"5th Grade"],
            "6th": [r"Grade 6\b", r"6th Grade", r"Middle School"],
            "7th": [r"Grade 7\b", r"7th Grade", r"Middle School"],
            "8th": [r"Grade 8\b", r"8th Grade", r"Middle School"],
            "9th": [r"Grade 9\b", r"9th Grade", r"High School", r"Biology"],
            "10th": [r"Grade 10\b", r"10th Grade", r"Chemistry"],
            "11th": [r"Grade 11\b", r"11th Grade", r"Physics"],
            "12th": [r"Grade 12\b", r"12th Grade", r"Earth Science", r"AP"],
        }
    },
    "Social Science": {
        "file": "social-science-standards.pdf",
        "grade_patterns": {
            "K": [r"Kindergarten", r"Grade K"],
            "1st": [r"Grade 1\b", r"1st Grade"],
            "2nd": [r"Grade 2\b", r"2nd Grade"],
            "3rd": [r"Grade 3\b", r"3rd Grade"],
            "4th": [r"Grade 4\b", r"4th Grade", r"Illinois History"],
            "5th": [r"Grade 5\b", r"5th Grade", r"US History"],
            "6th": [r"Grade 6\b", r"6th Grade", r"World History", r"Ancient"],
            "7th": [r"Grade 7\b", r"7th Grade", r"World Geography"],
            "8th": [r"Grade 8\b", r"8th Grade", r"US Constitution", r"Civics"],
            "9th": [r"Grade 9\b", r"9th Grade", r"World History", r"Geography"],
            "10th": [r"Grade 10\b", r"10th Grade", r"US History"],
            "11th": [r"Grade 11\b", r"11th Grade", r"Government", r"Economics"],
            "12th": [r"Grade 12\b", r"12th Grade", r"Psychology", r"Sociology"],
        }
    }
}

CODE_PATTERNS = [
    r'[A-Z]{2,4}\.[A-Z]{2,4}\.[A-Z0-9]+\.[A-Z0-9]+\.[0-9]+',
    r'[A-Z]{1,2}\.[0-9]\.[0-9]+',
    r'[A-Z]{1,2}\.[0-9]\.[0-9]+\.[a-z]',
    r'[A-Z]+-[A-Z]+-\d+',
    r'\d+\.\d+\.\d+',
    r'[A-Z]{2,4}\.\d+\.\d+',
]

def extract_text_from_pdf(pdf_path):
    pages_text = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text:
                    pages_text.append({"page": i + 1, "text": text})
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
    return pages_text

def extract_standards_from_text(text, grade_level, subject):
    standards = []
    lines = text.split('\n')
    
    for line in lines:
        line = line.strip()
        if not line or len(line) < 10:
            continue
        
        code = None
        for pattern in CODE_PATTERNS:
            match = re.search(pattern, line)
            if match:
                code = match.group()
                break
        
        if not code:
            if re.match(r'^[\dA-Z][\.\)]\s', line) and len(line) > 15:
                parts = line.split('.')
                if len(parts) > 1:
                    code = parts[0] + '.'
        
        if code:
            desc = line.replace(code, '').strip()
            desc = re.sub(r'^[\.\-\:\s]+', '', desc)
            if len(desc) > 5:
                standards.append({"code": code, "description": desc})
    
    return standards

def process_subject(subject, config):
    pdf_path = SOURCE_DIR / config["file"]
    if not pdf_path.exists():
        print(f"  PDF not found: {pdf_path}")
        return {}
    
    print(f"  Processing {subject} ({config['file']})...")
    pages = extract_text_from_pdf(pdf_path)
    print(f"    Extracted {len(pages)} pages with text")
    
    grade_data = {}
    
    for grade, patterns in config["grade_patterns"].items():
        grade_standards = []
        
        for page in pages:
            text = page["text"]
            page_matches_grade = any(re.search(p, text, re.IGNORECASE) for p in patterns)
            
            if page_matches_grade:
                standards = extract_standards_from_text(text, grade, subject)
                grade_standards.extend(standards)
        
        seen = set()
        unique = []
        for s in grade_standards:
            if s["code"] not in seen:
                seen.add(s["code"])
                unique.append(s)
        
        if unique:
            grade_data[grade] = unique
            print(f"    {grade}: {len(unique)} standards")
        else:
            all_standards = []
            for page in pages:
                standards = extract_standards_from_text(page["text"], grade, subject)
                all_standards.extend(standards)
            
            seen = set()
            unique = []
            for s in all_standards:
                if s["code"] not in seen:
                    seen.add(s["code"])
                    unique.append(s)
            
            if unique:
                grade_data[grade] = unique[:50]
                print(f"    {grade}: {len(unique)} standards (broad search)")
            else:
                print(f"    {grade}: No standards found")
    
    return grade_data

def main():
    print("Extracting Illinois Learning Standards from PDFs...")
    all_data = {}
    
    for subject, config in SUBJECT_CONFIG.items():
        print(f"\n{subject}:")
        grade_data = process_subject(subject, config)
        if grade_data:
            all_data[subject] = grade_data
        else:
            print(f"  WARNING: No data extracted for {subject}")
    
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(all_data, f, indent=2)
    
    print(f"\nDone! Output saved to {OUTPUT_FILE}")
    
    total_subjects = len(all_data)
    total_grades = sum(len(grades) for grades in all_data.values())
    total_standards = sum(len(s) for grades in all_data.values() for s in grades.values())
    print(f"Subjects: {total_subjects}, Grade entries: {total_grades}, Total standards: {total_standards}")

if __name__ == "__main__":
    main()