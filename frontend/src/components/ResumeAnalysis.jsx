import { useState, useEffect } from 'react'
import { analyzeResume } from '../utils/api'

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

const Card = ({ children, style = {} }) => (
  <div style={{
    background: "var(--white)",
    border: "1px solid var(--gray-150)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-md)",
    padding: 24,
    marginBottom: 18,
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

const Btn = ({ children, variant = "primary", onClick, style = {} }) => {
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
      {children}
    </button>
  );
};

export default function ResumeAnalysis({ resumeId }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (resumeId) {
      fetchAnalysis()
    }
  }, [resumeId])

  const fetchAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeResume(resumeId)
      setAnalysis(result)
    } catch (err) {
      setError(err.message || 'Failed to analyze resume')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ width: 40, height: 40, border: "3px solid var(--gray-150)", borderTopColor: "var(--gray-700)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
    </div>
  )
  
  if (error) return (
    <Card>
      <p style={{color: '#991b1b'}}>{error}</p>
    </Card>
  )
  
  if (!analysis) return (
    <Card>
      <Btn onClick={fetchAnalysis}>Analyze Resume</Btn>
    </Card>
  )

  const { ats_analysis, problems, bullet_improvements, recruiter_view, overall_rating } = analysis

  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18, animation: "fadeIn 0.4s ease" }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.04em", marginBottom: 4 }}>Resume Analysis</h2>
        <p style={{ fontSize: 13.5, color: "var(--gray-500)" }}>AI-powered analysis with actionable improvements.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Card>
            <div style={{ fontSize: 13.5, fontWeight: 650, color: "var(--gray-900)", marginBottom: 18 }}>Analysis Scores</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--gray-700)" }}>Keyword Match</span>
                  <span style={{ fontSize: 12, color: "var(--gray-400)", fontWeight: 500 }}>{Math.round(ats_analysis.keyword_match * 100)}%</span>
                </div>
                <div style={{ height: 6, background: "var(--gray-100)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    background: "linear-gradient(90deg, var(--gray-700), var(--gray-400))",
                    width: `${ats_analysis.keyword_match * 100}%`,
                    transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
                  }}/>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--gray-700)" }}>Formatting</span>
                  <span style={{ fontSize: 12, color: "var(--gray-400)", fontWeight: 500 }}>{ats_analysis.formatting_score}%</span>
                </div>
                <div style={{ height: 6, background: "var(--gray-100)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    background: "linear-gradient(90deg, var(--gray-700), var(--gray-400))",
                    width: `${ats_analysis.formatting_score}%`,
                    transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
                  }}/>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--gray-700)" }}>Readability</span>
                  <span style={{ fontSize: 12, color: "var(--gray-400)", fontWeight: 500 }}>{ats_analysis.readability_score}%</span>
                </div>
                <div style={{ height: 6, background: "var(--gray-100)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    background: "linear-gradient(90deg, var(--gray-700), var(--gray-400))",
                    width: `${ats_analysis.readability_score}%`,
                    transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
                  }}/>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 13.5, fontWeight: 650, color: "var(--gray-900)", marginBottom: 14 }}>Issues Found</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {problems.slice(0, 5).map((problem, idx) => (
                <div key={idx} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "10px 14px", borderRadius: 10,
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", marginTop: 5, flexShrink: 0, background: "#f59e0b" }}/>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gray-900)", marginBottom: 4 }}>{problem.issue}</div>
                    <div style={{ fontSize: 12, color: "var(--gray-600)" }}>{problem.suggestion}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {bullet_improvements && bullet_improvements.length > 0 && (
            <Card>
              <div style={{ fontSize: 13.5, fontWeight: 650, color: "var(--gray-900)", marginBottom: 14 }}>Bullet Point Improvements</div>
              {bullet_improvements.map((improvement, idx) => (
                <div key={idx} style={{ marginBottom: 20, padding: "16px", background: "var(--gray-50)", borderRadius: 10, border: "1px solid var(--gray-150)" }}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--gray-400)", marginBottom: 4, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Before</div>
                    <div style={{ color: "#991b1b", fontSize: 13 }}>{improvement.original}</div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--gray-400)", marginBottom: 4, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>After</div>
                    <div style={{ color: "#166534", fontSize: 13, fontWeight: 500 }}>{improvement.improved}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--gray-500)" }}>
                    💡 {improvement.reason} (Impact: {improvement.impact_score}/10)
                  </div>
                </div>
              ))}
            </Card>
          )}

          <Card>
            <div style={{ fontSize: 13.5, fontWeight: 650, color: "var(--gray-900)", marginBottom: 14 }}>Recruiter View</div>
            <p style={{ fontSize: 13, color: "var(--gray-600)", lineHeight: 1.65 }}>{recruiter_view}</p>
          </Card>
        </div>

        <Card style={{ padding: "28px 24px", textAlign: "center", height: "fit-content" }}>
          <div style={{ fontSize: 12, color: "var(--gray-400)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>ATS Score</div>
          <CircularProgress value={ats_analysis.score} size={140} label="Score"/>
          <div style={{ marginTop: 20 }}>
            <Badge variant={ats_analysis.score >= 80 ? 'success' : ats_analysis.score >= 60 ? 'warning' : 'error'}>
              {overall_rating}
            </Badge>
          </div>
          <Btn style={{ marginTop: 24, width: "100%", justifyContent: "center", padding: "10px" }}>Download report</Btn>
        </Card>
      </div>
    </div>
  )
}
