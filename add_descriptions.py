import json
import re

try:
    import pypdf
except ImportError:
    print("Please install pypdf by running: pip install pypdf")
    exit()

def extract_descriptions(pdf_path):
    text = ""
    # Open and extract text from all pages
    with open(pdf_path, 'rb') as f:
        reader = pypdf.PdfReader(f)
        for page in reader.pages:
            text += page.extract_text() + "\n"
            
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
                # Clean off the "Required: / Elective:" metadata at the end of the text block
                desc_text = re.sub(r'(Required|Elective|Prerequisite)s?:.*$', '', desc_text).strip()
                course_dict[current_course] = desc_text
                
            # Start tracking the NEW course
            current_course = match.group(1).replace("  ", " ").strip()
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

def update_json(json_path, descriptions):
    with open(json_path, 'r', encoding='utf-8') as f:
        courses = json.load(f)
        
    updated_count = 0
    for course in courses:
        code = course.get('courseCode', '').strip()
        # If the course code from the JSON exists in our PDF dictionary, add it!
        if code in descriptions:
            course['description'] = descriptions[code]
            updated_count += 1
            
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(courses, f, indent=2)
        
    print(f"✅ Updated {updated_count} descriptions in {json_path}")

print("Parsing PDFs...")
fall_dict = extract_descriptions('CourseDescr_DRAFT_FALL26.pdf')
spring_dict = extract_descriptions('CourseDescr_DRAFT_SPRING27.pdf')

# Combine them into one master dictionary just in case a course spans both semesters
all_descriptions = {**fall_dict, **spring_dict}

print("Updating JSON files...")
update_json('fall.json', all_descriptions)
update_json('spring.json', all_descriptions)

print("Done! You can now test your portal.")