#!/usr/bin/env python3
"""
Extract Illinois Learning Standards from ISBE PDFs with proper column handling.
Outputs structured JSON: subject -> grade -> [{ code, description }]
"""

import pdfplumber
import json
import re
from pathlib import Path
from collections import defaultdict

SOURCE_DIR = Path(__file__).parent / "standards-source"
OUTPUT_FILE = Path(__file__).parent.parent / "api" / "_standards_data.json"

# ELA K-5 strand prefixes
ELA_STRAND_PREFIXES = {
    "Key Ideas and Details": {"Literature": "RL", "Informational": "RI"},
    "Craft and Structure": {"Literature": "RL", "Informational": "RI"},
    "Integration of Knowledge and Ideas": {"Literature": "RL", "Informational": "RI"},
    "Range of Reading and Level of Text Complexity": {"Literature": "RL", "Informational": "RI"},
    "Phonics and Word Recognition": {"Foundational": "RF"},
    "Fluency": {"Foundational": "RF"},
    "Text Types and Purposes": {"Writing": "W"},
    "Production and Distribution of Writing": {"Writing": "W"},
    "Research to Build and Present Knowledge": {"Writing": "W"},
    "Range of Writing": {"Writing": "W"},
    "Comprehension and Collaboration": {"Speaking": "SL"},
    "Presentation of Knowledge and Ideas": {"Speaking": "SL"},
    "Conventions of Standard English": {"Language": "L"},
    "Knowledge of Language": {"Language": "L"},
    "Vocabulary Acquisition and Use": {"Language": "L"},
}

CODE_PATTERNS = {
    "ELA": [
        r'R[LIF]\.\d+\.\d+',      # RL.5.1, RI.5.1, RF.5.3
        r'[WSL]\.\d+\.\d+',       # W.5.1, SL.5.1, L.5.1
    ],
    "Math": [
        r'\d+\.\w+\.\d+',         # 3.OA.1, 4.NBT.2
    ],
    "Science": [
        r'[A-Z]{1,2}-[A-Z]{1,2}-\d+',  # K-PS2-1, MS-LS1-1
    ],
    "Social Science": [
        r'SS\.[A-Z]{2}\.\d+[\.\d\-A-Z]*',  # SS.IS.1.6-8, SS.CV.2.6-8
    ],
}

SUBJECT_CONFIG = {
    "ELA": {"file": "ela-standards.pdf"},
    "Math": {"file": "math-standards.pdf"},
    "Science": {"file": "science-standards.pdf"},
    "Social Science": {"file": "social-science-standards.pdf"},
}

def extract_all_text_with_positions(pdf_path):
    """Extract all text with word positions from PDF."""
    pages_data = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            words = page.extract_words()
            text = page.extract_text() or ""
            pages_data.append({
                "page_num": i + 1,
                "width": page.width,
                "height": page.height,
                "words": words,
                "text": text
            })
    return pages_data

def group_words_into_lines(words, y_tolerance=5):
    if not words:
        return []
    words_sorted = sorted(words, key=lambda w: (w['top'], w['x0']))
    lines = []
    current_line = []
    current_y = None
    
    for w in words_sorted:
        y = round(w['top'])
        if current_y is None or abs(y - current_y) <= y_tolerance:
            current_line.append(w)
            current_y = y if current_y is None else current_y
        else:
            if current_line:
                lines.append(' '.join(w['text'] for w in sorted(current_line, key=lambda w: w['x0'])))
            current_line = [w]
            current_y = y
    
    if current_line:
        lines.append(' '.join(w['text'] for w in sorted(current_line, key=lambda w: w['x0'])))
    
    return lines

def extract_ela_k5_standards(pages_data):
    """Extract ELA K-5 standards from 3-column tables by row."""
    standards = []
    
    page_strand = {}
    counter = defaultdict(int)
    
    for page_data in pages_data:
        text = page_data["text"]
        page_num = page_data["page_num"]
        words = page_data["words"]
        
        # Detect strand headers from full page text
        for strand in ELA_STRAND_PREFIXES:
            if strand.lower() in text.lower():
                if "Literature" in text and "Informational" not in text:
                    strand_type = "Literature"
                elif "Informational" in text:
                    strand_type = "Informational"
                elif "Foundational" in text:
                    strand_type = "Foundational"
                elif "Writing" in text:
                    strand_type = "Writing"
                elif "Speaking" in text or "Listening" in text:
                    strand_type = "Speaking"
                elif "Language" in text:
                    strand_type = "Language"
                else:
                    strand_type = "Literature"
                page_strand[page_num] = (strand, strand_type)
        
        # Find 3-column table pages
        if "Grade 3 students:" in text and "Grade 4 students:" in text and "Grade 5 students:" in text:
            col_bounds = {
                "3rd": (70, 300),
                "4th": (350, 550),
                "5th": (560, 720),
            }
            
            rows = defaultdict(lambda: {"3rd": [], "4th": [], "5th": []})
            
            for w in words:
                y = round(w['top'])
                for grade, (x0_min, x0_max) in col_bounds.items():
                    if x0_min <= w['x0'] < x0_max:
                        rows[y][grade].append(w)
                        break
            
            strand_info = page_strand.get(page_num, (None, "Literature"))
            current_strand, current_strand_type = strand_info
            
            for y in sorted(rows.keys()):
                row = rows[y]
                
                col_texts = {}
                for grade in ["3rd", "4th", "5th"]:
                    if row[grade]:
                        col_texts[grade] = ' '.join(w['text'] for w in sorted(row[grade], key=lambda w: w['x0']))
                    else:
                        col_texts[grade] = ""
                
                g3_text = col_texts.get("3rd", "").strip()
                match = re.match(r'^(\d+)\.\s+(.+)', g3_text)
                if match:
                    num = int(match.group(1))
                    g3_desc = match.group(2).strip()
                    g4_desc = col_texts.get("4th", "").strip()
                    g5_desc = col_texts.get("5th", "").strip()
                    
                    full_desc = g3_desc
                    if g4_desc and g4_desc not in full_desc:
                        full_desc += " " + g4_desc
                    if g5_desc and g5_desc not in full_desc:
                        full_desc += " " + g5_desc
                    
                    full_desc = re.sub(r'\s+', ' ', full_desc).strip()
                    
                    if len(full_desc) > 10:
                        if current_strand_type == "Literature":
                            prefix = "RL"
                        elif current_strand_type == "Informational":
                            prefix = "RI"
                        elif current_strand_type == "Foundational":
                            prefix = "RF"
                        elif current_strand_type == "Writing":
                            prefix = "W"
                        elif current_strand_type == "Speaking":
                            prefix = "SL"
                        elif current_strand_type == "Language":
                            prefix = "L"
                        else:
                            prefix = "RL"
                        
                        # Counter keyed by grade, strand, AND prefix (RL/RI/RF/W/SL/L)
                        # to properly number within each strand
                        counter_key = f"{grade}:{current_strand}:{prefix}"
                        counter[counter_key] += 1
                        code = f"{prefix}.{grade[0]}.{counter[counter_key]}"
                        
                        standards.append({
                            "code": code,
                            "description": full_desc[:500],
                            "grade": grade,
                            "page": page_num
                        })
    
    return standards

def extract_math_standards(pages_data):
    """Extract math standards by detecting domain and numbering within domain."""
    standards = []
    for page_data in pages_data:
        text = page_data["text"]
        page_num = page_data["page_num"]
        words = page_data["words"]
        
        # Detect domain from headings like "operations and algebraic thinking 3.oa"
        current_domain = None
        domain_match = re.search(r'(\d+)\.(oa|nbt|nf|md|g|rp|ns|ee|f|sp|rn|q|cn|vm|sse|apr|ced|rei|if|bf|le|tf|co|srt|c|gpe|gmd|mg|id|ic|cp)\b', text, re.IGNORECASE)
        if domain_match:
            current_domain = domain_match.group(2).upper()
        
        # Count standards within each domain
        domain_counter = defaultdict(int)
        
        # Find numbered items (1., 2., 3., etc.) that are standards
        numbered_items = {}
        for w in words:
            if w['x0'] < 150:  # Left side of page
                match = re.match(r'^(\d+)\.$', w['text'])
                if match:
                    num = int(match.group(1))
                    y = round(w['top'])
                    if y not in numbered_items:
                        numbered_items[y] = []
                    numbered_items[y].append((num, w['x1']))

        # Now get all words on each line with a number
        for y, items in sorted(numbered_items.items()):
            for num, x1 in items:
                line_words = [w for w in words if round(w['top']) == y and w['x0'] > x1]
                if line_words:
                    desc = ' '.join(w['text'] for w in sorted(line_words, key=lambda w: w['x0']))
                    desc = re.sub(r'\s+', ' ', desc).strip()
                    desc = re.sub(r'^[\.\:\-\s]+', '', desc)
                    
                    if len(desc) > 10 and 1 <= num <= 20:
                        if current_domain:
                            domain_counter[current_domain] += 1
                            if domain_counter[current_domain] == num:
                                # Extract grade from page text
                                grade_match = re.search(r'Grade\s+(\d+)', text)
                                grade_num = int(grade_match.group(1)) if grade_match else 3
                                grade = f"{grade_num}th"
                                
                                code = f"{grade_num}.{current_domain}.{num}"
                                standards.append({
                                    "code": code,
                                    "description": desc[:500],
                                    "grade": grade,
                                    "page": page_num
                                })
        
        # Also find CCSS.MATH.CONTENT patterns
        for match in re.finditer(r'CCSS\.MATH\.CONTENT\.(\d+)\.(\w+)\.(\d+)', text):
            grade_num = int(match.group(1))
            domain = match.group(2).upper()
            standard_num = int(match.group(3))
            code = f"{grade_num}.{domain}.{standard_num}"
            
            start = match.end()
            remaining = text[start:start+500]
            next_match = re.search(r'CCSS\.MATH\.CONTENT\.\d+\.\w+\.\d+', remaining)
            if next_match:
                desc = remaining[:next_match.start()].strip()
            else:
                desc = remaining.strip()
            
            desc = re.sub(r'\s+', ' ', desc)
            desc = re.sub(r'^[\.\:\-\s]+', '', desc)
            
            if len(desc) > 10:
                grade = f"{grade_num}th"
                standards.append({
                    "code": code,
                    "description": desc[:500],
                    "grade": grade,
                    "page": page_num
                })
    
    return standards

def extract_all_text_with_positions(pdf_path):
    """Extract all text with word positions from PDF."""
    pages_data = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            words = page.extract_words()
            text = page.extract_text() or ""
            pages_data.append({
                "page_num": i + 1,
                "width": page.width,
                "height": page.height,
                "words": words,
                "text": text
            })
    return pages_data

def group_words_into_lines(words, y_tolerance=5):
    if not words:
        return []
    words_sorted = sorted(words, key=lambda w: (w['top'], w['x0']))
    lines = []
    current_line = []
    current_y = None
    
    for w in words_sorted:
        y = round(w['top'])
        if current_y is None or abs(y - current_y) <= y_tolerance:
            current_line.append(w)
            current_y = y if current_y is None else current_y
        else:
            if current_line:
                lines.append(' '.join(w['text'] for w in sorted(current_line, key=lambda w: w['x0'])))
            current_line = [w]
            current_y = y
    
    if current_line:
        lines.append(' '.join(w['text'] for w in sorted(current_line, key=lambda w: w['x0'])))
    
    return lines

def extract_social_science_standards(pages_data):
    """Extract Social Science standards with column-based extraction."""
    standards = []
    
    for page_data in pages_data:
        words = page_data["words"]
        text = page_data["text"]
        page_num = page_data["page_num"]
        
        columns = {
            "K-2": (41, 466),
            "3-5": (314, 699),
            "6-8": (437, 690),
            "9-12": (669, 720),
        }
        
        for grade_band, (x0_min, x0_max) in columns.items():
            col_words = [w for w in words if x0_min <= w['x0'] < x0_max]
            if not col_words:
                continue
            
            lines = group_words_into_lines(col_words)
            
            current_code = None
            current_desc = []
            
            for line_text in lines:
                line_text = line_text.strip()
                if not line_text or len(line_text) < 5:
                    continue
                
                code_match = re.match(r'(SS\.[A-Z]{2}\.\d+[\.\d\-A-Z]*)', line_text)
                if code_match:
                    if current_code and current_desc:
                        desc = ' '.join(current_desc).strip()
                        desc = re.sub(r'\s+', ' ', desc)
                        if len(desc) > 10 and len(desc) < 500:
                            grade = determine_ss_grade_from_code(current_code)
                            standards.append({
                                "code": current_code,
                                "description": desc[:500],
                                "grade": grade,
                                "page": page_num
                            })
                    
                    current_code = code_match.group(1)
                    current_desc = [line_text[len(current_code):].strip()]
                elif current_code and len(line_text) > 3:
                    current_desc.append(line_text)
            
            if current_code and current_desc:
                desc = ' '.join(current_desc).strip()
                desc = re.sub(r'\s+', ' ', desc)
                if len(desc) > 10 and len(desc) < 500:
                    grade = determine_ss_grade_from_code(current_code)
                    standards.append({
                        "code": current_code,
                        "description": desc[:500],
                        "grade": grade,
                        "page": page_num
                    })
    
    return standards

def determine_ss_grade_from_code(code):
    """Determine grade from Social Science code."""
    m = re.search(r'SS\.[A-Z]{2}\.\d+\.(\d+)[\-\–](\d+)', code)
    if m:
        return f"{m.group(1)}-{m.group(2)}"
    m = re.search(r'SS\.[A-Z]{2}\.\d+\.(\d+)', code)
    if m:
        n = int(m.group(1))
        if n == 0 or n == 1:
            return "K"
        if n == 1:
            return "1st"
        if n == 2:
            return "2nd"
        if n == 3:
            return "3rd"
        if n == 4:
            return "4th"
        if n == 5:
            return "5th"
        if n <= 8:
            return f"{n}th"
        if n <= 12:
            return f"{n}th"
    if '.K.' in code:
        return "K"
    return "Unknown"

def extract_standards_generic(pages_data, subject):
    """Generic extraction for Science using code patterns."""
    standards = []
    patterns = CODE_PATTERNS.get(subject, [])
    
    for page_data in pages_data:
        text = page_data["text"]
        page_num = page_data["page_num"]
        
        for pattern in patterns:
            for match in re.finditer(pattern, text):
                code = match.group()
                start = match.end()
                remaining = text[start:start+500]
                
                next_pos = len(remaining)
                for p in patterns:
                    next_match = re.search(p, remaining)
                    if next_match:
                        next_pos = min(next_pos, next_match.start())
                
                desc = remaining[:min(next_pos, 500)].strip()
                desc = re.sub(r'\s+', ' ', desc)
                desc = re.sub(r'^[\.\:\-\s]+', '', desc)
                
                if len(desc) > 10:
                    grade = determine_grade_from_code(code, subject)
                    standards.append({
                        "code": code,
                        "description": desc[:500],
                        "grade": grade,
                        "page": page_num
                    })
    
    return standards

def determine_grade_from_code(code, subject):
    """Determine grade level from standard code."""
    if subject == "ELA":
        m = re.search(r'R[LIF]\.(\d+)\.\d+', code)
        if m:
            n = int(m.group(1))
            if n == 1: return "1st"
            if n == 2: return "2nd"
            if n == 3: return "3rd"
            return f"{n}th"
        m = re.search(r'[WSL]\.(\d+)\.\d+', code)
        if m:
            n = int(m.group(1))
            if n == 1: return "1st"
            if n == 2: return "2nd"
            if n == 3: return "3rd"
            return f"{n}th"
    elif subject == "Math":
        m = re.search(r'(\d+)\.\w+\.\d+', code)
        if m:
            n = int(m.group(1))
            return f"{n}th"
    elif subject == "Science":
        if code.startswith('K-'): return "K"
        if code.startswith('MS-'): return "6-8"
        if code.startswith('HS-'): return "9-12"
    elif subject == "Social Science":
        m = re.search(r'SS\.[A-Z]{2}\.\d+\.(\d+)[\-\–](\d+)', code)
        if m:
            return f"{m.group(1)}-{m.group(2)}"
        m = re.search(r'SS\.[A-Z]{2}\.\d+\.(\d+)', code)
        if m:
            n = int(m.group(1))
            if n == 0 or n == 1: return "K"
            if n == 1: return "1st"
            if n == 2: return "2nd"
            if n == 3: return "3rd"
            if n == 4: return "4th"
            if n == 5: return "5th"
            if n <= 8: return f"{n}th"
            if n <= 12: return f"{n}th"
        if '.K.' in code:
            return "K"
    return "Unknown"

def process_subject(subject, config):
    pdf_path = SOURCE_DIR / config["file"]
    if not pdf_path.exists():
        print(f"  PDF not found: {pdf_path}")
        return {}
    
    print(f"  Processing {subject} ({config['file']})...")
    pages_data = extract_all_text_with_positions(pdf_path)
    print(f"    Extracted {len(pages_data)} pages")
    
    all_standards = []
    
    if subject == "ELA":
        k5_standards = extract_ela_k5_standards(pages_data)
        print(f"    ELA K-5 extracted: {len(k5_standards)} standards")
        all_standards.extend(k5_standards)
        
        gen_standards = extract_standards_generic(pages_data, "ELA")
        print(f"    ELA 6-12 extracted: {len(gen_standards)} standards")
        all_standards.extend(gen_standards)
    
    elif subject == "Math":
        math_standards = extract_math_standards(pages_data)
        print(f"    Math extracted: {len(math_standards)} standards")
        all_standards = math_standards
    
    elif subject == "Science":
        sci_standards = extract_standards_generic(pages_data, "Science")
        print(f"    Science extracted: {len(sci_standards)} standards")
        all_standards = sci_standards
    
    elif subject == "Social Science":
        ss_standards = extract_social_science_standards(pages_data)
        print(f"    Social Science extracted: {len(ss_standards)} standards")
        all_standards = ss_standards
    
    print(f"    Total raw standards: {len(all_standards)}")
    
    grade_data = defaultdict(list)
    for s in all_standards:
        grade = s.get("grade", "Unknown")
        if grade != "Unknown":
            grade_data[grade].append({"code": s["code"], "description": s["description"]})
    
    for grade in grade_data:
        seen = set()
        unique = []
        for s in grade_data[grade]:
            if s["code"] not in seen:
                seen.add(s["code"])
                unique.append(s)
        grade_data[grade] = unique
        print(f"    {grade}: {len(unique)} standards")
    
    return dict(grade_data)

def main():
    print("Extracting Illinois Learning Standards from PDFs (row-based ELA)...")
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
    
    print("\n=== VERIFICATION SAMPLES ===")
    
    ela_5 = all_data.get("ELA", {}).get("5th", [])
    ri51 = next((s for s in ela_5 if 'RI.5' in s['code']), None)
    if ri51:
        print(f"ELA 5th RI.5.1 area: {ri51['code']} - {ri51['description'][:200]}")
    else:
        print("ELA 5th RI.5.1 area: NOT FOUND")
        print(f"  Available codes: {[s['code'] for s in ela_5[:15]]}")
    
    ela_9 = all_data.get("ELA", {}).get("9th", []) or all_data.get("ELA", {}).get("9-10", [])
    rl91 = next((s for s in ela_9 if 'RL.9' in s['code']), None)
    if rl91:
        print(f"ELA 9th RL.9-10.1 area: {rl91['code']} - {rl91['description'][:200]}")
    else:
        print("ELA 9th RL.9-10.1 area: NOT FOUND")
        print(f"  Available codes: {[s['code'] for s in ela_9[:15]]}")
    
    math_3 = all_data.get("Math", {}).get("3th", [])
    if math_3:
        print(f"Math 3rd sample: {math_3[0]['code']} - {math_3[0]['description'][:200]}")
    else:
        print("Math 3rd: NOT FOUND")
    
    ss_6 = all_data.get("Social Science", {}).get("6-8", []) or all_data.get("Social Science", {}).get("6th", [])
    if ss_6:
        print(f"Social Science 6th sample: {ss_6[0]['code']} - {ss_6[0]['description'][:200]}")
    else:
        print("Social Science 6th: NOT FOUND")

if __name__ == "__main__":
    main()