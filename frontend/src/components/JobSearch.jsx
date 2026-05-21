import { useState } from 'react'
import { searchJobs } from '../utils/api'
import { isSupabaseReady, supabase } from '../lib/supabaseClient'

const Card = ({ children, style = {}, isDarkMode = false }) => (
  <div style={{
    background: isDarkMode ? '#1f2d41' : 'var(--white)',
    border: isDarkMode ? '1px solid rgba(122,147,193,0.35)' : '1px solid var(--gray-150)',
    borderRadius: "var(--radius-lg)",
    boxShadow: isDarkMode ? '0 14px 36px rgba(0,0,0,0.22)' : 'var(--shadow-md)',
    padding: 24,
    ...style,
  }}>
    {children}
  </div>
);

const Btn = ({ children, variant = "primary", onClick, style = {}, disabled, isDarkMode = false }) => {
  const [hovered, setHovered] = useState(false);
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 8, padding: "10px 22px", borderRadius: 99,
    fontSize: 13.5, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s ease", border: "none", fontFamily: "inherit",
    letterSpacing: "-0.01em", opacity: disabled ? 0.5 : 1,
  };
  const variants = {
    primary: {
      background: isDarkMode ? (hovered && !disabled ? '#8fb0e3' : '#7f9ed1') : (hovered && !disabled ? "var(--gray-900)" : "var(--black)"),
      color: isDarkMode ? '#0f1a29' : 'var(--white)',
      boxShadow: hovered && !disabled ? "0 6px 20px rgba(0,0,0,0.22)" : "0 2px 8px rgba(0,0,0,0.12)",
      transform: hovered && !disabled ? "translateY(-1px)" : "none",
    },
    secondary: {
      background: isDarkMode ? (hovered && !disabled ? 'rgba(143,176,227,0.18)' : 'rgba(143,176,227,0.1)') : (hovered && !disabled ? 'var(--gray-100)' : 'var(--white)'),
      color: isDarkMode ? '#e3ecfa' : 'var(--gray-800)',
      boxShadow: isDarkMode ? 'none' : 'var(--shadow-sm)',
      border: isDarkMode ? '1px solid rgba(143,176,227,0.35)' : '1px solid var(--gray-200)',
      transform: hovered && !disabled ? 'translateY(-1px)' : 'none',
    },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
};

export default function JobSearch({ resumeId, resumeData, isDarkMode = false }) {
  const [jobs, setJobs] = useState(null)
  const [role, setRole] = useState('Software Developer')
  const [loading, setLoading] = useState(false)

  const handleSearch = async () => {
    setLoading(true)
    try {
      const result = await searchJobs(resumeId, role, 'India')
      const recommendedJobs = Array.isArray(result.jobs) ? result.jobs : []
      setJobs(recommendedJobs)

      if (isSupabaseReady && supabase && recommendedJobs.length > 0) {
        const rows = recommendedJobs.map((job) => ({
          user_id: resumeId,
          title: job.title || 'Recommended job',
          company: job.company || '',
          location: job.location || '',
          raw_text: job.description || '',
          parsed_data: {
            source: 'job_recommendation',
            job_id: job.id || null,
            role,
            location: 'India',
            match_percentage: job.match_percentage || 0,
            salary: job.salary || null,
            description: job.description || '',
            required_skills: Array.isArray(job.required_skills) ? job.required_skills : [],
            apply_link: job.apply_link || '',
            posted_date: job.posted_date || '',
            job_source: job.source || '',
          },
        }))

        const { error: saveError } = await supabase.from('job_descriptions').insert(rows)
        if (saveError) {
          console.warn('Failed to persist job recommendations:', saveError)
        }
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 28, animation: "fadeIn 0.4s ease" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: isDarkMode ? '#edf3ff' : 'var(--gray-900)', letterSpacing: "-0.04em", marginBottom: 4 }}>Job Finder</h2>
        <p style={{ fontSize: 13.5, color: isDarkMode ? '#b4c3d9' : 'var(--gray-500)' }}>Curated job matches scored against your profile.</p>
      </div>

      <Card style={{ marginBottom: 24 }} isDarkMode={isDarkMode}>
        <div style={{ display: 'flex', gap: '12px', alignItems: "center" }}>
          <input
            placeholder="Target role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{
              flex: 1, padding: "12px 14px", background: "#24354c",
              border: "1px solid rgba(122,147,193,0.35)", borderRadius: 10,
              fontSize: 13.5, color: '#e5eefc', outline: "none",
              fontFamily: "inherit",
            }}
          />
          <Btn onClick={handleSearch} disabled={loading} isDarkMode={isDarkMode}>
            Search Jobs
          </Btn>
        </div>
      </Card>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div style={{ width: 40, height: 40, border: "3px solid var(--gray-150)", borderTopColor: "var(--gray-700)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
        </div>
      )}

      {jobs && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
          {jobs.map((job, idx) => (
            <Card key={idx} style={{ transition: "all var(--transition)" }} isDarkMode={isDarkMode}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "var(--shadow-lg)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, alignItems: "flex-start" }}>
                <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 650, color: '#edf3ff', letterSpacing: "-0.02em" }}>{job.title}</h3>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 99, fontSize: 13, fontWeight: 600,
                  background: job.match_percentage >= 70 ? "#f0fdf4" : job.match_percentage >= 50 ? "#fffbeb" : "#fef2f2",
                  color: job.match_percentage >= 70 ? "#166534" : job.match_percentage >= 50 ? "#92400e" : "#991b1b",
                  border: `1px solid ${job.match_percentage >= 70 ? "#bbf7d0" : job.match_percentage >= 50 ? "#fde68a" : "#fca5a5"}`,
                }}>
                  {Math.round(job.match_percentage)}% Match
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#b4c3d9', marginBottom: 8 }}>
                🏢 {job.company} | 📍 {job.location}
              </div>
              {job.salary && (
                <div style={{ fontSize: 13, color: "#166534", marginBottom: 8, fontWeight: 500 }}>
                  💰 {job.salary}
                </div>
              )}
              <p style={{ fontSize: 13, color: '#c7d7ef', marginBottom: 12, lineHeight: 1.65 }}>
                {job.description.substring(0, 150)}...
              </p>
              <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {job.required_skills.slice(0, 5).map((skill, sidx) => (
                  <span key={sidx} style={{
                    padding: "4px 10px", borderRadius: 99,
                    background: "rgba(143,176,227,0.12)", fontSize: 11,
                    color: "#dbe8fb", fontWeight: 500,
                    border: "1px solid rgba(122,147,193,0.35)",
                  }}>{skill}</span>
                ))}
              </div>
              <a href={job.apply_link} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  padding: "8px 18px", borderRadius: 99, fontSize: 13, fontWeight: 600,
                  background: "#8fb0e3", color: "#0f1a29",
                  textDecoration: "none", transition: "all 0.2s ease",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#9bc0f0"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#8fb0e3"; e.currentTarget.style.transform = "none"; }}>
                Apply Now
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
