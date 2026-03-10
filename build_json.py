import csv
import json

def parse_csv_to_json(csv_filepath, json_filepath):
    courses = []
    
    with open(csv_filepath, mode='r', encoding='utf-8-sig') as file:
        reader = csv.DictReader(file)
        for row in reader:
            # The course title is actually in the 'Fall 2026' column
            title = row.get('Fall 2026', '').strip()
            course_code = row.get('Course', '').strip()
            dept = row.get('Dept', '').strip()
            
            # Skip empty rows or rows that are just department headers
            if not title or not course_code or not dept:
                continue
                
            # Combine first and last name safely
            first_name = row.get('Professor First name', '').strip()
            last_name = row.get('Professor Last name', '').strip()
            instructor = f"{first_name} {last_name}".strip()
            
            # Construct the course dictionary
            course = {
                "department": dept,
                "courseCode": course_code,
                "section": row.get('section', '').strip(),
                "title": title,
                "instructor": instructor if instructor else "TBD",
                "term": row.get('TERM', 'BFA FALL').strip(),
                "schedule": {
                    "day": row.get('DAY', '').strip(),
                    "time": row.get('TIME', '').strip()
                },
                "room": row.get('ROOM', '').strip(),
                "capacity": row.get('Course caps', '').strip(),
                "notes": row.get('NOTE / DATE', '').strip()
            }
            courses.append(course)

    with open(json_filepath, mode='w', encoding='utf-8') as json_file:
        json.dump(courses, json_file, indent=4)
        
    print(f"Successfully converted {len(courses)} courses to {json_filepath}")

# Run the script
parse_csv_to_json('courses.csv', 'courses.json')