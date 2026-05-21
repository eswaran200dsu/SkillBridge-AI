import { useState, useRef } from 'react'
import { startInterview, evaluateInterviewAnswer } from '../utils/api'

const Btn = ({ children, variant = "primary", onClick, style = {}, icon, disabled }) => {
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
      background: hovered && !disabled ? "var(--gray-900)" : "var(--black)",
      color: "var(--white)",
      boxShadow: hovered && !disabled ? "0 6px 20px rgba(0,0,0,0.22)" : "0 2px 8px rgba(0,0,0,0.12)",
      transform: hovered && !disabled ? "translateY(-1px)" : "none",
    },
    outline: {
      background: "transparent",
      color: "var(--gray-800)",
      border: "1.5px solid var(--gray-300)",
      boxShadow: "none",
      transform: hovered && !disabled ? "translateY(-1px)" : "none",
    },
  };
  return (
    <button onClick={onClick} disabled={disabled}
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
    mic: <><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></>,
    brain: <><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.84A2.5 2.5 0 0 1 9.5 2"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.84A2.5 2.5 0 0 0 14.5 2"/></>,
    send: <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

export default function Interview({ jobDescription, resumeId }) {
  const [session, setSession] = useState(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const chatRef = useRef(null)

  const handleStart = async (mode) => {
    if (!jobDescription) {
      alert('Please match a JD first from the JD Matcher section')
      return
    }

    if (!resumeId) {
      alert('Please upload your resume first so the interview can use your profile')
      return
    }

    setLoading(true)
    try {
      const result = await startInterview(jobDescription, mode, 5)
      setSession(result)
      setCurrentQ(0)
      setFeedback(null)
      setMessages([{ role: "ai", text: result.questions[0].question }])
    } catch (err) {
      alert(err.message || 'Failed to start interview. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return;
    const newMsgs = [
      ...messages,
      { role: "user", text: input },
      { role: "ai", text: "Great answer! You clearly articulated your background. Let me follow up with another question..." },
    ];
    setMessages(newMsgs);
    setInput("");
    setTimeout(() => chatRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 100);
  };

  return (
    <div style={{ padding: 28, animation: "fadeIn 0.4s ease", height: "calc(100vh - 60px)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.04em", marginBottom: 4 }}>Mock Interview</h2>
          <p style={{ fontSize: 13.5, color: "var(--gray-500)" }}>AI-powered interview simulation with real-time feedback.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {session && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.04em" }}>84</div>
              <div style={{ fontSize: 11, color: "var(--gray-400)", fontWeight: 500 }}>Interview score</div>
            </div>
          )}
          <div style={{ width: 1, background: "var(--gray-150)" }}/>
          <Btn variant="outline" style={{ padding: "8px 16px", fontSize: 13 }} icon={<Icon name="mic" size={14}/>}>Voice mode</Btn>
        </div>
      </div>

      {!session && (
        <div style={{ background: "var(--white)", border: "1px solid var(--gray-150)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-md)", padding: 32 }}>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--gray-900)", marginBottom: 8 }}>Select Interview Mode</h3>
            <p style={{ fontSize: 13.5, color: "var(--gray-500)", lineHeight: 1.6 }}>
              Questions are based on your resume, quiz history, and roadmap progress.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Btn onClick={() => handleStart('Technical')} disabled={loading}>
              {loading ? 'Starting...' : 'Start Technical Interview'}
            </Btn>
            <Btn variant="outline" onClick={() => handleStart('HR')} disabled={loading}>
              {loading ? 'Starting...' : 'Start HR Interview'}
            </Btn>
          </div>
        </div>
      )}

      {session && (
        <>
          <div ref={chatRef} style={{
            flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16,
            padding: "4px 0 20px",
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: "flex", gap: 12,
                flexDirection: msg.role === "user" ? "row-reverse" : "row",
                maxWidth: 640,
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              }}>
                {msg.role === "ai" && (
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--gray-900)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="brain" size={14} color="white"/>
                  </div>
                )}
                <div style={{
                  padding: "13px 16px", borderRadius: msg.role === "ai" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                  background: msg.role === "ai" ? "var(--white)" : "var(--gray-900)",
                  color: msg.role === "ai" ? "var(--gray-800)" : "var(--white)",
                  border: msg.role === "ai" ? "1px solid var(--gray-150)" : "none",
                  boxShadow: "var(--shadow-sm)",
                  fontSize: 13.5, lineHeight: 1.65, maxWidth: 500,
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            display: "flex", gap: 10, padding: "14px 0 0",
            borderTop: "1px solid var(--gray-150)", flexShrink: 0,
          }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "var(--gray-50)", border: "1px solid var(--gray-200)", borderRadius: 99, padding: "10px 18px" }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSend()}
                placeholder="Type your answer..."
                style={{ flex: 1, border: "none", background: "transparent", fontSize: 13.5, color: "var(--gray-700)", outline: "none", fontFamily: "inherit" }}
              />
            </div>
            <Btn onClick={handleSend} style={{ borderRadius: "50%", width: 44, height: 44, padding: 0 }} icon={<Icon name="send" size={16}/>}></Btn>
          </div>
        </>
      )}
    </div>
  )
}
