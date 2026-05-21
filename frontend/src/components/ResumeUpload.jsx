import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { uploadResume, getSampleResume } from '../utils/api'

const Icon = ({ name, size = 18, color = "currentColor" }) => {
  const icons = {
    upload: <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

const Btn = ({ children, variant = "primary", onClick, style = {}, disabled }) => {
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
    secondary: {
      background: hovered && !disabled ? "var(--gray-100)" : "var(--white)",
      color: "var(--gray-800)",
      boxShadow: "var(--shadow-sm)",
      border: "1px solid var(--gray-200)",
      transform: hovered && !disabled ? "translateY(-1px)" : "none",
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

export default function ResumeUpload({ onResumeUploaded }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)

  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return

    setLoading(true)
    setError(null)

    try {
      const file = acceptedFiles[0]
      const result = await uploadResume(file)
      onResumeUploaded(result.resume_id, result.resume)
    } catch (err) {
      setError(err.message || 'Failed to upload resume')
    } finally {
      setLoading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  })

  const handleUseSample = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await getSampleResume()
      onResumeUploaded(result.resume_id, result.resume)
    } catch (err) {
      setError(err.message || 'Failed to load sample resume')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 22, animation: "fadeIn 0.4s ease" }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-0.04em", marginBottom: 4 }}>Resume Upload</h2>
        <p style={{ fontSize: 13.5, color: "var(--gray-500)" }}>Upload your resume for AI-powered analysis and career guidance.</p>
      </div>

      <div
        {...getRootProps()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); }}
        style={{
          border: `2px dashed ${dragging || isDragActive ? "var(--gray-600)" : "var(--gray-200)"}`,
          borderRadius: "var(--radius-lg)", padding: "48px 32px",
          textAlign: "center", cursor: "pointer",
          background: dragging || isDragActive ? "var(--gray-50)" : "transparent",
          transition: "all var(--transition)",
        }}>
        <input {...getInputProps()} />
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Icon name="upload" size={22} color="var(--gray-500)"/>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--gray-800)", marginBottom: 6 }}>
          {isDragActive ? "Drop your resume here" : "Drop your resume here"}
        </div>
        <div style={{ fontSize: 13, color: "var(--gray-400)" }}>PDF supported · Max 5MB</div>
        <Btn variant="secondary" style={{ marginTop: 20, padding: "8px 20px", fontSize: 13 }}>Browse files</Btn>
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div style={{ width: 40, height: 40, border: "3px solid var(--gray-150)", borderTopColor: "var(--gray-700)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
        </div>
      )}

      {error && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, color: "#991b1b", fontSize: 13, textAlign: "center" }}>
          {error}
        </div>
      )}

      <div style={{ textAlign: "center" }}>
        <Btn variant="secondary" onClick={handleUseSample} disabled={loading} style={{ padding: "10px 24px" }}>
          Use Sample Resume
        </Btn>
      </div>
    </div>
  )
}
