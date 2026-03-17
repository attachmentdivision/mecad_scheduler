import csv
import json
import re

try:
    import pypdf
except ImportError:
    print("Please install pypdf by running: pip install pypdf")
    exit()

def extract_descriptions(pdf_path):
    text = ""
    try:
        with open(pdf_path, 'rb') as f:
            reader = pypdf.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text() + "\n"
    except FileNotFoundError:
        print(f"Warning: Could not find {pdf_path}. Skipping descriptions for this term.")
        return {}
            
    lines = text.split('\n')
    course_dict = {}
    current_course = None
    current_desc = []
    
    # Regex to find lines starting with a course code (e.g. "AH 101", "FN 109")
    course_pattern = re.compile(r'^([A-Z]{2,3}\s\d{3}[A-Z]?)\s+(.*)')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Ignore PDF header/footer artifacts
        if line.startswith('--- PAGE') or 'Course Descriptions' in line or 'MAINE COLLEGE' in line or 'OF ART & DESIGN' in line:
            continue
        if 'Program Chair:' in line:
            continue
            
        match = course_pattern.match(line)
        if match:
            # Save the PREVIOUS course's accumulated description
            if current_course:
                desc_text = " ".join(current_desc).strip()
                desc_text = re.sub(r'(Required|Elective|Prerequisite)s?:.*$', '', desc_text).strip()
                course_dict[current_course] = desc_text
                
            # Start tracking the NEW course (normalize spaces)
            raw_code = match.group(1).strip()
            current_course = " ".join(raw_code.split()) 
            current_desc = []
        else:
            # If it's not a course title line, it's a description line
            if current_course:
                current_desc.append(line)
                
    # Save the very last course in the document
    if current_course:
        desc_text = " ".join(current_desc).strip()
        desc_text = re.sub(r'(Required|Elective|Prerequisite)s?:.*$', '', desc_text).strip()
        course_dict[current_course] = desc_text
        
    return course_dict

print("1. Extracting descriptions from PDFs...")
fall_desc = extract_descriptions('CourseDescr_DRAFT_FALL26.pdf')
spring_desc = extract_descriptions('CourseDescr_DRAFT_SPRING27.pdf')

# Combine them into one master dictionary
all_descriptions = {**fall_desc, **spring_desc}

fall_courses = []
spring_courses = []

print("2. Parsing CSV schedule and merging descriptions...")
csv_filename = 'REG Schedule 26-27 as of 3.12.2026 - COMBINED -3.12.26.csv'

with open(csv_filename, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    # Dynamically find the title column
    title_key = next((key for key in reader.fieldnames if key and ('Combined' in key or 'AY' in key or 'Fall' in key or 'Spring' in key)), None)
    
    for row in reader:
        dept = row.get('Dept', '').strip()
        course_code = row.get('Course', '').strip()
        term = row.get('TERM', '').strip().upper()
        
        # Skip invalid rows
        if not dept or not course_code or dept.lower() == 'x' or ('0' in dept and 'current' in course_code.lower()):
            continue
            
        first_name = row.get('Professor First name', '').strip()
        last_name = row.get('Professor Last name', '').strip()
        instructor = f"{first_name} {last_name}".strip()
        
        # Normalize the CSV course code to match the PDF dictionary (removes double spaces)
        clean_code = " ".join(course_code.split())
        desc = all_descriptions.get(clean_code, "")
        
        course_obj = {
            "department": dept,
            "courseCode": clean_code,
            "section": row.get('section', '').strip(),
            "title": row.get(title_key, '').strip() if title_key else "",
            "instructor": instructor if instructor else "TBD",
            "term": term,
            "schedule": {
                "day": row.get('DAY', '').strip(),
                "time": row.get('TIME', '').strip()
            },
            "room": row.get('ROOM', '').strip(),
            "capacity": row.get('Course caps', '').strip(),
            "notes": row.get('NOTE / DATE', '').strip(),
            "description": desc
        }
        
        if 'FALL' in term:
            fall_courses.append(course_obj)
        elif 'SPRING' in term:
            spring_courses.append(course_obj)

print("3. Writing JSON files...")
with open('fall.json', 'w', encoding='utf-8') as f:
    json.dump(fall_courses, f, indent=2)

with open('spring.json', 'w', encoding='utf-8') as f:
    json.dump(spring_courses, f, indent=2)

print(f"✅ Success! Built fall.json ({len(fall_courses)} courses) and spring.json ({len(spring_courses)} courses).")