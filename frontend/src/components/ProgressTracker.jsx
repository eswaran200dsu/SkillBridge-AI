import { useState, useEffect } from 'react'
import { trackProgress } from '../utils/api'

const Card = ({ children, style = {} }) => (
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

export default function ProgressTracker({ resumeId }) {
  const [progress, setProgress] = useState(null)
  const [decision, setDecision] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchProgress()
  }, [resumeId])

  const fetchProgress = async () => {
    setLoading(true)
    try {
      const result = await trackProgress(resumeId, null, null)
      setProgress(result.progress)
      setDecision(result.ai_decision)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ width: 40, height: 40, border: "3px solid var(--gray-150)", borderTopColor: "var(--gray-700)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
    </div>
  )

  return (
    <div style={{ padding: 28, animation: "fadeIn 0.4s ease" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.04em", marginBottom: 4 }}>Progress Intelligence</h2>
        <p style={{ fontSize: 13.5, color: "var(--gray-500)" }}>AI-powered insights on your learning journey.</p>
      </div>

      {decision && (
        <Card style={{ marginBottom: 18 }}>
          <div style={{ padding: "20px", background: "var(--gray-50)", borderRadius: 12, border: "1px solid var(--gray-150)" }}>
            <h3 style={{ fontSize: 15.5, fontWeight: 650, color: "var(--gray-900)", marginBottom: 12, letterSpacing: "-0.02em" }}>🤖 AI Decision</h3>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--gray-900)" }}>
              {decision.decision === 'ready_for_interviews' && '🎉 You are ready for interviews!'}
              {decision.decision === 'move_ahead' && '✅ Keep moving forward'}
              {decision.decision === 'revise' && '📚 Time to revise'}
            </div>
            <p style={{ fontSize: 13, color: "var(--gray-600)", marginBottom: 12, lineHeight: 1.65 }}>{decision.reason}</p>
            <div style={{ padding: "12px 14px", background: "var(--white)", borderRadius: 10, border: "1px solid var(--gray-200)" }}>
              <strong style={{ fontSize: 13, color: "var(--gray-900)" }}>Next Action:</strong>
              <span style={{ fontSize: 13, color: "var(--gray-600)", marginLeft: 6 }}>{decision.next_action}</span>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--gray-400)" }}>
              Confidence: {Math.round(decision.confidence * 100)}%
            </div>
          </div>
        </Card>
      )}

      {progress && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18, marginBottom: 18 }}>
            <Card>
              <h4 style={{ fontSize: 13.5, fontWeight: 650, color: "var(--gray-900)", marginBottom: 12 }}>📝 Quiz Performance</h4>
              {progress.quiz_scores.length > 0 ? (
                <>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.04em" }}>
                    {Math.round(progress.quiz_scores.reduce((a, b) => a + b, 0) / progress.quiz_scores.length)}%
                  </div>
                  <div style={{ fontSize: 13, color: "var(--gray-500)", marginTop: 4 }}>
                    Average from {progress.quiz_scores.length} quizzes
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 13, color: "var(--gray-400)" }}>No quiz data yet</p>
              )}
            </Card>

            <Card>
              <h4 style={{ fontSize: 13.5, fontWeight: 650, color: "var(--gray-900)", marginBottom: 12 }}>🎤 Interview Performance</h4>
              {progress.interview_scores.length > 0 ? (
                <>
                  <div style={{ fontSize: 32, fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.04em" }}>
                    {(progress.interview_scores.reduce((a, b) => a + b, 0) / progress.interview_scores.length).toFixed(1)}/10
                  </div>
                  <div style={{ fontSize: 13, color: "var(--gray-500)", marginTop: 4 }}>
                    Average from {progress.interview_scores.length} interviews
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 13, color: "var(--gray-400)" }}>No interview data yet</p>
              )}
            </Card>
          </div>

          <Card>
            <h4 style={{ fontSize: 13.5, fontWeight: 650, color: "var(--gray-900)", marginBottom: 14 }}>📈 Tasks Completed</h4>
            <ProgressBar 
              value={progress ? (progress.completed_tasks / progress.total_tasks) * 100 : 0}
              label={`${progress?.completed_tasks || 0} of ${progress?.total_tasks || 0} tasks`}
              sublabel={`${Math.round((progress?.completed_tasks || 0) / (progress?.total_tasks || 1) * 100)}%`}
            />
          </Card>
        </>
      )}
    </div>
  )
}
