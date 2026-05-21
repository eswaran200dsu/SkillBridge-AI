import re
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None
try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None
from docx import Document
from typing import List, Optional
from app.models.schemas import ParsedResume, Skill, Experience, Education, Project

# Common tech skills database
TECH_SKILLS = [
    "Python", "Java", "JavaScript", "TypeScript", "C++", "C#", "Go", "Rust", "Ruby", "PHP",
    "React", "Angular", "Vue", "Node.js", "Express", "Django", "Flask", "FastAPI", "Spring",
    "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Jenkins", "Git", "CI/CD",
    "MongoDB", "PostgreSQL", "MySQL", "Redis", "Elasticsearch", "SQL", "NoSQL",
    "Machine Learning", "Deep Learning", "NLP", "Computer Vision", "TensorFlow", "PyTorch",
    "REST API", "GraphQL", "Microservices", "Agile", "Scrum", "DevOps",
    "HTML", "CSS", "Tailwind", "Bootstrap", "SASS", "Webpack", "Vite",
    "Linux", "Bash", "PowerShell", "Nginx", "Apache", "Terraform", "Ansible"
]

SECTION_HEADINGS = {
    "experience": re.compile(r'^(?:[\u2022•\-*\d.\)\s]*)?(experience|work experience|employment|professional experience|work history)\b', re.IGNORECASE),
    "education": re.compile(r'^(?:[\u2022•\-*\d.\)\s]*)?(education|academic|qualifications?|educational background)\b', re.IGNORECASE),
    "projects": re.compile(r'^(?:[\u2022•\-*\d.\)\s]*)?(projects?|personal projects)\b', re.IGNORECASE),
    "skills": re.compile(r'^(?:[\u2022•\-*\d.\)\s]*)?(skills?|technical skills|core competencies)\b', re.IGNORECASE),
    "certifications": re.compile(r'^(?:[\u2022•\-*\d.\)\s]*)?(certifications?|achievements?)\b', re.IGNORECASE),
}


def normalize_lines(text: str) -> List[str]:
    lines = []
    for raw_line in text.replace('\r', '\n').split('\n'):
        line = re.sub(r'\s+', ' ', raw_line).strip()
        if line:
            lines.append(line)
    return lines


def clean_extracted_text(text: str) -> str:
    """Normalize extracted PDF/DOCX text without flattening section breaks."""
    cleaned_lines = []

    for raw_line in text.replace('\r', '\n').split('\n'):
        line = raw_line.strip()
        if not line:
            continue

        line = re.sub(r'([a-z])([A-Z])', r'\1 \2', line)
        line = re.sub(r'([A-Za-z])([0-9])', r'\1 \2', line)
        line = re.sub(r'([0-9])([A-Za-z])', r'\1 \2', line)
        line = re.sub(r'\s+', ' ', line)
        cleaned_lines.append(line)

    return '\n'.join(cleaned_lines).strip()


def is_section_heading(line: str) -> bool:
    normalized = re.sub(r'[:\-–—]+$', '', line.strip())
    return any(pattern.match(normalized) for pattern in SECTION_HEADINGS.values())


def extract_section_lines(text: str, section_name: str) -> List[str]:
    lines = normalize_lines(text)
    section_pattern = SECTION_HEADINGS[section_name]
    collected = []
    in_section = False

    for line in lines:
        normalized = re.sub(r'[:\-–—]+$', '', line.strip())

        if section_pattern.match(normalized):
            in_section = True
            continue

        if in_section and is_section_heading(normalized):
            break

        if in_section:
            collected.append(line)

    return collected

def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF using PyMuPDF or pypdf fallback."""
    try:
        if fitz is not None:
            doc = fitz.open(file_path)
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            return clean_extracted_text(text)

        if PdfReader is not None:
            reader = PdfReader(file_path)
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
            return clean_extracted_text(text)

        raise RuntimeError("PDF support is unavailable because no PDF parser is installed (PyMuPDF or pypdf)")
    except Exception as e:
        print(f"Error extracting PDF: {e}")
        return ""

def extract_text_from_docx(file_path: str) -> str:
    """Extract text from DOCX"""
    try:
        doc = Document(file_path)
        text = "\n".join([para.text for para in doc.paragraphs])
        return text
    except Exception as e:
        print(f"Error extracting DOCX: {e}")
        return ""

def extract_text_from_txt(file_path: str) -> str:
    """Extract text from TXT"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"Error extracting TXT: {e}")
        return ""


def extract_skills(text: str) -> List[Skill]:
    """Extract skills from resume text"""
    skills = []
    text_upper = text.upper()
    
    for skill in TECH_SKILLS:
        if skill.upper() in text_upper:
            skills.append(Skill(name=skill, level="Mentioned"))
    
    return skills

def extract_email(text: str) -> Optional[str]:
    """Extract email from text"""
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    match = re.search(email_pattern, text)
    return match.group(0) if match else None

def extract_phone(text: str) -> Optional[str]:
    """Extract phone number from text"""
    phone_pattern = r'[\+\(]?[1-9][0-9 .\-\(\)]{8,}[0-9]'
    match = re.search(phone_pattern, text)
    return match.group(0) if match else None

def extract_experiences(text: str) -> List[Experience]:
    """Extract work experiences with descriptions"""
    experiences = []
    
    lines = extract_section_lines(text, "experience")
    if not lines:
        lines = normalize_lines(text)

    if lines:
        
        # Job title keywords
        job_keywords = ['engineer', 'developer', 'manager', 'analyst', 'intern', 'designer', 
                       'consultant', 'lead', 'architect', 'specialist', 'coordinator', 'associate',
                       'executive', 'officer', 'director', 'head', 'senior', 'junior']
        date_pattern = re.compile(r'\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\b|\b\d{4}\b', re.IGNORECASE)
        
        current_exp = None
        i = 0
        
        while i < len(lines):
            line = lines[i]
            clean_line = re.sub(r'\s+', ' ', line).strip()
            
            # Check if this is a job title
            is_job_title = (
                any(keyword in clean_line.lower() for keyword in job_keywords)
                and len(clean_line) < 120
                and not clean_line.lower().startswith(('built', 'developed', 'implemented', 'worked', 'improved', 'designed'))
            )
            
            if is_job_title and not clean_line.startswith(('•', '-', '*', '·')):
                # Save previous experience
                if current_exp and (current_exp.company or current_exp.description):
                    experiences.append(current_exp)
                
                company = ""
                duration = ""
                title_line = clean_line

                title_match = re.split(r'\s+[·|\-|–—]\s+', clean_line, maxsplit=1)
                if len(title_match) > 1:
                    title_line = title_match[0].strip()
                    remainder = title_match[1].strip()
                    if date_pattern.search(remainder):
                        duration = remainder
                    else:
                        company = remainder

                current_exp = Experience(
                    title=title_line,
                    company=company,
                    duration=duration,
                    description=[]
                )
                
                # Next line might be company/duration
                if i + 1 < len(lines):
                    next_line = lines[i + 1]
                    if not next_line.startswith(('•', '-', '*', '·')) and not any(k in next_line.lower() for k in job_keywords):
                        if date_pattern.search(next_line):
                            current_exp.duration = next_line
                        else:
                            current_exp.company = next_line
                            if i + 2 < len(lines) and date_pattern.search(lines[i + 2]):
                                current_exp.duration = lines[i + 2]
                                i += 1
                        i += 1
            
            # Collect descriptions
            elif current_exp and clean_line.startswith(('•', '-', '*', '·')):
                desc = clean_line.lstrip('•-*· ').strip()
                if desc and len(desc) > 10:
                    current_exp.description.append(desc)
            
            i += 1
        
        # Add last experience
        if current_exp and (current_exp.company or current_exp.description):
            experiences.append(current_exp)
    
    print(f"DEBUG: Found {len(experiences)} experiences")
    for exp in experiences:
        print(f"  - {exp.title}: {exp.company}")
    
    return experiences


def extract_education(text: str) -> List[Education]:
    """Extract education information with details"""
    education = []
    
    lines = extract_section_lines(text, "education")
    if not lines:
        lines = normalize_lines(text)

    if lines:
        current_edu = None
        i = 0
        degree_pattern = re.compile(
            r'(b\.?\s*tech|b\.?\s*e\.?|m\.?\s*tech|mba|bca|mca|b\.?\s*sc\.?|m\.?\s*sc\.?|bachelor|master|diploma|ph\.?d\.?|phd|engineering)',
            re.IGNORECASE,
        )
        
        while i < len(lines):
            line = re.sub(r'\s+', ' ', lines[i]).strip()
            
            # Check if line contains a degree
            if degree_pattern.search(line):
                # Save previous education
                if current_edu:
                    education.append(current_edu)
                
                year_match = re.search(r'\b(19|20)\d{2}\b', line)
                year = year_match.group(0) if year_match else ""
                gpa_match = re.search(r'(cgpa|gpa)[:\s-]*([0-9]+(?:\.[0-9]+)?\s*/\s*[0-9]+|[0-9]+(?:\.[0-9]+)?)', line, re.IGNORECASE)
                gpa = gpa_match.group(0) if gpa_match else ""

                current_edu = Education(
                    degree=line,
                    institution="",
                    year=year,
                    gpa=gpa
                )
                
                # Try to get institution from next line
                if i + 1 < len(lines) and not lines[i + 1].startswith(('•', '-', '*')) and 'cgpa' not in lines[i + 1].lower() and 'gpa' not in lines[i + 1].lower():
                    i += 1
                    current_edu.institution = re.sub(r'\s+', ' ', lines[i]).strip()
            
            # Check if line contains CGPA/GPA
            elif current_edu and ('cgpa' in line.lower() or 'gpa' in line.lower() or re.search(r'\d+\.\d+\s*/\s*\d+', line)):
                current_edu.gpa = line

            elif current_edu and not current_edu.institution and len(line) < 140 and not is_section_heading(line):
                current_edu.institution = line
            
            i += 1
        
        if current_edu:
            education.append(current_edu)
    
    return education

def extract_projects(text: str) -> List[Project]:
    """Extract projects - only titles"""
    projects = []
    
    # Blacklist of words/phrases to skip
    BLACKLIST_STARTS = [
        'built', 'developed', 'implemented', 'integrated', 'designed', 
        'created', 'worked', 'used', 'added', 'deployed', 'configured',
        'established', 'maintained', 'improved', 'enhanced', 'optimized'
    ]
    
    proj_section = re.search(
        r'(PROJECTS?|PERSONAL PROJECTS)(.*?)(EXPERIENCE|EDUCATION|SKILLS|CERTIFICATIONS?|$)',
        text,
        re.IGNORECASE | re.DOTALL
    )
    
    if proj_section:
        proj_text = proj_section.group(2)
        lines = proj_text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            
            # Skip empty lines and bullet points
            if not line or line.startswith(('•', '-', '*', '·')):
                continue
            
            # Skip lines starting with blacklisted action words
            if any(line.lower().startswith(word) for word in BLACKLIST_STARTS):
                continue
            
            # Skip lines that are just URLs
            if line.startswith(('http://', 'https://', 'www.')):
                continue
            
            # Only capture lines that look like project titles (reasonable length)
            if 10 < len(line) < 200:
                # Remove link-related suffixes from the title
                line = re.sub(r'\s*[-:·]\s*(Link|GitHub\s*link|Github\s*link|Git\s*link).*$', '', line, flags=re.IGNORECASE)
                line = line.strip()
                
                if line:  # Make sure we still have content after removal
                    projects.append(Project(
                        name=line,
                        description="",
                        technologies=[]
                    ))
    
    return projects

def parse_resume(file_path: str) -> ParsedResume:
    """Main resume parsing function"""
    # Extract text based on file type
    if file_path.endswith('.pdf'):
        text = extract_text_from_pdf(file_path)
    elif file_path.endswith('.docx'):
        text = extract_text_from_docx(file_path)
    else:
        text = extract_text_from_txt(file_path)
    
    if not text or not text.strip():
        raise ValueError("Could not extract readable text from the uploaded file")
    
    # Debug: Print extracted text sections
    print("=" * 50)
    print("EXTRACTED TEXT:")
    print(text[:500])  # Print first 500 chars
    print("=" * 50)
    
    # Use deterministic regex extraction only so the UI shows data present in the resume.
    print("Using regex-based parsing...")
    experiences = extract_experiences(text)
    education = extract_education(text)
    projects = extract_projects(text)
    
    print(f"Extracted {len(experiences)} experiences")
    print(f"Extracted {len(education)} education entries")
    print(f"Extracted {len(projects)} projects")
    
    return ParsedResume(
        email=extract_email(text),
        phone=extract_phone(text),
        skills=extract_skills(text),
        experiences=experiences,
        education=education,
        projects=projects,
        raw_text=text
    )


def get_sample_resume() -> ParsedResume:
    """Return sample resume for demo"""
    return ParsedResume(
        name="Priya Sharma",
        email="priya.sharma@email.com",
        phone="+91-9876543210",
        skills=[
            Skill(name="Python", level="Advanced", years=3.0),
            Skill(name="React", level="Intermediate", years=2.0),
            Skill(name="Node.js", level="Intermediate", years=2.0),
            Skill(name="MongoDB", level="Intermediate", years=1.5),
            Skill(name="AWS", level="Beginner", years=1.0),
            Skill(name="Git", level="Advanced", years=3.0),
        ],
        experiences=[
            Experience(
                title="Software Developer",
                company="Tech Solutions Pvt Ltd",
                duration="Jan 2022 - Present",
                description=[
                    "Developed REST APIs using Python Flask serving 10K+ daily requests",
                    "Built responsive web applications using React and TypeScript",
                    "Collaborated with cross-functional teams in Agile environment"
                ],
                skills_used=["Python", "React", "MongoDB", "AWS"]
            ),
            Experience(
                title="Junior Developer Intern",
                company="StartupXYZ",
                duration="Jun 2021 - Dec 2021",
                description=[
                    "Worked on frontend development using React",
                    "Implemented user authentication and authorization",
                    "Fixed bugs and improved application performance"
                ],
                skills_used=["React", "JavaScript", "Node.js"]
            )
        ],
        education=[
            Education(
                degree="B.Tech in Computer Science",
                institution="ABC Institute of Technology",
                year="2021",
                gpa="8.5/10"
            )
        ],
        projects=[
            Project(
                name="E-Commerce Platform",
                description="Full-stack e-commerce application with payment integration",
                technologies=["React", "Node.js", "MongoDB", "Stripe"],
                link="github.com/priya/ecommerce"
            ),
            Project(
                name="Task Management App",
                description="Real-time collaborative task manager with WebSocket",
                technologies=["React", "Socket.io", "Express", "PostgreSQL"]
            )
        ],
        summary="Passionate software developer with 2+ years of experience in full-stack development",
        raw_text="Sample resume text..."
    )
