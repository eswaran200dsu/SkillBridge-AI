import httpx
import json
from typing import List, Dict, Any
from app.core.config import settings
from app.models.schemas import ParsedResume, Skill, Experience, Education, Project

async def parse_resume_with_ai(resume_text: str) -> ParsedResume:
    """Use AI to parse resume and extract structured data"""
    
    prompt = f"""Extract structured information from this resume.

Rules:
- Return ONLY valid JSON with this exact structure.
- Include only information explicitly present in the resume text.
- Do not infer, guess, normalize, or fabricate education, experience, dates, employers, degrees, or GPA.
- If a field is not present, return an empty string, null, or an empty array as appropriate.

{{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "+1234567890",
  "skills": ["Python", "React", "AWS"],
  "experiences": [
    {{
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Jan 2022 - Present",
      "description": ["Achievement 1", "Achievement 2"]
    }}
  ],
  "education": [
    {{
      "degree": "B.Tech in Computer Science",
      "institution": "University Name",
      "year": "2021",
      "gpa": "8.5/10"
    }}
  ],
  "projects": [
    {{
      "name": "Project Name",
      "description": "Brief description",
      "technologies": ["Tech1", "Tech2"]
    }}
  ]
}}

Resume text:
{resume_text[:3000]}

Return ONLY the JSON, no other text."""

    try:
        print("=" * 60)
        print("AI PARSER - Starting")
        print(f"API Endpoint: {settings.ATS_CHAT_ENDPOINT}")
        print(f"API Key (first 10 chars): {settings.ATS_API_KEY[:10]}...")
        print(f"Model: {settings.ATS_MODEL}")
        print(f"Resume text length: {len(resume_text)} chars")
        print("=" * 60)
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                settings.ATS_CHAT_ENDPOINT,
                headers={
                    "Authorization": f"Bearer {settings.ATS_API_KEY}",
                    "x-api-key": settings.ATS_API_KEY,
                    "Content-Type": "application/json"
                },
                json={
                    "model": settings.ATS_MODEL,
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "max_tokens": 2000,
                    "temperature": 0.1
                }
            )
            
            print(f"✓ API Response Status: {response.status_code}")
            
            if response.status_code != 200:
                print(f"✗ API Error: {response.text}")
                return None
            
            result = response.json()
            print(f"✓ Got API response, keys: {list(result.keys())}")
            
            # Extract the JSON from Anthropic API response
            # Anthropic returns: {"content": [{"type": "text", "text": "..."}], ...}
            content = ""
            if "content" in result and isinstance(result["content"], list):
                for block in result["content"]:
                    if block.get("type") == "text":
                        content = block.get("text", "")
                        break
            
            if not content:
                print(f"✗ No content found in response: {result}")
                return None
                
            print(f"✓ Extracted content length: {len(content)} chars")
            print(f"Content preview: {content[:200]}...")
            
            # Try to parse JSON from response
            # Remove markdown code blocks if present
            content = content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
            
            data = json.loads(content)
            print(f"✓ Parsed JSON successfully!")
            print(f"  - Name: {data.get('name')}")
            print(f"  - Email: {data.get('email')}")
            print(f"  - Skills: {len(data.get('skills', []))} found")
            print(f"  - Experiences: {len(data.get('experiences', []))} found")
            print(f"  - Education: {len(data.get('education', []))} found")
            print(f"  - Projects: {len(data.get('projects', []))} found")
            
            # Convert to ParsedResume object
            parsed = ParsedResume(
                name=data.get("name"),
                email=data.get("email"),
                phone=data.get("phone"),
                skills=[Skill(name=s) for s in data.get("skills", [])],
                experiences=[
                    Experience(
                        title=exp.get("title", ""),
                        company=exp.get("company", ""),
                        duration=exp.get("duration", ""),
                        description=exp.get("description", [])
                    )
                    for exp in data.get("experiences", [])
                ],
                education=[
                    Education(
                        degree=edu.get("degree", ""),
                        institution=edu.get("institution", ""),
                        year=edu.get("year", ""),
                        gpa=edu.get("gpa", "")
                    )
                    for edu in data.get("education", [])
                ],
                projects=[
                    Project(
                        name=proj.get("name", ""),
                        description=proj.get("description", ""),
                        technologies=proj.get("technologies", [])
                    )
                    for proj in data.get("projects", [])
                ],
                raw_text=resume_text
            )
            
            print(f"✓ Created ParsedResume object successfully!")
            print("=" * 60)
            return parsed
            
    except json.JSONDecodeError as e:
        print(f"✗ JSON parsing error: {e}")
        print(f"Content that failed: {content[:500]}")
        print("=" * 60)
        return None
    except Exception as e:
        print(f"✗ Error in AI parser: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        print("=" * 60)
        return None
