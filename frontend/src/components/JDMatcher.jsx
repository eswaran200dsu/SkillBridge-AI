import { useState } from 'react'
import { matchJD } from '../utils/api'

const CircularProgress = ({ value, size = 120, label }) => {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gray-100)" strokeWidth="8"/>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--gray-800)" strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}/>
      </svg>
      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div style={{ fontSize: size * 0.22, fontWeight: 700, color: "var(--gray-900)", lineHeight: 1 }}>{value}</div>
        {label && <div style={{ fontSize: 10, color: "var(--gray-400)", marginTop: 2, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</div>}
      </div>
    </div>
  );
};

const Card = ({ children, style = {}, hover = false }) => (
  <div style={{
    background: "var(--white)",
    border: "1px solid var(--gray-150)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-md)",
    padding: 24,
    ...style,
  }}>
    {children}
  </div>
);

const Badge = ({ children, variant = "default" }) => {
  const styles = {
    default: { bg: "var(--gray-100)", color: "var(--gray-600)", border: "var(--gray-200)" },
    success: { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
    warning: { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
    error: { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5" },
  };
  const s = styles[variant];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 10px", borderRadius: 99,
      fontSize: 11, fontWeight: 500, letterSpacing: "0.02em",
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
    }}>
      {children}
    </span>
  );
};

const Btn = ({ children, variant = "primary", onClick, style = {}, icon }) => {
  const [hovered, setHovered] = useState(false);
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 8, padding: "10px 22px", borderRadius: 99,
    fontSize: 13.5, fontWeight: 600, cursor: "pointer",
    transition: "all 0.2s ease", border: "none", fontFamily: "inherit",
    letterSpacing: "-0.01em",
  };
  const variants = {
    primary: {
      background: hovered ? "var(--gray-900)" : "var(--black)",
      color: "var(--white)",
      boxShadow: hovered ? "0 6px 20px rgba(0,0,0,0.22)" : "0 2px 8px rgba(0,0,0,0.12)",
      transform: hovered ? "translateY(-1px)" : "none",
    },
  };
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ ...base, ...variants[variant], ...style }}>
      {icon && <span style={{ display: "flex" }}>{icon}</span>}
      {children}
    </button>
  );
};

const Icon = ({ name, size = 18, color = "currentColor" }) => {
  const icons = {
    search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
    match: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || icons.match}
    </svg>
  );
};

const ProgressBar = ({ value, label, sublabel }) => (
  <div>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, alignItems: "baseline" }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--gray-700)" }}>{label}</span>
      {sublabel && <span style={{ fontSize: 12, color: "var(--gray-400)", fontWeight: 500 }}>{sublabel}</span>}
    </div>
    <div style={{ height: 6, background: "var(--gray-100)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{
        height: "100%", borderRadius: 99,
        background: "linear-gradient(90deg, var(--gray-700), var(--gray-400))",
        width: `${value}%`,
        transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
      }}/>
    </div>
  </div>
);

export default function JDMatcher({ resumeId, jobDescription, setJobDescription }) {
  const [matchResult, setMatchResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)

  const handleMatch = async () => {
    if (!jobDescription.trim()) {
      alert('Please enter a job description')
      return
    }

    setLoading(true)
    setLoadingProgress(0)

    // Start progress animation
    let progress = 0
    const progressInterval = setInterval(() => {
      progress += Math.random() * 15 + 5 // Random increment between 5-20
      if (progress >= 95) {
        progress = 95
        clearInterval(progressInterval)
      }
      setLoadingProgress(Math.floor(progress))
    }, 300)

    try {
      const result = await matchJD(resumeId, jobDescription)
      
      // Complete progress
      clearInterval(progressInterval)
      setLoadingProgress(100)
      
      // Small delay to show 100% before showing results
      setTimeout(() => {
        setMatchResult(result)
        setLoading(false)
        setLoadingProgress(0)
      }, 600)
    } catch (err) {
      clearInterval(progressInterval)
      setLoading(false)
      setLoadingProgress(0)
      alert(err.message)
    }
  }

  const analyzed = matchResult !== null

  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 22, animation: "fadeIn 0.4s ease" }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.04em", marginBottom: 4 }}>JD Matcher</h2>
        <p style={{ fontSize: 13.5, color: "var(--gray-500)" }}>Paste a job description to discover your match percentage and skill gaps.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-700)", marginBottom: 10 }}>Paste Job Description</div>
            <textarea
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here..."
              style={{
                width: "100%", height: 200, border: "1px solid var(--gray-200)",
                borderRadius: 10, padding: "12px 14px", fontSize: 13,
                color: "var(--gray-700)", background: "var(--gray-50)",
                outline: "none", resize: "none", fontFamily: "inherit",
                lineHeight: 1.65,
              }}
            />
            <Btn onClick={handleMatch} style={{ marginTop: 12, width: "100%", justifyContent: "center" }} icon={<Icon name="search" size={14}/>}>
              Analyze match
            </Btn>
          </Card>

          {matchResult && matchResult.focus_areas && matchResult.focus_areas.length > 0 && (
            <Card style={{ padding: 20, background: "#ffffff" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 14 }}>Focus Areas</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {matchResult.focus_areas.slice(0, 3).map((area, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", borderRadius: 10,
                    background: "#111827", color: "#ffffff",
                    fontSize: 13, fontWeight: 500,
                  }}>
                    <Icon name="target" size={14} color="rgba(255,255,255,0.6)"/>
                    {area.skill}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {loading ? (
          <Card style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, padding: 40, minHeight: 300 }} hover={false}>
            <div style={{ position: "relative", width: 140, height: 140 }}>
              {/* Outer spinning circle */}
              <div style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: "3px solid var(--gray-100)",
                borderTopColor: "var(--gray-800)",
                animation: "rotate 1s linear infinite",
              }} />
              
              {/* Progress percentage */}
              <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 4,
              }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: "var(--gray-900)", lineHeight: 1 }}>
                  {loadingProgress}%
                </div>
                <div style={{ fontSize: 11, color: "var(--gray-400)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Analyzing
                </div>
              </div>
            </div>
            
            <div style={{ textAlign: "center", maxWidth: 280 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6 }}>
                Analyzing JD Match
              </div>
              <div style={{ fontSize: 13, color: "var(--gray-500)", lineHeight: 1.6 }}>
                SkillBridge is mapping your resume against JD requirements...
              </div>
            </div>
            
            {/* Progress bar */}
            <div style={{ width: "100%", maxWidth: 240 }}>
              <div style={{ height: 4, background: "var(--gray-100)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${loadingProgress}%`,
                  background: "linear-gradient(90deg, var(--gray-800), var(--gray-600))",
                  borderRadius: 99,
                  transition: "width 0.3s ease-out",
                }} />
              </div>
            </div>
          </Card>
        ) : matchResult ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card style={{ padding: "24px 22px", textAlign: "center", background: "#ffffff" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Overall Match</div>
              <CircularProgress value={Math.round(matchResult.match_percentage)} size={130} label="Match"/>
              <div style={{ marginTop: 18, fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
                You match <strong style={{ color: "#111827", fontWeight: 700 }}>{Math.round(matchResult.match_percentage)}%</strong> of this job's requirements.
              </div>
            </Card>

            <Card style={{ padding: 20, background: "#ffffff" }}>
              <div style={{ fontSize: 13, fontWeight: 650, color: "#111827", marginBottom: 14 }}>Missing Skills</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                {matchResult.missing_skills && matchResult.missing_skills.length > 0 ? (
                  matchResult.missing_skills.slice(0, 6).map((skill, idx) => (
                    <span key={idx} style={{
                      padding: "5px 12px", borderRadius: 99,
                      background: "#f3f4f6", fontSize: 12,
                      color: "#4b5563", fontWeight: 500,
                      border: "1px solid #e5e7eb",
                    }}>{skill}</span>
                  ))
                ) : (
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>No missing skills identified</span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <ProgressBar value={92} label="Technical skills" sublabel="92%"/>
                <ProgressBar value={68} label="DevOps & infrastructure" sublabel="68%"/>
                <ProgressBar value={80} label="Soft skills match" sublabel="80%"/>
              </div>
            </Card>
          </div>
        ) : (
          <Card style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 40, minHeight: 300 }} hover={false}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="match" size={24} color="var(--gray-400)"/>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gray-700)", marginBottom: 6 }}>Awaiting analysis</div>
              <div style={{ fontSize: 13, color: "var(--gray-400)" }}>Paste a JD and click Analyze to see your match</div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
