import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import Roadmap from "./components/Roadmap";
import { AuthPage } from "./components/AuthPage";
import { AdminDashboard } from "./components/AdminDashboard";
import { isSupabaseReady, supabase } from "./lib/supabaseClient";

// ─── Design tokens ───────────────────────────────────────────────────────────
const tokens = {
  font: "'Geist', 'DM Sans', system-ui, sans-serif",
  fontMono: "'Geist Mono', monospace",
};

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --white: #ffffff;
    --gray-50: #f9f9f9;
    --gray-100: #f3f3f3;
    --gray-150: #ebebeb;
    --gray-200: #e2e2e2;
    --gray-300: #c8c8c8;
    --gray-400: #a0a0a0;
    --gray-500: #737373;
    --gray-600: #525252;
    --gray-700: #3a3a3a;
    --gray-800: #262626;
    --gray-900: #171717;
    --black: #0a0a0a;
    --shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
    --shadow-sm: 0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 16px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04);
    --shadow-lg: 0 8px 32px rgba(0,0,0,0.09), 0 2px 8px rgba(0,0,0,0.04);
    --shadow-xl: 0 16px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06);
    --radius-sm: 10px;
    --radius-md: 14px;
    --radius-lg: 20px;
    --radius-xl: 28px;
    --radius-full: 9999px;
    --transition: 0.22s cubic-bezier(0.4, 0, 0.2, 1);
    --transition-slow: 0.45s cubic-bezier(0.4, 0, 0.2, 1);
  }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'DM Sans', system-ui, sans-serif;
    background: var(--white);
    color: var(--gray-800);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--gray-200); border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--gray-300); }

  /* Fade-in animation */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes spin {
    to { stroke-dashoffset: 0; }
  }
  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-8px); }
  }
  @keyframes floatParticle1 {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(30px, -40px); }
    50% { transform: translate(-20px, -80px); }
    75% { transform: translate(40px, -60px); }
  }
  @keyframes floatParticle2 {
    0%, 100% { transform: translate(0, 0); }
    33% { transform: translate(-40px, -50px); }
    66% { transform: translate(30px, -90px); }
  }
  @keyframes floatParticle3 {
    0%, 100% { transform: translate(0, 0); }
    20% { transform: translate(50px, -30px); }
    40% { transform: translate(-30px, -70px); }
    60% { transform: translate(20px, -100px); }
    80% { transform: translate(-40px, -50px); }
  }
  @keyframes floatSlow {
    0%, 100% { transform: translateY(0px) translateX(0px); }
    50% { transform: translateY(-20px) translateX(10px); }
  }
  @keyframes orbitSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .fade-up { animation: fadeUp 0.6s ease forwards; }
  .fade-in { animation: fadeIn 0.5s ease forwards; }

  /* Card hover */
  .card-hover {
    transition: transform var(--transition), box-shadow var(--transition);
  }
  .card-hover:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06);
  }

  /* Glass */
  .glass {
    background: rgba(255,255,255,0.72);
    backdrop-filter: blur(20px) saturate(1.8);
    -webkit-backdrop-filter: blur(20px) saturate(1.8);
    border: 1px solid rgba(255,255,255,0.6);
  }

  /* Gradient mesh background */
  .mesh-bg {
    background:
      radial-gradient(ellipse 80% 50% at 20% -10%, rgba(200,200,200,0.13) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 80% 110%, rgba(180,180,180,0.1) 0%, transparent 60%),
      var(--white);
  }
`;

// ─── Shared micro-components ─────────────────────────────────────────────────

const Badge = ({ children, variant = "default", style = {} }) => {
  const styles = {
    default: { bg: "var(--gray-100)", color: "var(--gray-600)", border: "var(--gray-200)" },
    success: { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
    warning: { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
    error: { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
    neutral: { bg: "var(--gray-800)", color: "var(--white)", border: "var(--gray-800)" },
  };
  const s = styles[variant] ?? styles.default;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 10px", borderRadius: 99,
      fontSize: 11, fontWeight: 500, letterSpacing: "0.02em",
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      ...style,
    }}>
      {children}
    </span>
  );
};

const Btn = ({ children, variant = "primary", onClick, style = {}, icon, accentColor, disabled = false }) => {
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
      background: hovered ? (accentColor || "var(--gray-900)") : (accentColor || "var(--black)"),
      color: "var(--white)",
      boxShadow: hovered
        ? (accentColor ? "0 8px 24px rgba(59,91,255,0.38)" : "0 6px 20px rgba(0,0,0,0.22)")
        : (accentColor ? "0 4px 16px rgba(59,91,255,0.24)" : "0 2px 8px rgba(0,0,0,0.12)"),
      transform: hovered ? "translateY(-1px)" : "none",
    },
    secondary: {
      background: hovered ? "var(--gray-100)" : "var(--white)",
      color: "var(--gray-800)",
      boxShadow: "var(--shadow-sm)",
      border: "1px solid var(--gray-200)",
      transform: hovered ? "translateY(-1px)" : "none",
    },
    ghost: {
      background: hovered ? "var(--gray-100)" : "transparent",
      color: "var(--gray-700)",
      boxShadow: "none",
    },
    outline: {
      background: "transparent",
      color: "var(--gray-800)",
      border: "1.5px solid var(--gray-300)",
      boxShadow: "none",
      transform: hovered ? "translateY(-1px)" : "none",
    },
  };
  return (
    <button onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...base,
        ...variants[variant],
        ...(disabled ? {
          opacity: 0.58,
          cursor: "not-allowed",
          transform: "none",
          boxShadow: "none",
        } : {}),
        ...style,
      }}>
      {icon && <span style={{ display: "flex" }}>{icon}</span>}
      {children}
    </button>
  );
};

const Card = ({ children, style = {}, hover = true, glass = false, isDarkMode = false }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`${hover ? "card-hover" : ""} ${glass ? "glass" : ""}`}
      onMouseEnter={() => hover && setIsHovered(true)}
      onMouseLeave={() => hover && setIsHovered(false)}
      style={{
        background: glass ? undefined : (isDarkMode ? "#253447" : "var(--white)"),
        border: isDarkMode ? "1px solid rgba(70,100,150,0.3)" : "1px solid var(--gray-150)",
        borderRadius: "var(--radius-lg)",
        boxShadow: isHovered && hover ? "0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)" : "var(--shadow-md)",
        padding: 24,
        transform: isHovered && hover ? "translateY(-8px)" : "translateY(0)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        ...style,
      }}>
      {children}
    </div>
  );
}

// ─── Icons (minimal inline SVGs) ────────────────────────────────────────────
const LogoMark = ({ size = 24, style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    role="img"
    aria-label="SkillBridge logo"
    style={style}
  >
    <rect x="0" y="0" width="24" height="24" rx="7" fill="#111111" />
    <circle cx="12" cy="12" r="2.2" fill="#ffffff" />
    <line x1="12" y1="3" x2="12" y2="6" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
    <line x1="12" y1="18" x2="12" y2="21" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
    <line x1="3" y1="12" x2="6" y2="12" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
    <line x1="18" y1="12" x2="21" y2="12" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
    <line x1="5.25" y1="5.25" x2="7.4" y2="7.4" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
    <line x1="16.6" y1="16.6" x2="18.75" y2="18.75" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
    <line x1="5.25" y1="18.75" x2="7.4" y2="16.6" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
    <line x1="16.6" y1="7.4" x2="18.75" y2="5.25" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const Icon = ({ name, size = 18, color = "currentColor" }) => {
  const icons = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    resume: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>,
    match: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    roadmap: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    quiz: <><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    interview: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    jobs: <><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    upload: <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    chevron: <><polyline points="9 18 15 12 9 6"/></>,
    star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
    zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
    layers: <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
    brain: <><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.84A2.5 2.5 0 0 1 9.5 2"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.84A2.5 2.5 0 0 0 14.5 2"/></>,
    trending: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
    award: <><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></>,
    play: <><polygon points="5 3 19 12 5 21 5 3"/></>,
    mic: <><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></>,
    send: <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></>,
    sun: <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>,
    moon: <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round">
      {icons[name] || icons.zap}
    </svg>
  );
};

// ─── Circular Progress ───────────────────────────────────────────────────────
const CircularProgress = ({ value, size = 120, label, isDarkMode }) => {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", position: "absolute" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={isDarkMode ? "rgba(91,127,196,0.2)" : "var(--gray-100)"} strokeWidth="8"/>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={isDarkMode ? "#6b93d6" : "var(--gray-800)"} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}/>
      </svg>
      <div style={{ textAlign: "center", zIndex: 1 }}>
        <div style={{ fontSize: size * 0.22, fontWeight: 700, color: isDarkMode ? "#e8eef7" : "var(--gray-900)", lineHeight: 1 }}>{value}</div>
        {label && <div style={{ fontSize: 10, color: isDarkMode ? "#8a9bb5" : "var(--gray-400)", marginTop: 2, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</div>}
      </div>
    </div>
  );
};

// ─── Progress Bar ────────────────────────────────────────────────────────────
const ProgressBar = ({ value, label, sublabel, isDarkMode }) => (
  <div>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, alignItems: "baseline" }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: isDarkMode ? "#e8eef7" : "var(--gray-700)" }}>{label}</span>
      {sublabel && <span style={{ fontSize: 12, color: isDarkMode ? "#8a9bb5" : "var(--gray-400)", fontWeight: 500 }}>{sublabel}</span>}
    </div>
    <div style={{ height: 6, background: isDarkMode ? "rgba(91,127,196,0.2)" : "var(--gray-100)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{
        height: "100%", borderRadius: 99,
        background: isDarkMode ? "linear-gradient(90deg, #6b93d6, #5b7fc4)" : "linear-gradient(90deg, var(--gray-700), var(--gray-400))",
        width: `${value}%`,
        transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
      }}/>
    </div>
  </div>
);

const ProjectExperiencePanel = ({ isDarkMode }) => {
  const panelRef = useRef(null);
  const [activeDeck, setActiveDeck] = useState(0);
  const [signalIndex, setSignalIndex] = useState(0);
  const [hoveredOrbit, setHoveredOrbit] = useState("");

  const tracks = [
    {
      title: "Deep-Scan Diagnostics",
      short: "Resume intelligence",
      detail: "Extract structure, strengths, and writing gaps from your uploaded resume.",
    },
    {
      title: "Alignment Engine",
      short: "JD mapping",
      detail: "Compare your profile against role requirements and prioritize what matters.",
    },
    {
      title: "Adaptive Growth Path",
      short: "Roadmap + practice",
      detail: "Follow a guided loop of learning, quiz checks, and interview prep.",
    },
    {
      title: "Career Launch Workspace",
      short: "Opportunity pipeline",
      detail: "Search and track opportunities using context from your evolving profile.",
    },
  ];

  const liveSignals = [
    "Parsing resume context",
    "Mapping role alignment",
    "Refreshing growth tasks",
    "Preparing interview cycle",
  ];

  const { scrollYProgress } = useScroll({
    target: panelRef,
    offset: ["start 86%", "end 18%"],
  });

  const pathLength = useTransform(scrollYProgress, [0, 1], [0, 1]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSignalIndex((prev) => (prev + 1) % liveSignals.length);
    }, 1700);
    return () => window.clearInterval(id);
  }, [liveSignals.length]);

  const rotateDeck = () => setActiveDeck((prev) => (prev + 1) % tracks.length);

  return (
    <motion.section
      ref={panelRef}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, ease: "easeOut" }}
      style={{ marginTop: 64, width: "100%", maxWidth: 1220, marginLeft: "auto", marginRight: "auto", textAlign: "left", display: "grid", gap: 18 }}
    >
      <div>
        <div style={{ fontSize: 12, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--gray-400)", fontWeight: 700 }}>Journey Map</div>
        <h2 style={{ marginTop: 8, marginBottom: 0, fontSize: "clamp(26px, 4vw, 40px)", lineHeight: 1.08, letterSpacing: "-0.04em", color: isDarkMode ? "#f3f6ff" : "var(--gray-900)" }}>
          A narrative interface for the SkillBridge career journey.
        </h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
        <div style={{ position: "relative", borderRadius: 26, border: isDarkMode ? "1px solid rgba(124,143,255,0.24)" : "1px solid var(--gray-150)", background: isDarkMode ? "rgba(18,26,42,0.62)" : "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(246,246,246,0.96))", padding: "18px 14px 20px", overflow: "hidden" }}>
          <svg viewBox="0 0 120 620" preserveAspectRatio="none" style={{ position: "absolute", left: 6, top: 6, bottom: 6, width: 110, height: "calc(100% - 12px)", pointerEvents: "none" }}>
            <path d="M62 20 C18 84, 102 170, 60 250 C18 325, 102 420, 62 600" fill="none" stroke={isDarkMode ? "rgba(124,143,255,0.25)" : "rgba(180,180,180,0.35)"} strokeWidth="3" strokeLinecap="round" />
            <motion.path
              d="M62 20 C18 84, 102 170, 60 250 C18 325, 102 420, 62 600"
              fill="none"
              stroke={isDarkMode ? "rgba(143,161,255,0.9)" : "rgba(20,20,20,0.9)"}
              strokeWidth="3.2"
              strokeLinecap="round"
              style={{ pathLength }}
            />
          </svg>

          <div style={{ position: "relative", display: "grid", gap: 14, paddingLeft: 84 }}>
            {tracks.map((track, index) => (
              <motion.div
                key={track.title}
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.45 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                style={{
                  borderRadius: 16,
                  border: isDarkMode ? "1px solid rgba(124,143,255,0.2)" : "1px solid var(--gray-150)",
                  background: isDarkMode ? "rgba(16,24,40,0.5)" : "rgba(255,255,255,0.8)",
                  padding: "12px 13px",
                  position: "relative",
                }}
              >
                <span style={{ position: "absolute", left: -42, top: 16, width: 10, height: 10, borderRadius: "50%", background: isDarkMode ? "#8ea0ff" : "var(--gray-900)", boxShadow: isDarkMode ? "0 0 0 4px rgba(18,26,42,0.95)" : "0 0 0 4px rgba(255,255,255,0.95)" }} />
                <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: "-0.02em", color: isDarkMode ? "#f3f6ff" : "var(--gray-900)" }}>{track.title}</div>
                <div style={{ marginTop: 4, fontSize: 12.5, color: isDarkMode ? "#bec9e8" : "var(--gray-500)", lineHeight: 1.55 }}>{track.detail}</div>
              </motion.div>
            ))}
          </div>
        </div>

        <div style={{ borderRadius: 26, border: isDarkMode ? "1px solid rgba(124,143,255,0.24)" : "1px solid var(--gray-150)", background: isDarkMode ? "rgba(18,26,42,0.62)" : "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(246,246,246,0.95))", padding: 16 }}>
          <div style={{ fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--gray-400)", fontWeight: 700, marginBottom: 8 }}>Glass Deck</div>
          <div style={{ position: "relative", height: 300, perspective: 1200 }}>
            {tracks.map((_, stackIndex) => {
              const track = tracks[(activeDeck + stackIndex) % tracks.length];
              return (
                <motion.button
                  key={`${track.title}-${stackIndex}`}
                  type="button"
                  onClick={() => stackIndex === 0 && rotateDeck()}
                  animate={{
                    y: stackIndex * 16,
                    x: stackIndex * 9,
                    scale: 1 - stackIndex * 0.045,
                    rotateZ: stackIndex * -1.7,
                    rotateY: stackIndex === 0 ? 0 : -8,
                    opacity: stackIndex === 0 ? 1 : 0.28 - stackIndex * 0.04,
                  }}
                  transition={{ duration: 0.48, ease: "easeOut" }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: tracks.length - stackIndex,
                    borderRadius: 22,
                    border: isDarkMode ? "1px solid rgba(143,161,255,0.4)" : "1px solid rgba(255,255,255,0.62)",
                    background: stackIndex === 0
                      ? (isDarkMode ? "linear-gradient(145deg, rgba(16,24,40,0.96), rgba(12,18,32,0.92))" : "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(244,244,244,0.92))")
                      : (isDarkMode ? "linear-gradient(145deg, rgba(16,24,40,0.76), rgba(12,18,32,0.64))" : "linear-gradient(145deg, rgba(255,255,255,0.76), rgba(242,242,242,0.64))"),
                    boxShadow: "0 18px 36px rgba(0,0,0,0.08)",
                    backdropFilter: "blur(18px)",
                    WebkitBackdropFilter: "blur(18px)",
                    padding: 18,
                    textAlign: "left",
                    cursor: stackIndex === 0 ? "pointer" : "default",
                    pointerEvents: stackIndex === 0 ? "auto" : "none",
                    overflow: "hidden",
                  }}
                >
                  {stackIndex === 0 ? (
                    <>
                      <div style={{ fontSize: 12, color: isDarkMode ? "#97a6d4" : "var(--gray-500)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{track.short}</div>
                      <div style={{ marginTop: 10, fontSize: 24, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.12, color: isDarkMode ? "#f3f6ff" : "var(--gray-900)", maxWidth: 300 }}>{track.title}</div>
                      <p style={{ marginTop: 10, marginBottom: 0, color: isDarkMode ? "#bec9e8" : "var(--gray-600)", lineHeight: 1.6, fontSize: 13.5 }}>{track.detail}</p>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, color: "var(--gray-400)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Queued</div>
                      <div style={{ marginTop: 8, fontSize: 18, fontWeight: 750, letterSpacing: "-0.03em", lineHeight: 1.15, color: isDarkMode ? "#bec9e8" : "var(--gray-700)", maxWidth: 240 }}>{track.title}</div>
                      <div style={{ position: "absolute", inset: 0, background: isDarkMode ? "linear-gradient(180deg, rgba(16,24,40,0.35), rgba(16,24,40,0.6))" : "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0.6))" }} />
                    </>
                  )}
                  {stackIndex === 0 && (
                    <>
                      <span style={{ display: "inline-flex", marginTop: 24, padding: "12px 24px", borderRadius: 999, background: isDarkMode ? "#8ea0ff" : "var(--gray-900)", color: isDarkMode ? "#0b0f19" : "var(--white)", fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", cursor: "pointer", transition: "all 0.2s ease" }}>
                        Reveal next
                      </span>
                      <div style={{ marginTop: 20, paddingTop: 16, borderTop: isDarkMode ? "1px solid rgba(124,143,255,0.15)" : "1px solid rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 11, color: isDarkMode ? "#97a6d4" : "var(--gray-400)", fontWeight: 600, letterSpacing: "0.05em" }}>
                          {activeDeck + 1} of {tracks.length}
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {tracks.map((_, idx) => (
                            <div key={idx} style={{ width: 6, height: 6, borderRadius: "50%", background: idx === activeDeck ? (isDarkMode ? "#8ea0ff" : "var(--gray-900)") : (isDarkMode ? "rgba(143,161,255,0.25)" : "rgba(0,0,0,0.15)"), transition: "all 0.3s ease" }} />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 16 }}>
        <div style={{ borderRadius: 24, border: isDarkMode ? "1px solid rgba(124,143,255,0.24)" : "1px solid var(--gray-150)", background: isDarkMode ? "rgba(18,26,42,0.62)" : "linear-gradient(180deg, var(--white), var(--gray-50))", padding: 16 }}>
          <div style={{ fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--gray-400)", fontWeight: 700 }}>Bento Live Preview</div>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 10 }}>
            <div style={{ borderRadius: 16, border: isDarkMode ? "1px solid rgba(124,143,255,0.2)" : "1px solid var(--gray-150)", background: isDarkMode ? "rgba(16,24,40,0.5)" : "var(--white)", padding: 10 }}>
              <div style={{ fontSize: 12.5, color: isDarkMode ? "#bec9e8" : "var(--gray-600)", marginBottom: 8, fontWeight: 600 }}>Resume activity heat-map</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4 }}>
                {Array.from({ length: 54 }).map((_, idx) => (
                  <motion.span
                    key={idx}
                    animate={{ opacity: [0.22, 0.88, 0.3] }}
                    transition={{ duration: 1.6, repeat: Infinity, delay: (idx % 9) * 0.08 + Math.floor(idx / 9) * 0.03 }}
                    style={{ display: "block", width: "100%", aspectRatio: "1 / 1", borderRadius: 3, background: isDarkMode ? "linear-gradient(180deg, #8ea0ff, #5b72ff)" : "linear-gradient(180deg, var(--gray-800), var(--gray-500))" }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ borderRadius: 16, border: isDarkMode ? "1px solid rgba(124,143,255,0.2)" : "1px solid var(--gray-150)", background: isDarkMode ? "rgba(16,24,40,0.5)" : "var(--white)", padding: 10 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gray-400)", fontWeight: 700 }}>Alignment ticker</div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={liveSignals[signalIndex]}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.28 }}
                    style={{ marginTop: 8, fontSize: 13, color: isDarkMode ? "#f3f6ff" : "var(--gray-700)", fontWeight: 600, lineHeight: 1.45 }}
                  >
                    {liveSignals[signalIndex]}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div style={{ borderRadius: 16, border: isDarkMode ? "1px solid rgba(124,143,255,0.2)" : "1px solid var(--gray-150)", background: isDarkMode ? "rgba(16,24,40,0.5)" : "var(--white)", padding: 10 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--gray-400)", fontWeight: 700 }}>Practice loop</div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  animate={{ scale: [1, 1.04, 1], boxShadow: ["0 8px 18px rgba(0,0,0,0.12)", "0 12px 24px rgba(0,0,0,0.2)", "0 8px 18px rgba(0,0,0,0.12)"] }}
                  transition={{ duration: 1.7, repeat: Infinity }}
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  style={{
                    marginTop: 10,
                    width: "100%",
                    border: "none",
                    borderRadius: 999,
                    padding: "10px 12px",
                    background: isDarkMode ? "#8ea0ff" : "var(--gray-900)",
                    color: isDarkMode ? "#0b0f19" : "var(--white)",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Continue Practice
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ borderRadius: 24, border: isDarkMode ? "1px solid rgba(124,143,255,0.24)" : "1px solid var(--gray-150)", background: isDarkMode ? "rgba(18,26,42,0.62)" : "linear-gradient(180deg, var(--white), var(--gray-50))", padding: 16 }}>
          <div style={{ fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--gray-400)", fontWeight: 700, marginBottom: 16 }}>Core Features</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { 
                title: "Resume Intelligence", 
                subtitle: "AI-powered analysis extracts skills, experience, and qualifications. Identifies gaps and recommends improvements.",
                stat: "AI Analysis"
              },
              { 
                title: "JD Mapping Engine", 
                subtitle: "Matches your profile against job descriptions in real-time. Highlights alignment opportunities.",
                stat: "Alignment Score"
              },
              { 
                title: "Growth Roadmap", 
                subtitle: "Personalized learning path with curated resources, quizzes, and hands-on projects aligned to career goals.",
                stat: "Progress Tracked"
              },
              { 
                title: "Interview Preparation", 
                subtitle: "Real-time practice with AI-powered feedback, behavioral patterns analysis, and confidence building.",
                stat: "Mock Interviews"
              }
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -3, boxShadow: "0 12px 32px rgba(0,0,0,0.09)" }}
                style={{
                  padding: "16px 14px",
                  borderRadius: 14,
                  border: isDarkMode ? "1px solid rgba(124,143,255,0.2)" : "1px solid var(--gray-150)",
                  background: isDarkMode ? "rgba(16,24,40,0.5)" : "var(--white)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? "#f3f6ff" : "var(--gray-800)", flex: 1 }}>{feature.title}</div>
                  <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.05em", color: isDarkMode ? "#97a6d4" : "var(--gray-500)", textTransform: "uppercase", padding: "3px 7px", background: isDarkMode ? "rgba(143,161,255,0.15)" : "var(--gray-100)", borderRadius: 4, whiteSpace: "nowrap" }}>{feature.stat}</div>
                </div>
                <div style={{ fontSize: 11, color: isDarkMode ? "#bec9e8" : "var(--gray-600)", lineHeight: 1.5, fontWeight: 400 }}>{feature.subtitle}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const LandingPage = ({ onEnterApp }) => {
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState({});
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [heroLoading, setHeroLoading] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const [liveTick, setLiveTick] = useState(0);
  const sectionsRef = useRef({});
  const brandAccent = "#3b5bff";

  const scrollToSection = (sectionId) => {
    if (typeof window === "undefined") return;
    const el = document.getElementById(sectionId);
    if (!el) return;
    const navOffset = 96;
    const top = el.getBoundingClientRect().top + window.scrollY - navOffset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();

    // Intersection observer for reveal
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) setVisible(p => ({ ...p, [e.target.dataset.key]: true }));
      });
    }, { threshold: 0.15 });

    document.querySelectorAll("[data-key]").forEach(el => obs.observe(el));
    return () => {
      window.removeEventListener("scroll", handleScroll);
      obs.disconnect();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setHeroLoading(false), 1100);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const ticker = window.setInterval(() => setLiveTick((p) => (p + 1) % 96), 160);
    return () => window.clearInterval(ticker);
  }, []);

  const features = [
    { icon: "resume", title: "Resume Analyzer", desc: "AI-powered ATS scoring with line-by-line feedback to maximize your resume's impact." },
    { icon: "match", title: "JD Matcher", desc: "Paste any job description and get an instant skill-gap analysis with targeted guidance." },
    { icon: "roadmap", title: "Smart Roadmap", desc: "Personalized week-by-week learning plans tailored to your target role and timeline." },
    { icon: "quiz", title: "Adaptive Quiz", desc: "Dynamic questions that adapt to your knowledge level, reinforcing key concepts." },
    { icon: "interview", title: "Mock Interview", desc: "AI conducts real-time interviews, evaluates responses, and provides actionable scores." },
    { icon: "jobs", title: "Job Finder", desc: "Curated job matches scored against your profile, with one-click application tracking." },
  ];

  const steps = [
    { num: "01", title: "Upload your resume", desc: "Our AI analyses your existing resume against ATS standards in seconds." },
    { num: "02", title: "Set your target role", desc: "Paste a job description or choose from curated roles to define your destination." },
    { num: "03", title: "Follow your roadmap", desc: "Work through a structured plan of topics, resources, and practice sessions." },
    { num: "04", title: "Get hired", desc: "Apply with confidence — your profile is now optimised and interview-ready." },
  ];

  const testimonials = [
    { name: "Ananya S.", role: "SWE @ Google", text: "SkillBridge AI helped me close a 4-month gap in my skillset in just 6 weeks. The roadmap feature is incredibly smart.", avatar: "A" },
    { name: "Rahul M.", role: "PM @ Stripe", text: "The JD Matcher revealed exactly what was missing in my profile. I tailored my resume and got 3x more responses.", avatar: "R" },
    { name: "Priya K.", role: "Data Analyst @ Airbnb", text: "The mock interview feature is eerily realistic. It caught nervousness patterns I didn't even notice.", avatar: "P" },
  ];

  // Animated particles
  const particles = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    size: Math.random() * 4 + 3,
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 4,
    duration: Math.random() * 12 + 18,
    animation: `floatParticle${(i % 3) + 1}`
  }));

  return (
    <div
      className="mesh-bg"
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background: isDarkMode
          ? "radial-gradient(ellipse at top left, rgba(55,72,150,0.24), transparent 40%), #0b0f19"
          : undefined,
        color: isDarkMode ? "#f4f6fb" : undefined,
      }}
    >
      {/* Animated Background Particles */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
          transform: `translateY(${scrollY * -0.08}px)`,
          transition: "transform 0.08s linear",
        }}
      >
        {particles.map(p => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: isDarkMode ? "rgba(143, 161, 255, 0.25)" : "rgba(180, 180, 180, 0.25)",
              animation: `${p.animation} ${p.duration}s ease-in-out ${p.delay}s infinite`,
              boxShadow: isDarkMode
                ? `0 0 ${p.size * 2}px rgba(116, 138, 255, 0.22)`
                : `0 0 ${p.size * 2}px rgba(180, 180, 180, 0.15)`,
              filter: "blur(0.5px)"
            }}
          />
        ))}
        
        {/* Larger floating shapes */}
        <div style={{
          position: "absolute",
          top: "15%",
          right: "20%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: isDarkMode
            ? "radial-gradient(circle, rgba(80, 104, 255, 0.22), transparent 70%)"
            : "radial-gradient(circle, rgba(200, 200, 200, 0.12), transparent 70%)",
          animation: "floatSlow 22s ease-in-out infinite",
          filter: "blur(50px)"
        }}/>
        <div style={{
          position: "absolute",
          bottom: "20%",
          left: "15%",
          width: 380,
          height: 380,
          borderRadius: "50%",
          background: isDarkMode
            ? "radial-gradient(circle, rgba(91, 114, 255, 0.2), transparent 70%)"
            : "radial-gradient(circle, rgba(190, 190, 190, 0.1), transparent 70%)",
          animation: "floatSlow 26s ease-in-out infinite 4s",
          filter: "blur(55px)"
        }}/>
        <div style={{
          position: "absolute",
          top: "40%",
          left: "60%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: isDarkMode
            ? "radial-gradient(circle, rgba(109, 127, 255, 0.16), transparent 70%)"
            : "radial-gradient(circle, rgba(185, 185, 185, 0.08), transparent 70%)",
          animation: "floatSlow 24s ease-in-out infinite 8s",
          filter: "blur(52px)"
        }}/>
      </div>

      {/* Navbar */}
      <nav className="glass" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: scrolled ? "12px 48px" : "20px 48px",
        transition: "all var(--transition)",
        borderBottom: scrolled ? (isDarkMode ? "1px solid rgba(133,149,255,0.22)" : "1px solid var(--gray-150)") : "1px solid transparent",
        boxShadow: scrolled ? "var(--shadow-sm)" : "none",
        background: isDarkMode ? "rgba(8, 12, 22, 0.72)" : undefined,
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <LogoMark size={32} />
            <span style={{ fontWeight: 700, fontSize: 15.5, letterSpacing: "-0.03em", color: isDarkMode ? "#edf1ff" : "var(--gray-900)" }}>SkillBridge AI</span>
          </div>

          <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
            {[
              { label: "Features", id: "features" },
              { label: "How it works", id: "how-it-works" },
              { label: "Pricing", id: "pricing" },
            ].map((item) => (
              <a
                key={item.label}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection(item.id);
                }}
                style={{ fontSize: 14, color: isDarkMode ? "#b8c3ec" : "var(--gray-500)", textDecoration: "none", fontWeight: 500, letterSpacing: "-0.01em", transition: "color 0.15s" }}
                onMouseEnter={e => e.target.style.color = isDarkMode ? "#eef2ff" : "var(--gray-900)"}
                onMouseLeave={e => e.target.style.color = isDarkMode ? "#b8c3ec" : "var(--gray-500)"}
              >
                {item.label}
              </a>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Btn
              variant="secondary"
              onClick={() => setIsDarkMode((p) => !p)}
              style={{
                padding: "8px 14px",
                fontSize: 12,
                borderColor: isDarkMode ? "rgba(123,140,255,0.34)" : "var(--gray-200)",
                background: isDarkMode ? "#101827" : "var(--white)",
                color: isDarkMode ? "#e7edff" : "var(--gray-800)",
              }}
            >
              {isDarkMode ? "Light mode" : "Dark mode"}
            </Btn>
            <Btn variant="primary" accentColor={brandAccent} onClick={onEnterApp} style={{ padding: "8px 18px", fontSize: 13.5 }}>Get started</Btn>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          minHeight: "100vh",
          textAlign: "center",
          maxWidth: 1280,
          margin: "0 auto",
          padding: "160px 24px 72px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="fade-up" style={{ animationDelay: "0.1s", opacity: 0, animationFillMode: "forwards", marginBottom: 22 }}>
          <Badge variant="neutral" style={{ fontSize: 11.5, padding: "8px 14px", fontFamily: "'JetBrains Mono', 'DM Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase", background: isDarkMode ? "#101827" : undefined, borderColor: isDarkMode ? "rgba(126,145,255,0.4)" : undefined }}>
            Project Focus: Resume + JD + Adaptive Prep
          </Badge>
        </div>
        <h1 className="fade-up" style={{
          fontSize: "clamp(52px, 8.8vw, 96px)", fontWeight: 800,
          lineHeight: 0.98, letterSpacing: "-0.05em",
          color: "transparent",
          marginBottom: 20,
          backgroundImage: isDarkMode
            ? "linear-gradient(180deg, #f8faff 0%, #d7dff9 58%, #aeb8d9 100%)"
            : "linear-gradient(180deg, #0e1015 0%, #292e39 54%, #838995 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          animationDelay: "0.2s", opacity: 0, animationFillMode: "forwards",
        }}>
          Build A Career<br/>
          <span style={{ color: "transparent", backgroundImage: isDarkMode ? "linear-gradient(180deg, #f5f7ff 0%, #8ea0ff 100%)" : "linear-gradient(180deg, #30333a 0%, #111218 100%)", WebkitBackgroundClip: "text", backgroundClip: "text" }}>
            That Actually <span style={{ color: isDarkMode ? "#7d93ff" : "#111318", background: "none", WebkitBackgroundClip: "initial", backgroundClip: "initial" }}>Fits</span>
          </span>
        </h1>
        <p className="fade-up" style={{
          fontSize: "clamp(18px, 2.2vw, 24px)", color: isDarkMode ? "#c4cee9" : "var(--gray-600)", lineHeight: 1.55,
          maxWidth: 860, margin: "0 auto 34px",
          fontWeight: 500, letterSpacing: "-0.015em",
          animationDelay: "0.3s", opacity: 0, animationFillMode: "forwards",
        }}>
          SkillBridge turns your resume and target role into a focused execution plan: diagnose gaps, map to real JDs, practice with feedback, and track measurable hiring readiness.
        </p>
        <div className="fade-up" style={{ display: "flex", gap: 12, justifyContent: "center", animationDelay: "0.4s", opacity: 0, animationFillMode: "forwards" }}>
          <Btn variant="primary" accentColor={brandAccent} onClick={onEnterApp} style={{ padding: "13px 30px", fontSize: 15 }}>
            Get started free
          </Btn>
          <Btn variant="secondary" style={{ padding: "13px 30px", fontSize: 15, borderColor: isDarkMode ? "rgba(128,145,255,0.28)" : undefined, background: isDarkMode ? "#121b2b" : undefined, color: isDarkMode ? "#e6ecff" : undefined }} icon={<Icon name="play" size={14}/> }>
            See demo
          </Btn>
        </div>

        <div
          className="fade-up"
          style={{
            marginTop: 28,
            width: "min(980px, 100%)",
            display: "grid",
            gridTemplateColumns: "1.35fr 1fr 1fr",
            gridTemplateRows: "auto auto",
            gap: 12,
            animationDelay: "0.48s",
            opacity: 0,
            animationFillMode: "forwards",
            position: "relative",
            transform: `translateY(${scrollY * -0.03}px)`,
            transition: "transform 0.08s linear",
          }}
        >
          <div style={{
            position: "absolute",
            right: -18,
            top: -12,
            zIndex: 3,
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid rgba(90, 120, 255, 0.35)",
            background: isDarkMode ? "rgba(16,24,40,0.84)" : "rgba(255,255,255,0.88)",
            backdropFilter: "blur(10px)",
            fontSize: 11,
            fontWeight: 700,
            color: isDarkMode ? "#b6c6ff" : "#2c46d6",
            boxShadow: "0 10px 28px rgba(56,91,255,0.22)",
          }}>
            ATS Score: {Math.min(98, 84 + liveTick)}
          </div>

          <div style={{
            gridRow: "1 / span 2",
            borderRadius: 18,
            border: isDarkMode ? "1px solid rgba(124,143,255,0.24)" : "1px solid rgba(160,160,160,0.2)",
            background: isDarkMode ? "rgba(18,26,42,0.62)" : "rgba(255,255,255,0.58)",
            backdropFilter: "blur(10px)",
            padding: 16,
            textAlign: "left",
            boxShadow: "0 32px 80px rgba(0,0,0,0.06), 0 10px 36px rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.03)",
          }}>
            <div style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: isDarkMode ? "#97a6d4" : "var(--gray-500)", fontFamily: "'JetBrains Mono', 'DM Mono', monospace", marginBottom: 10 }}>Hero Feature</div>
            <div style={{ fontSize: 20, fontWeight: 760, color: isDarkMode ? "#f3f6ff" : "var(--gray-900)", marginBottom: 8 }}>Resume Deep-Scan</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: isDarkMode ? "#bec9e8" : "var(--gray-600)", marginBottom: 14 }}>
              Intelligent extraction of skills, impact, and role-fit signals from your resume with line-level recommendations.
            </div>
            {heroLoading ? (
              <div style={{ display: "grid", gap: 10 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ height: 12, borderRadius: 8, background: "linear-gradient(90deg, rgba(180,180,180,0.22) 25%, rgba(240,240,240,0.62) 50%, rgba(180,180,180,0.22) 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.2s linear infinite" }} />
                ))}
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: isDarkMode ? "#9eb2e8" : "var(--gray-500)" }}>Extraction Progress</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? "#dee6ff" : "var(--gray-800)" }}>{Math.min(100, 24 + liveTick)}%</span>
                </div>
                <div style={{ height: 9, borderRadius: 999, background: isDarkMode ? "rgba(146,161,219,0.2)" : "var(--gray-150)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, 24 + liveTick)}%`, background: `linear-gradient(90deg, ${brandAccent}, #7294ff)`, transition: "width 0.16s linear" }} />
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: isDarkMode ? "#adbbe1" : "var(--gray-500)" }}>
                  Parsed: Skills, Projects, Experience, Keywords
                </div>
              </div>
            )}
          </div>

          {["JD Match Engine", "Adaptive Learning Loop", "Progress Visibility"].map((title, idx) => (
            <div
              key={title}
              style={{
                borderRadius: 16,
                border: isDarkMode ? "1px solid rgba(124,143,255,0.2)" : "1px solid rgba(170,170,170,0.22)",
                background: isDarkMode ? "rgba(18,26,42,0.58)" : "rgba(255,255,255,0.56)",
                backdropFilter: "blur(10px)",
                padding: 14,
                textAlign: "left",
                boxShadow: "0 24px 54px rgba(0,0,0,0.05), 0 8px 20px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 720, color: isDarkMode ? "#f0f4ff" : "var(--gray-900)", marginBottom: 6 }}>{title}</div>
              {heroLoading ? (
                <div style={{ height: 10, borderRadius: 8, background: "linear-gradient(90deg, rgba(180,180,180,0.22) 25%, rgba(240,240,240,0.62) 50%, rgba(180,180,180,0.22) 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.2s linear infinite" }} />
              ) : (
                <>
                  {idx === 0 && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: isDarkMode ? "#aab9df" : "var(--gray-600)", marginBottom: 6 }}>
                        <span>Role match score</span><strong style={{ color: isDarkMode ? "#eaf0ff" : "var(--gray-900)" }}>{Math.min(95, 42 + liveTick)}%</strong>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: isDarkMode ? "rgba(146,161,219,0.2)" : "var(--gray-150)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(95, 42 + liveTick)}%`, background: `linear-gradient(90deg, ${brandAccent}, #7f9bff)`, transition: "width 0.16s linear" }} />
                      </div>
                    </div>
                  )}
                  {idx === 1 && (
                    <div style={{ fontSize: 12.5, color: isDarkMode ? "#b3c0e5" : "var(--gray-600)", lineHeight: 1.6 }}>
                      Next task: System design fundamentals, timed quiz, and mock interview round.
                    </div>
                  )}
                  {idx === 2 && (
                    <div style={{ fontSize: 12.5, color: isDarkMode ? "#b3c0e5" : "var(--gray-600)", lineHeight: 1.6 }}>
                      Hiring readiness increased from 61% to {Math.min(89, 68 + Math.floor(liveTick / 3))}% this week.
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Journey section appears after first screen */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 24px 20px" }}>
        <ProjectExperiencePanel isDarkMode={isDarkMode} />
      </section>

      {/* Features */}
      <section id="features" data-key="features" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontSize: 12, color: "var(--gray-400)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Features</div>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 700, letterSpacing: "-0.035em", color: isDarkMode ? "#f3f6ff" : "var(--gray-900)", lineHeight: 1.12 }}>
            Everything you need to level up
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
          {features.map((f, i) => (
            <Card key={f.title} style={{
              animationDelay: `${i * 0.07}s`,
              ...(visible.features ? { animation: `fadeUp 0.6s ${i * 0.07}s ease forwards` } : { opacity: 0 }),
              border: isDarkMode ? "1px solid rgba(124,143,255,0.24)" : undefined,
              background: isDarkMode ? "rgba(18,26,42,0.62)" : undefined,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "rgba(143,161,255,0.15)" : "var(--gray-100)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 16,
              }}>
                <Icon name={f.icon} size={18} color={isDarkMode ? "#8ea0ff" : "var(--gray-700)"}/>
              </div>
              <h3 style={{ fontSize: 15.5, fontWeight: 650, color: isDarkMode ? "#f3f6ff" : "var(--gray-900)", marginBottom: 8, letterSpacing: "-0.02em" }}>{f.title}</h3>
              <p style={{ fontSize: 13.5, color: isDarkMode ? "#bec9e8" : "var(--gray-500)", lineHeight: 1.65 }}>{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" data-key="howto" style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 80 }}>
          <div style={{ fontSize: 11, color: "var(--gray-400)", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>PROCESS</div>
          <h2 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, letterSpacing: "-0.04em", color: isDarkMode ? "#f3f6ff" : "var(--gray-900)", lineHeight: 1.1 }}>
            From zero to hired in 4 steps
          </h2>
        </div>
        
        {/* Horizontal Timeline */}
        <div style={{ 
          display: "flex", 
          alignItems: "flex-start", 
          justifyContent: "space-between",
          gap: 40,
          position: "relative",
          maxWidth: 1100,
          margin: "0 auto"
        }}>
          {steps.map((s, i) => (
            <div key={s.num} style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              position: "relative",
              ...(visible.howto ? { animation: `fadeUp 0.7s ${i * 0.15}s ease forwards` } : { opacity: 0 }),
            }}>
              {/* Step Number Circle */}
              <div style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: isDarkMode ? "rgba(16,24,40,0.8)" : "var(--gray-100)",
                border: isDarkMode ? "1px solid rgba(124,143,255,0.3)" : "1px solid var(--gray-200)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
                fontSize: 16,
                fontWeight: 700,
                color: isDarkMode ? "#8ea0ff" : "var(--gray-400)",
                fontFamily: "'DM Mono', monospace",
                transition: "all 0.3s ease"
              }}>
                {s.num}
              </div>
              
              {/* Connecting Line */}
              {i < steps.length - 1 && (
                <div style={{
                  position: "absolute",
                  top: 28,
                  left: "calc(50% + 28px)",
                  width: "calc(100% - 56px)",
                  height: 2,
                  background: isDarkMode ? "rgba(124,143,255,0.25)" : "var(--gray-200)",
                  zIndex: -1
                }}/>
              )}
              
              {/* Content */}
              <div>
                <h3 style={{ 
                  fontSize: 17, 
                  fontWeight: 700, 
                  color: isDarkMode ? "#f3f6ff" : "var(--gray-900)", 
                  marginBottom: 12, 
                  letterSpacing: "-0.02em" 
                }}>
                  {s.title}
                </h3>
                <p style={{ 
                  fontSize: 13.5, 
                  color: isDarkMode ? "#bec9e8" : "var(--gray-500)", 
                  lineHeight: 1.7,
                  maxWidth: 220
                }}>
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section data-key="testimonials" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 700, letterSpacing: "-0.035em", color: isDarkMode ? "#f3f6ff" : "var(--gray-900)" }}>
            Trusted by ambitious professionals
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
          {testimonials.map((t, i) => (
            <Card key={t.name} style={{
              ...(visible.testimonials ? { animation: `fadeUp 0.6s ${i * 0.1}s ease forwards` } : { opacity: 0 }),
              border: isDarkMode ? "1px solid rgba(124,143,255,0.24)" : undefined,
              background: isDarkMode ? "rgba(18,26,42,0.62)" : undefined,
            }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                {[...Array(5)].map((_, j) => <Icon key={j} name="star" size={13} color={isDarkMode ? "#8ea0ff" : "var(--gray-400)"}/>)}
              </div>
              <p style={{ fontSize: 14, color: isDarkMode ? "#bec9e8" : "var(--gray-600)", lineHeight: 1.7, marginBottom: 20 }}>"{t.text}"</p>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: isDarkMode ? "#8ea0ff" : "var(--gray-900)", color: isDarkMode ? "#0b0f19" : "var(--white)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700,
                }}>{t.avatar}</div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 650, color: isDarkMode ? "#f3f6ff" : "var(--gray-900)" }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "var(--gray-400)" }}>{t.role}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 90px" }}>
        <div style={{ textAlign: "center", marginBottom: 46 }}>
          <div style={{ fontSize: 12, color: "var(--gray-400)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
            Pricing
          </div>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 700, letterSpacing: "-0.035em", color: isDarkMode ? "#f3f6ff" : "var(--gray-900)", lineHeight: 1.12 }}>
            Plans for every stage
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
          <Card style={{
            border: isDarkMode ? "1px solid rgba(124,143,255,0.24)" : undefined,
            background: isDarkMode ? "rgba(18,26,42,0.62)" : undefined,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? "#f3f6ff" : "var(--gray-900)", marginBottom: 10 }}>Starter</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: isDarkMode ? "#f3f6ff" : "var(--gray-900)", letterSpacing: "-0.03em", marginBottom: 4 }}>$0</div>
            <div style={{ fontSize: 12.5, color: isDarkMode ? "#97a6d4" : "var(--gray-500)", marginBottom: 16 }}>For exploring the platform</div>
            <div style={{ fontSize: 13.5, color: isDarkMode ? "#bec9e8" : "var(--gray-600)", lineHeight: 1.7, marginBottom: 18 }}>
              Resume parsing, basic JD matching, and limited quiz attempts.
            </div>
            <Btn variant="secondary" style={{ width: "100%", justifyContent: "center", borderColor: isDarkMode ? "rgba(128,145,255,0.28)" : undefined, background: isDarkMode ? "#121b2b" : undefined, color: isDarkMode ? "#e6ecff" : undefined }} onClick={onEnterApp}>Get started</Btn>
          </Card>
          <Card style={{ border: isDarkMode ? "1px solid rgba(143,161,255,0.5)" : "1px solid var(--gray-900)", boxShadow: "var(--shadow-lg)", background: isDarkMode ? "rgba(18,26,42,0.8)" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? "#f3f6ff" : "var(--gray-900)" }}>Pro</div>
              <Badge variant="neutral" style={{ background: isDarkMode ? "rgba(143,161,255,0.2)" : undefined, color: isDarkMode ? "#8ea0ff" : undefined }}>Most popular</Badge>
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, color: isDarkMode ? "#f3f6ff" : "var(--gray-900)", letterSpacing: "-0.03em", marginBottom: 4 }}>$19<span style={{ fontSize: 14, fontWeight: 600, color: isDarkMode ? "#97a6d4" : "var(--gray-500)" }}>/mo</span></div>
            <div style={{ fontSize: 12.5, color: isDarkMode ? "#97a6d4" : "var(--gray-500)", marginBottom: 16 }}>For active job seekers</div>
            <div style={{ fontSize: 13.5, color: isDarkMode ? "#bec9e8" : "var(--gray-600)", lineHeight: 1.7, marginBottom: 18 }}>
              Unlimited quizzes, advanced roadmap, AI interview feedback, and job tracking.
            </div>
            <Btn variant="primary" style={{ width: "100%", justifyContent: "center" }} onClick={onEnterApp}>Start Pro</Btn>
          </Card>
          <Card style={{
            border: isDarkMode ? "1px solid rgba(124,143,255,0.24)" : undefined,
            background: isDarkMode ? "rgba(18,26,42,0.62)" : undefined,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? "#f3f6ff" : "var(--gray-900)", marginBottom: 10 }}>Teams</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: isDarkMode ? "#f3f6ff" : "var(--gray-900)", letterSpacing: "-0.03em", marginBottom: 4 }}>Custom</div>
            <div style={{ fontSize: 12.5, color: isDarkMode ? "#97a6d4" : "var(--gray-500)", marginBottom: 16 }}>For institutes and cohorts</div>
            <div style={{ fontSize: 13.5, color: isDarkMode ? "#bec9e8" : "var(--gray-600)", lineHeight: 1.7, marginBottom: 18 }}>
              Admin dashboard, cohort analytics, role-specific learning paths, and support.
            </div>
            <Btn variant="secondary" style={{ width: "100%", justifyContent: "center", borderColor: isDarkMode ? "rgba(128,145,255,0.28)" : undefined, background: isDarkMode ? "#121b2b" : undefined, color: isDarkMode ? "#e6ecff" : undefined }} onClick={onEnterApp}>Contact sales</Btn>
          </Card>
        </div>
      </section>

      {/* CTA Banner */}
      <section style={{ maxWidth: 1100, margin: "0 auto 100px", padding: "0 24px" }}>
        <div style={{
          background: isDarkMode ? "rgba(18,26,42,0.9)" : "var(--gray-900)", borderRadius: "var(--radius-xl)",
          padding: "60px 64px", textAlign: "center",
          boxShadow: "var(--shadow-xl)",
          border: isDarkMode ? "1px solid rgba(143,161,255,0.3)" : undefined,
        }}>
          <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 700, color: "var(--white)", letterSpacing: "-0.04em", marginBottom: 14 }}>
            Start your career transformation today
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", marginBottom: 32 }}>
            Join thousands of professionals accelerating their careers with AI.
          </p>
          <Btn variant="secondary" onClick={onEnterApp} style={{ padding: "13px 32px", fontSize: 15, borderColor: isDarkMode ? "rgba(143,161,255,0.4)" : undefined, background: isDarkMode ? "rgba(143,161,255,0.15)" : undefined, color: isDarkMode ? "#e6ecff" : undefined }}>
            Get started free — no credit card
          </Btn>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: isDarkMode ? "1px solid rgba(124,143,255,0.2)" : "1px solid var(--gray-150)", padding: "32px 48px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LogoMark size={24} />
            <span style={{ fontWeight: 700, fontSize: 13, color: "var(--gray-900)", letterSpacing: "-0.03em" }}>SkillBridge AI</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--gray-400)" }}>© 2025 SkillBridge AI. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const Sidebar = ({ active, setActive, isDarkMode }) => {
  const nav = [
    { id: "dashboard", icon: "dashboard", label: "Overview" },
    { id: "resume", icon: "resume", label: "Resume" },
    { id: "matcher", icon: "match", label: "JD Matcher" },
    { id: "roadmap", icon: "roadmap", label: "Roadmap" },
    { id: "quiz", icon: "quiz", label: "Quiz" },
    { id: "interview", icon: "interview", label: "Interview" },
    { id: "jobs", icon: "jobs", label: "Jobs" },
  ];

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: isDarkMode ? "#1e2a3a" : "var(--white)",
      borderRight: isDarkMode ? "1px solid rgba(70,100,150,0.25)" : "1px solid var(--gray-150)",
      display: "flex", flexDirection: "column",
      padding: "24px 0",
      height: "100vh", position: "sticky", top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "0 20px 24px", borderBottom: isDarkMode ? "1px solid rgba(70,100,150,0.2)" : "1px solid var(--gray-100)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <LogoMark size={30} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: isDarkMode ? "#e8eef7" : "var(--gray-900)", letterSpacing: "-0.03em" }}>SkillBridge</div>
            <div style={{ fontSize: 10, color: isDarkMode ? "#8a9bb5" : "var(--gray-400)", fontWeight: 500 }}>AI Career OS</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        {nav.map(item => {
          const isActive = active === item.id;
          return (
            <button key={item.id} onClick={() => setActive(item.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10,
                border: "none", cursor: "pointer", width: "100%", textAlign: "left",
                background: isActive ? (isDarkMode ? "rgba(91,127,196,0.18)" : "var(--gray-100)") : "transparent",
                color: isActive ? (isDarkMode ? "#e8eef7" : "var(--gray-900)") : (isDarkMode ? "#b4c3d9" : "var(--gray-500)"),
                fontSize: 13.5, fontWeight: isActive ? 600 : 500,
                transition: "all var(--transition)",
                fontFamily: "inherit",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = isDarkMode ? "rgba(91,127,196,0.1)" : "var(--gray-50)"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
              <Icon name={item.icon} size={16} color={isActive ? (isDarkMode ? "#6b93d6" : "var(--gray-900)") : (isDarkMode ? "#8a9bb5" : "var(--gray-400)")}/>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: "16px 20px", borderTop: isDarkMode ? "1px solid rgba(70,100,150,0.2)" : "1px solid var(--gray-100)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: isDarkMode ? "#5b7fc4" : "var(--gray-900)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--white)" }}>A</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? "#e8eef7" : "var(--gray-800)" }}>Student</div>
            <div style={{ fontSize: 11, color: isDarkMode ? "#8a9bb5" : "var(--gray-400)" }}>Pro plan</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

// ─── Topbar ───────────────────────────────────────────────────────────────────
const Topbar = ({ title, onLogout, isDarkMode, setIsDarkMode }) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header style={{
      height: 60, borderBottom: isDarkMode ? "1px solid rgba(70,100,150,0.25)" : "1px solid var(--gray-150)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 28px", background: isDarkMode ? "#1e2a3a" : "var(--white)", position: "sticky", top: 0, zIndex: 10,
    }}>
      <h1 style={{ fontSize: 16, fontWeight: 650, color: isDarkMode ? "#e8eef7" : "var(--gray-900)", letterSpacing: "-0.025em" }}>{title}</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: isDarkMode ? "#253447" : "var(--gray-50)", border: isDarkMode ? "1px solid rgba(70,100,150,0.3)" : "1px solid var(--gray-200)",
          borderRadius: 99, padding: "8px 14px", width: 200,
        }}>
          <Icon name="search" size={14} color={isDarkMode ? "#8a9bb5" : "var(--gray-400)"}/>
          <input placeholder="Search anything..." style={{
            border: "none", background: "transparent", fontSize: 13, color: isDarkMode ? "#b4c3d9" : "var(--gray-600)",
            outline: "none", width: "100%", fontFamily: "inherit",
          }}/>
        </div>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          style={{
            width: 36, height: 36, borderRadius: "50%", background: isDarkMode ? "#253447" : "var(--gray-50)",
            border: isDarkMode ? "1px solid rgba(70,100,150,0.3)" : "1px solid var(--gray-200)", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", transition: "all 0.2s ease",
          }}
        >
          <Icon name={isDarkMode ? "sun" : "moon"} size={15} color={isDarkMode ? "#6b93d6" : "var(--gray-500)"}/>
        </button>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", background: isDarkMode ? "#253447" : "var(--gray-50)",
          border: isDarkMode ? "1px solid rgba(70,100,150,0.3)" : "1px solid var(--gray-200)", display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", position: "relative",
        }}>
          <Icon name="bell" size={15} color={isDarkMode ? "#6b93d6" : "var(--gray-500)"}/>
          <div style={{
            position: "absolute", top: 8, right: 8,
            width: 7, height: 7, borderRadius: "50%",
            background: isDarkMode ? "#6b93d6" : "var(--gray-700)", border: isDarkMode ? "1.5px solid #1e2a3a" : "1.5px solid var(--white)",
          }}/>
        </div>
        <div ref={profileRef} style={{ position: "relative" }}>
          <div 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            style={{ 
              width: 32, height: 32, borderRadius: "50%", 
              background: "var(--gray-900)", display: "flex", 
              alignItems: "center", justifyContent: "center", 
              fontSize: 12, fontWeight: 700, color: "var(--white)", 
              cursor: "pointer",
              transition: "transform 0.2s ease",
              transform: showProfileMenu ? "scale(0.95)" : "scale(1)"
            }}>
            A
          </div>
          {showProfileMenu && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              background: "var(--white)", border: "1px solid var(--gray-150)",
              borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-lg)",
              minWidth: 180, padding: "6px", zIndex: 100,
              animation: "fadeIn 0.15s ease"
            }}>
              <div style={{
                padding: "10px 12px", borderRadius: "8px",
                cursor: "pointer", transition: "background 0.15s ease",
                display: "flex", alignItems: "center", gap: 10,
                fontSize: 13.5, color: "var(--gray-700)", fontWeight: 500
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--gray-50)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <Icon name="user" size={15} color="var(--gray-500)"/>
                Profile
              </div>
              <div style={{
                padding: "10px 12px", borderRadius: "8px",
                cursor: "pointer", transition: "background 0.15s ease",
                display: "flex", alignItems: "center", gap: 10,
                fontSize: 13.5, color: "var(--gray-700)", fontWeight: 500
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--gray-50)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <Icon name="settings" size={15} color="var(--gray-500)"/>
                Settings
              </div>
              <div style={{ height: 1, background: "var(--gray-150)", margin: "6px 0" }}/>
              <div 
                onClick={onLogout}
                style={{
                  padding: "10px 12px", borderRadius: "8px",
                  cursor: "pointer", transition: "background 0.15s ease",
                  display: "flex", alignItems: "center", gap: 10,
                  fontSize: 13.5, color: "var(--gray-700)", fontWeight: 500
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--gray-50)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <Icon name="x" size={15} color="var(--gray-500)"/>
                Logout
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const ApiKeySettingsPanel = ({
  isDarkMode,
  apiKey,
  setApiKey,
  applyToAllRoutes,
  setApplyToAllRoutes,
  isSaving,
  isLoadingStatus,
  currentMaskedKey,
  status,
  onSave,
}) => {
  return (
    <Card isDarkMode={isDarkMode} style={{ padding: 20, borderRadius: 22, border: isDarkMode ? "1px solid rgba(90,120,180,0.28)" : "1px solid var(--gray-150)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: "0.12em", textTransform: "uppercase", color: isDarkMode ? "#9fb3d1" : "var(--gray-400)", fontWeight: 700 }}>
            API Key Setup
          </div>
          <h3 style={{ marginTop: 6, fontSize: 18, fontWeight: 700, color: isDarkMode ? "#e8eef7" : "var(--gray-900)", letterSpacing: "-0.02em" }}>
            Paste your Oxlo API key here
          </h3>
        </div>
        <Badge variant={currentMaskedKey ? "success" : "warning"}>
          {isLoadingStatus ? "Checking" : (currentMaskedKey ? "Configured" : "Not set")}
        </Badge>
      </div>

      <p style={{ fontSize: 13, lineHeight: 1.55, color: isDarkMode ? "#b4c3d9" : "var(--gray-600)", marginBottom: 12 }}>
        Save your key once and the backend will use it for ATS, JD Matcher, Roadmap, Quiz, and Interview models.
      </p>

      <div style={{
        borderRadius: 10,
        padding: "8px 10px",
        marginBottom: 12,
        fontSize: 12,
        border: isDarkMode ? "1px solid rgba(90,120,180,0.35)" : "1px solid var(--gray-200)",
        background: isDarkMode ? "rgba(16,24,40,0.45)" : "var(--gray-50)",
        color: isDarkMode ? "#cdd9ec" : "var(--gray-700)",
      }}>
        {isLoadingStatus
          ? "Checking current key status..."
          : currentMaskedKey
            ? `Current saved key: ${currentMaskedKey}`
            : "No saved API key yet. Paste one below to enable AI features."}
      </div>

      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: isDarkMode ? "#cdd9ec" : "var(--gray-700)", marginBottom: 6 }}>
        API Key
      </label>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Paste key here (example: sk_...)"
        autoComplete="off"
        spellCheck={false}
        style={{
          width: "100%",
          borderRadius: 12,
          border: isDarkMode ? "1px solid rgba(90,120,180,0.4)" : "1px solid var(--gray-250)",
          background: isDarkMode ? "rgba(16,24,40,0.68)" : "var(--gray-50)",
          color: isDarkMode ? "#e8eef7" : "var(--gray-900)",
          fontFamily: tokens.fontMono,
          fontSize: 12.5,
          padding: "10px 12px",
          outline: "none",
          marginBottom: 12,
        }}
      />

      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: isDarkMode ? "#cdd9ec" : "var(--gray-700)", marginBottom: 14 }}>
        <input
          type="checkbox"
          checked={applyToAllRoutes}
          onChange={(e) => setApplyToAllRoutes(e.target.checked)}
        />
        Use this key for ATS, JD, Roadmap, Quiz, and Interview routes
      </label>

      {status.message && (
        <div
          style={{
            borderRadius: 10,
            padding: "9px 10px",
            marginBottom: 12,
            fontSize: 12.5,
            border: status.type === "error"
              ? "1px solid rgba(220, 90, 90, 0.5)"
              : "1px solid rgba(63, 176, 115, 0.55)",
            color: status.type === "error" ? "#fca5a5" : (isDarkMode ? "#9ee6b4" : "#166534"),
            background: status.type === "error"
              ? "rgba(127, 29, 29, 0.22)"
              : (isDarkMode ? "rgba(22, 101, 52, 0.25)" : "#f0fdf4"),
          }}
        >
          {status.message}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Btn variant="primary" onClick={onSave} disabled={isSaving} style={{ minWidth: 132 }}>
          {isSaving ? "Saving..." : "Save API Key"}
        </Btn>
      </div>
    </Card>
  );
};

// ─── Dashboard Overview ───────────────────────────────────────────────────────
const DashboardOverview = ({ resumeContext, overviewMetrics, isDarkMode }) => {
  const atsScore = Number(overviewMetrics.resume?.atsScore || 0);
  const jdMatch = Math.round(Number(resumeContext.matchResult?.match_percentage || 0));
  const quizScore = Number(overviewMetrics.quiz?.score || 0);
  const interviewScore = Number(overviewMetrics.interview?.score || 0);
  const jobsSaved = Number(overviewMetrics.jobs?.saved || 0);
  const jobsTotal = Number(overviewMetrics.jobs?.total || 0);

  const stats = [
    {
      label: "ATS Score",
      value: overviewMetrics.resume ? `${atsScore}` : "--",
      unit: overviewMetrics.resume ? "/100" : "",
      icon: "award",
      trend: overviewMetrics.resume ? "Resume analyzed" : "Upload resume to start",
    },
    {
      label: "JD Match",
      value: resumeContext.matchResult ? `${jdMatch}` : "--",
      unit: resumeContext.matchResult ? "%" : "",
      icon: "target",
      trend: resumeContext.matchResult ? "Latest JD analysis" : "Analyze a JD",
    },
    {
      label: "Quiz Score",
      value: overviewMetrics.quiz ? `${quizScore}` : "--",
      unit: overviewMetrics.quiz ? "%" : "",
      icon: "zap",
      trend: overviewMetrics.quiz
        ? `${overviewMetrics.quiz.domain || "Quiz"} • ${overviewMetrics.quiz.difficulty || ""}`
        : "Complete a quiz",
    },
    {
      label: "Jobs Saved",
      value: `${jobsSaved}`,
      unit: jobsTotal > 0 ? `/ ${jobsTotal} found` : "",
      icon: "jobs",
      trend: jobsTotal > 0 ? "From latest search" : "Search jobs to populate",
    },
  ];

  const progressRows = [
    { label: "Resume strength", value: atsScore, sublabel: overviewMetrics.resume ? `${atsScore}%` : "No data" },
    { label: "JD match rate", value: jdMatch, sublabel: resumeContext.matchResult ? `${jdMatch}%` : "No data" },
    {
      label: "Roadmap completion",
      value: Number(overviewMetrics.roadmap?.overallProgress || 0),
      sublabel: overviewMetrics.roadmap?.generated
        ? `${overviewMetrics.roadmap.completedTasks || 0}/${overviewMetrics.roadmap.totalTasks || 0} tasks`
        : "No roadmap yet",
    },
    {
      label: "Interview score",
      value: interviewScore,
      sublabel: overviewMetrics.interview?.completed ? `${interviewScore}%` : "Not completed",
    },
  ];

  const tasks = [
    { task: "Upload and parse resume", done: Boolean(resumeContext.resumeId) },
    { task: "Run ATS analysis", done: Boolean(overviewMetrics.resume) },
    { task: "Analyze JD match", done: Boolean(resumeContext.matchResult) },
    { task: "Generate roadmap", done: Boolean(overviewMetrics.roadmap?.generated) },
    { task: "Complete adaptive quiz", done: Boolean(overviewMetrics.quiz?.completed) },
    { task: "Complete mock interview", done: Boolean(overviewMetrics.interview?.completed) },
    { task: "Save at least one job", done: jobsSaved > 0 },
  ];

  return (
    <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: 24, animation: "fadeIn 0.4s ease" }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: isDarkMode ? "#e8eef7" : "var(--gray-900)", letterSpacing: "-0.04em", marginBottom: 4 }}>Good morning, Student ✦</h2>
        <p style={{ fontSize: 13.5, color: isDarkMode ? "#b4c3d9" : "var(--gray-500)" }}>This view updates from your real resume, JD, roadmap, quiz, interview, and jobs activity.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {stats.map(s => (
          <Card key={s.label} isDarkMode={isDarkMode} style={{ padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: isDarkMode ? "rgba(91,127,196,0.15)" : "var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={s.icon} size={16} color={isDarkMode ? "#6b93d6" : "var(--gray-600)"}/>
              </div>
              <Badge style={{ background: isDarkMode ? "rgba(91,127,196,0.15)" : undefined, color: isDarkMode ? "#8a9bb5" : undefined, borderColor: isDarkMode ? "rgba(91,127,196,0.3)" : undefined }}>{s.trend}</Badge>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: isDarkMode ? "#e8eef7" : "var(--gray-900)", letterSpacing: "-0.04em", lineHeight: 1 }}>
              {s.value}<span style={{ fontSize: 13, color: isDarkMode ? "#8a9bb5" : "var(--gray-400)", fontWeight: 500, marginLeft: 3 }}>{s.unit}</span>
            </div>
            <div style={{ fontSize: 12, color: isDarkMode ? "#8a9bb5" : "var(--gray-400)", marginTop: 6, fontWeight: 500 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
        <Card isDarkMode={isDarkMode}>
          <div style={{ fontSize: 13.5, fontWeight: 650, color: isDarkMode ? "#e8eef7" : "var(--gray-900)", marginBottom: 18, letterSpacing: "-0.02em" }}>Weekly Progress</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {progressRows.map((row) => (
              <ProgressBar key={row.label} value={Math.max(0, Math.min(100, row.value))} label={row.label} sublabel={row.sublabel} isDarkMode={isDarkMode}/>
            ))}
          </div>
        </Card>
        <Card isDarkMode={isDarkMode}>
          <div style={{ fontSize: 13.5, fontWeight: 650, color: isDarkMode ? "#e8eef7" : "var(--gray-900)", marginBottom: 18, letterSpacing: "-0.02em" }}>Today's Tasks</div>
          {tasks.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < tasks.length - 1 ? (isDarkMode ? "1px solid rgba(70,100,150,0.2)" : "1px solid var(--gray-100)") : "none" }}>
              <div style={{
                width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${t.done ? (isDarkMode ? "#6b93d6" : "var(--gray-700)") : (isDarkMode ? "rgba(91,127,196,0.3)" : "var(--gray-250)")}`,
                background: t.done ? (isDarkMode ? "#6b93d6" : "var(--gray-900)") : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {t.done && <Icon name="check" size={10} color="white"/>}
              </div>
              <span style={{ fontSize: 13, color: t.done ? (isDarkMode ? "#8a9bb5" : "var(--gray-400)") : (isDarkMode ? "#e8eef7" : "var(--gray-700)"), textDecoration: t.done ? "line-through" : "none", fontWeight: 500 }}>{t.task}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};

// ─── Resume Analyzer ──────────────────────────────────────────────────────────
const ResumeAnalyzer = ({ onResumeParsed, onResumeAnalyzed, isDarkMode, isActive = false }) => {
  const [uploaded, setUploaded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [resumeId, setResumeId] = useState(null);
  const [resumeData, setResumeData] = useState(null);
  const [atsScore, setAtsScore] = useState(0);
  const [scoreBreakdown, setScoreBreakdown] = useState({
    formatting_score: 0,
    keyword_match: 0,
    readability_score: 0
  });
  const [issues, setIssues] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [applyToAllRoutes, setApplyToAllRoutes] = useState(true);
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [isLoadingApiKeyStatus, setIsLoadingApiKeyStatus] = useState(true);
  const [currentMaskedKey, setCurrentMaskedKey] = useState("");
  const [isUserApiKeyConfigured, setIsUserApiKeyConfigured] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState({ type: "", message: "" });
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const fetchApiKeyStatus = async () => {
      setIsLoadingApiKeyStatus(true);
      try {
        const response = await fetch("/api/settings/api-key/status");
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.detail || data?.message || "Could not load API key status");
        }
        if (!cancelled) {
          const configured = Boolean(data?.user_configured);
          const masked = configured
            ? String(data?.user_masked_key || data?.masked_key || "")
            : "";
          setIsUserApiKeyConfigured(configured);
          setCurrentMaskedKey(masked);
        }
      } catch {
        if (!cancelled) {
          setIsUserApiKeyConfigured(false);
          setCurrentMaskedKey("");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingApiKeyStatus(false);
        }
      }
    };

    fetchApiKeyStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveApiKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setApiKeyStatus({ type: "error", message: "Please paste an API key first." });
      return;
    }

    setIsSavingApiKey(true);
    setApiKeyStatus({ type: "", message: "" });

    try {
      const formData = new FormData();
      formData.append("api_key", trimmed);
      formData.append("apply_to_all_routes", String(applyToAllRoutes));

      const response = await fetch("/api/settings/api-key", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || "Failed to save API key");
      }

      setApiKeyStatus({
        type: "success",
        message: `Saved successfully (${data?.masked_key || "key updated"}).`,
      });
      setIsUserApiKeyConfigured(true);
      setCurrentMaskedKey(String(data?.masked_key || ""));
      setApiKeyInput("");
    } catch (error) {
      setApiKeyStatus({ type: "error", message: error.message || "Unable to save API key." });
    } finally {
      setIsSavingApiKey(false);
    }
  };

  const uploadResumeFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const uploadResponse = await fetch('/api/resume/upload', {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      let message = 'Upload failed';
      try {
        const errorData = await uploadResponse.json();
        message = errorData?.detail || errorData?.message || message;
      } catch {
        // Keep the default message when backend does not return JSON.
      }
      throw new Error(message);
    }

    return await uploadResponse.json();
  };

  const analyzeResumeById = async (resumeId) => {
    const analyzeFormData = new FormData();
    analyzeFormData.append('resume_id', resumeId);
    analyzeFormData.append('target_role', 'Software Engineer');

    const analyzeResponse = await fetch('/api/resume/analyze', {
      method: 'POST',
      body: analyzeFormData,
    });

    if (!analyzeResponse.ok) {
      let message = 'Analysis failed';
      try {
        const errorData = await analyzeResponse.json();
        message = errorData?.detail || errorData?.message || message;
      } catch {
        // Keep the default message when backend does not return JSON.
      }
      const err = new Error(message);
      err.status = analyzeResponse.status;
      throw err;
    }

    return await analyzeResponse.json();
  };

  const normalizeWarningText = (message) => {
    const raw = String(message || "").trim();
    if (!raw) return "AI provider unavailable";
    const prefix = /^ai api request failed:\s*/i;
    let cleaned = raw;
    while (prefix.test(cleaned)) {
      cleaned = cleaned.replace(prefix, "").trim();
    }
    return cleaned.replace(/[:\s]+$/, "") || "AI provider unavailable";
  };

  const dedupeIssues = (items) => {
    const seen = new Set();
    return items.filter((item) => {
      const key = String(item?.text || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const handleDownloadReport = () => {
    if (!uploaded) return;

    const lines = [
      "SkillBridge Resume Report",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      `Candidate: ${candidateName}`,
      `File: ${fileName || "N/A"}`,
      `ATS Score: ${atsScore}`,
      `Formatting: ${scoreBreakdown.formatting_score}%`,
      `Keywords: ${scoreBreakdown.keyword_match}%`,
      `Impact: ${scoreBreakdown.readability_score}%`,
      "",
      "Top Skills:",
      ...(topSkills.length ? topSkills.map((skill) => `- ${skill}`) : ["- None detected"]),
      "",
      "Issues:",
      ...(issues.length ? issues.map((issue) => `- [${issue.type}] ${issue.text}`) : ["- No issues detected"]),
      "",
      "Suggestions:",
      ...(suggestions.length ? suggestions.map((s) => `- ${s}`) : ["- No suggestions available"]),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${candidateName.replace(/\s+/g, "_") || "resume"}_report.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const applyAnalyzeResult = ({ analyzeData, parsedResume, parsedResumeId, source }) => {
    setResumeId(parsedResumeId);
    setResumeData(parsedResume);
    onResumeParsed?.(parsedResumeId, parsedResume);

    const nextAtsScore = analyzeData.ats_analysis?.score || 0;
    const nextBreakdown = {
      formatting_score: analyzeData.ats_analysis?.formatting_score || 0,
      keyword_match: Math.round((analyzeData.ats_analysis?.keyword_match || 0) * 100),
      readability_score: analyzeData.ats_analysis?.readability_score || 0
    };

    setAtsScore(nextAtsScore);
    setScoreBreakdown(nextBreakdown);
    onResumeAnalyzed?.({
      atsScore: nextAtsScore,
      scoreBreakdown: nextBreakdown,
      analyzedAt: new Date().toISOString(),
      source,
    });

    const problemIssues = (analyzeData.problems || []).map(p => ({
      type: p.severity === 'high' ? 'error' : p.severity === 'medium' ? 'warning' : 'info',
      text: p.issue
    }));
    if (analyzeData.ats_model_warning) {
      const normalizedAtsWarning = normalizeWarningText(analyzeData.ats_model_warning);
      const isGenericAtsWarning = ["ai provider unavailable", "model unavailable"].includes(normalizedAtsWarning.toLowerCase());
      if (!isGenericAtsWarning) {
      problemIssues.push({
        type: 'warning',
        text: `ATS model unavailable: ${normalizedAtsWarning}`,
      });
      }
    }
    if (analyzeData.bullet_improvement_warning) {
      problemIssues.push({
        type: 'warning',
        text: `Bullet improvement model unavailable: ${normalizeWarningText(analyzeData.bullet_improvement_warning)}`,
      });
    }
    setIssues(dedupeIssues(problemIssues));

    const allSuggestions = [];
    if (analyzeData.detailed_ats_analysis?.suggestions) {
      const sug = analyzeData.detailed_ats_analysis.suggestions;
      allSuggestions.push(...(sug.improve_keywords || []));
      allSuggestions.push(...(sug.enhance_experience || []));
      allSuggestions.push(...(sug.formatting_fixes || []));
    }
    setSuggestions(allSuggestions.slice(0, 5));
    setUploaded(true);
  };

  const handleFileSelect = async (file) => {
    if (file) {
      setLoading(true);
      setLoadingStage("Uploading resume to SkillBridge...");
      setUploaded(false);
      setResumeData(null);
      setAtsScore(0);
      setScoreBreakdown({ formatting_score: 0, keyword_match: 0, readability_score: 0 });
      setIssues([]);
      setSuggestions([]);

      const sizeInKB = Math.round(file.size / 1024);
      setFileName(file.name);
      setFileSize(`${sizeInKB} KB`);
      let extractedResume = null;
      let extractedResumeId = null;
      
      try {
        // Upload resume
        let uploadData = await uploadResumeFile(file);
        extractedResumeId = uploadData.resume_id;
        extractedResume = uploadData.resume;

        // Analyze resume. If backend memory was reset between upload and analyze,
        // retry once by re-uploading the same file to obtain a fresh resume_id.
        setLoadingStage("Running ATS and project-fit analysis...");
        let analyzeData;
        try {
          analyzeData = await analyzeResumeById(extractedResumeId);
        } catch (analysisError) {
          if (analysisError?.status === 404) {
            setLoadingStage("Refreshing resume context and retrying analysis...");
            uploadData = await uploadResumeFile(file);
            extractedResumeId = uploadData.resume_id;
            extractedResume = uploadData.resume;
            setLoadingStage("Running ATS and project-fit analysis...");
            analyzeData = await analyzeResumeById(extractedResumeId);
          } else {
            throw analysisError;
          }
        }

        setLoadingStage("Generating project-ready improvement suggestions...");
        applyAnalyzeResult({
          analyzeData,
          parsedResume: extractedResume,
          parsedResumeId: extractedResumeId,
          source: "upload",
        });
      } catch (error) {
        console.error('Error:', error);
        if (extractedResume && extractedResumeId) {
          setResumeId(extractedResumeId);
          setResumeData(extractedResume);
          onResumeParsed?.(extractedResumeId, extractedResume);
          setAtsScore(0);
          setScoreBreakdown({ formatting_score: 0, keyword_match: 0, readability_score: 0 });
          setIssues([{ type: "error", text: error?.message || "Failed to analyze resume. Please try again." }]);
          setSuggestions(["Ensure resume is in PDF or DOCX format"]);
          setUploaded(true);
        } else {
          setUploaded(false);
          setIssues([{ type: "error", text: error?.message || "Failed to upload resume. Please try again." }]);
        }
      } finally {
        setLoading(false);
        setLoadingStage("");
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === "application/pdf" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")) {
      handleFileSelect(file);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleSampleResume = async () => {
    setLoading(true);
    setLoadingStage("Loading sample resume profile...");
    setUploaded(false);
    setResumeData(null);
    setAtsScore(0);
    setScoreBreakdown({ formatting_score: 0, keyword_match: 0, readability_score: 0 });
    setIssues([]);
    setSuggestions([]);

    let parsedResume = null;
    let parsedResumeId = null;
    try {
      // Get sample resume
      const sampleResponse = await fetch('/api/resume/sample');
      const sampleData = await sampleResponse.json();
      
      setFileName("Sample_Resume.pdf");
      setFileSize("245 KB");
      parsedResumeId = sampleData.resume_id;
      parsedResume = sampleData.resume;
      
      // Analyze sample resume
      const analyzeFormData = new FormData();
      analyzeFormData.append('resume_id', parsedResumeId);
      analyzeFormData.append('target_role', 'Software Engineer');
      setLoadingStage("Running ATS and project-fit analysis...");
      
      const analyzeResponse = await fetch('/api/resume/analyze', {
        method: 'POST',
        body: analyzeFormData,
      });

      if (!analyzeResponse.ok) {
        let message = 'Analysis failed';
        try {
          const errorData = await analyzeResponse.json();
          message = errorData?.detail || errorData?.message || message;
        } catch {
          // Keep default message when backend does not return JSON.
        }
        throw new Error(message);
      }
      
      const analyzeData = await analyzeResponse.json();
      setLoadingStage("Generating project-ready improvement suggestions...");

      applyAnalyzeResult({
        analyzeData,
        parsedResume,
        parsedResumeId,
        source: "sample",
      });
    } catch (error) {
      console.error('Error:', error);
      setFileName("Sample_Resume.pdf");
      setFileSize("245 KB");
      if (parsedResume && parsedResumeId) {
        setResumeId(parsedResumeId);
        setResumeData(parsedResume);
        onResumeParsed?.(parsedResumeId, parsedResume);
        setAtsScore(0);
        setScoreBreakdown({ formatting_score: 0, keyword_match: 0, readability_score: 0 });
        setIssues([{ type: "error", text: "Failed to load sample resume analysis" }]);
        setSuggestions([]);
        setUploaded(true);
      } else {
        setUploaded(false);
        setIssues([{ type: "error", text: "Failed to load sample resume" }]);
      }
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  const handleResetResume = () => {
    setUploaded(false);
    setFileName("");
    setFileSize("");
    setResumeId(null);
    setResumeData(null);
    setAtsScore(0);
    setScoreBreakdown({ formatting_score: 0, keyword_match: 0, readability_score: 0 });
    setIssues([]);
    setSuggestions([]);
  };

  const candidateName = resumeData?.name || fileName?.replace(/\.[^.]+$/, "") || "Candidate";
  const topSkills = (resumeData?.skills || []).slice(0, 8).map((skill) => (typeof skill === "string" ? skill : skill.name));
  const experienceCount = resumeData?.experiences?.length || 0;
  const educationCount = resumeData?.education?.length || 0;
  const projectCount = resumeData?.projects?.length || 0;
  const scoreItems = [
    { label: "Formatting", val: scoreBreakdown.formatting_score, accent: isDarkMode ? "#8db2ff" : "#111827" },
    { label: "Keywords", val: scoreBreakdown.keyword_match, accent: "#10b981" },
    { label: "Impact", val: scoreBreakdown.readability_score, accent: "#f59e0b" },
  ];
  const scoreStatus = atsScore >= 80 ? "Strong match" : atsScore >= 60 ? "Needs polish" : "Rework recommended";
  const scoreStatusVariant = atsScore >= 80 ? "success" : atsScore >= 60 ? "warning" : "error";
  const intakeHighlights = [
    { label: "Skills mapped", value: topSkills.length, hint: "Core strengths captured" },
    { label: "Projects found", value: projectCount, hint: "Proof-of-work detected" },
    { label: "Experience blocks", value: experienceCount, hint: "Career timeline parsed" },
  ];

  return (
    <>
      <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 22, animation: "fadeIn 0.4s ease" }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: isDarkMode ? "#e8eef7" : "var(--gray-900)", letterSpacing: "-0.04em", marginBottom: 4 }}>Resume Analyzer</h2>
        <p style={{ fontSize: 13.5, color: isDarkMode ? "#b4c3d9" : "var(--gray-500)", maxWidth: 760 }}>Turn a raw resume into a role-ready profile with ATS scoring, extracted career signals, and project-focused improvement guidance.</p>
      </div>

      <ApiKeySettingsPanel
        isDarkMode={isDarkMode}
        apiKey={apiKeyInput}
        setApiKey={setApiKeyInput}
        applyToAllRoutes={applyToAllRoutes}
        setApplyToAllRoutes={setApplyToAllRoutes}
        isSaving={isSavingApiKey}
        isLoadingStatus={isLoadingApiKeyStatus}
        currentMaskedKey={currentMaskedKey}
        status={apiKeyStatus}
        onSave={handleSaveApiKey}
      />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 0.82fr)", gap: 18, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Upload */}
          {!uploaded ? (
            <div>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragging ? (isDarkMode ? "#6b93d6" : "var(--gray-600)") : (isDarkMode ? "rgba(91,127,196,0.4)" : "var(--gray-200)")}`,
                  borderRadius: 28, padding: "40px 32px",
                  textAlign: "center", cursor: loading ? "wait" : "pointer",
                  background: isDarkMode ? "linear-gradient(145deg, rgba(37,52,71,0.96), rgba(27,37,51,0.92))" : "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(246,248,251,0.96))",
                  boxShadow: isDarkMode ? "0 18px 42px rgba(0,0,0,0.22)" : "0 24px 56px rgba(15,23,42,0.08)",
                  position: "relative",
                  overflow: "hidden",
                  transition: "all var(--transition)",
                  opacity: loading ? 0.6 : 1,
                  pointerEvents: loading ? "none" : "auto",
                }}>
                <div style={{ position: "absolute", inset: 0, background: isDarkMode ? "radial-gradient(circle at top right, rgba(107,147,214,0.18), transparent 42%), radial-gradient(circle at bottom left, rgba(34,197,94,0.12), transparent 38%)" : "radial-gradient(circle at top right, rgba(17,24,39,0.08), transparent 38%), radial-gradient(circle at bottom left, rgba(16,185,129,0.08), transparent 34%)", pointerEvents: "none" }}/>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, marginBottom: 18, background: isDarkMode ? "rgba(143,176,227,0.12)" : "rgba(17,24,39,0.05)", border: isDarkMode ? "1px solid rgba(122,147,193,0.25)" : "1px solid rgba(17,24,39,0.08)", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: isDarkMode ? "#cfe0ff" : "#374151", position: "relative" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: loading ? "#f59e0b" : "#10b981", boxShadow: loading ? "0 0 0 6px rgba(245,158,11,0.16)" : "0 0 0 6px rgba(16,185,129,0.12)" }}/>
                  Career Intelligence Pipeline
                </div>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: isDarkMode ? "rgba(91,127,196,0.15)" : "var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Icon name="upload" size={22} color={isDarkMode ? "#6b93d6" : "var(--gray-500)"}/>
                </div>
                <div style={{ fontSize: "clamp(24px, 3vw, 32px)", lineHeight: 1.05, fontWeight: 800, letterSpacing: "-0.05em", color: isDarkMode ? "#f5f9ff" : "#111827", marginBottom: 10, maxWidth: 620, marginLeft: "auto", marginRight: "auto", position: "relative" }}>
                  {loading ? "Processing resume..." : "Drop your resume into the workspace"}
                </div>
                <div style={{ margin: "0 auto 14px", maxWidth: 620, fontSize: 13.5, lineHeight: 1.7, color: isDarkMode ? "#b4c3d9" : "#6b7280", position: "relative" }}>
                  We extract your experience, surface weak signals, and translate the resume into actionable career fixes that connect with the rest of SkillBridge.
                </div>
                {loading && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 12.5, color: isDarkMode ? "#b4c3d9" : "var(--gray-500)", fontWeight: 500 }}>
                      Please wait a few mins. SkillBridge is evaluating ATS quality, skills, and project evidence...
                    </div>
                    <div style={{ fontSize: 12, color: isDarkMode ? "#8a9bb5" : "var(--gray-400)", fontWeight: 600, letterSpacing: "0.02em" }}>
                      {loadingStage || "Running ATS and project-fit analysis..."}
                    </div>
                    <div style={{ width: "min(420px, 100%)", height: 6, borderRadius: 999, background: isDarkMode ? "rgba(122,147,193,0.18)" : "rgba(17,24,39,0.08)", overflow: "hidden" }}>
                      <div style={{ width: "65%", height: "100%", borderRadius: 999, background: isDarkMode ? "linear-gradient(90deg, #6b93d6, #22c55e)" : "linear-gradient(90deg, #111827, #10b981)", animation: "shimmer 1.8s linear infinite" }}/>
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 13, color: isDarkMode ? "#8a9bb5" : "var(--gray-400)", marginBottom: 20, position: "relative" }}>PDF supported | Max 5MB</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileInputChange}
                  style={{ display: "none" }}
                />
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", position: "relative" }}>
                  <Btn variant="secondary" onClick={handleBrowseClick} style={{ padding: "10px 22px", fontSize: 13, background: isDarkMode ? "#253447" : undefined, color: isDarkMode ? "#e8eef7" : undefined, borderColor: isDarkMode ? "rgba(91,127,196,0.3)" : undefined }}>Browse files</Btn>
                  <Btn variant="ghost" onClick={handleSampleResume} style={{ padding: "10px 22px", fontSize: 13, color: isDarkMode ? "#b4c3d9" : undefined }}>Use sample resume</Btn>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <Card isDarkMode={isDarkMode} style={{ padding: "22px 24px", overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", top: -80, right: -20, width: 220, height: 220, borderRadius: "50%", background: isDarkMode ? "radial-gradient(circle, rgba(107,147,214,0.22), transparent 72%)" : "radial-gradient(circle, rgba(17,24,39,0.08), transparent 72%)", pointerEvents: "none" }}/>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, position: "relative" }}>
                  <div style={{ width: 50, height: 50, borderRadius: 16, background: isDarkMode ? "rgba(91,127,196,0.15)" : "var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="resume" size={20} color={isDarkMode ? "#8db2ff" : "var(--gray-700)"}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                      <div style={{ fontSize: "clamp(20px, 2.6vw, 28px)", fontWeight: 800, letterSpacing: "-0.05em", color: isDarkMode ? "#f5f9ff" : "#111827" }}>{candidateName}</div>
                      <Badge variant="success">Analysis ready</Badge>
                    </div>
                    <div style={{ fontSize: 13.5, color: isDarkMode ? "#b4c3d9" : "var(--gray-500)", marginBottom: 14 }}>
                      {fileName} | {fileSize} | Resume intelligence mapped into SkillBridge
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                      {intakeHighlights.map((item) => (
                        <div key={item.label} style={{ padding: "14px 14px 12px", borderRadius: 16, background: isDarkMode ? "rgba(18,26,38,0.52)" : "rgba(249,250,251,0.95)", border: isDarkMode ? "1px solid rgba(122,147,193,0.18)" : "1px solid rgba(17,24,39,0.05)" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: isDarkMode ? "#8a9bb5" : "#9ca3af", marginBottom: 8 }}>{item.label}</div>
                          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em", color: isDarkMode ? "#f5f9ff" : "#111827" }}>{item.value}</div>
                          <div style={{ marginTop: 8, fontSize: 12, color: isDarkMode ? "#b4c3d9" : "#6b7280" }}>{item.hint}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleResetResume} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                    <Icon name="x" size={16} color={isDarkMode ? "#8a9bb5" : "var(--gray-400)"}/>
                  </button>
                </div>
              </Card>

              {/* Extracted Information */}
              {resumeData && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: isDarkMode ? "#e8eef7" : "var(--gray-900)", marginBottom: 14 }}>Extracted intelligence</div>
                  
                  {/* Personal Info Card */}
                  {(resumeData.name || resumeData.email || resumeData.phone) && (
                    <Card isDarkMode={isDarkMode} style={{ marginBottom: 12, padding: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: isDarkMode ? "#8a9bb5" : "#9ca3af" }}>Identity layer</div>
                        <div style={{ fontSize: 12.5, color: isDarkMode ? "#b4c3d9" : "#6b7280" }}>Core contact fields detected</div>
                      </div>
                      {resumeData.name && <div style={{ fontSize: 17, fontWeight: 700, color: isDarkMode ? "#e8eef7" : "var(--gray-900)", marginBottom: 12 }}>{resumeData.name}</div>}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {resumeData.email && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 14 }}>📧</span>
                            <span style={{ fontSize: 13, color: isDarkMode ? "#b4c3d9" : "var(--gray-600)" }}>{resumeData.email}</span>
                          </div>
                        )}
                        {resumeData.phone && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 14 }}>📱</span>
                            <span style={{ fontSize: 13, color: isDarkMode ? "#b4c3d9" : "var(--gray-600)" }}>{resumeData.phone}</span>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                  {/* Skills Card */}
                  {resumeData.skills && resumeData.skills.length > 0 && (
                    <Card isDarkMode={isDarkMode} style={{ marginBottom: 12, padding: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 14, fontWeight: 650, color: isDarkMode ? "#e8eef7" : "var(--gray-900)" }}>Skills graph</div>
                        <div style={{ fontSize: 12.5, color: isDarkMode ? "#8a9bb5" : "#6b7280" }}>{resumeData.skills.length} strengths extracted</div>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {resumeData.skills.map((skill, i) => (
                          <span key={i} style={{
                            padding: "6px 12px", borderRadius: 8,
                            background: isDarkMode ? "rgba(91,127,196,0.15)" : "var(--gray-100)", fontSize: 12.5,
                            color: isDarkMode ? "#b4c3d9" : "var(--gray-700)", fontWeight: 500,
                            border: isDarkMode ? "1px solid rgba(91,127,196,0.3)" : "1px solid var(--gray-200)",
                          }}>{typeof skill === 'string' ? skill : skill.name}</span>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Experience Card */}
                  {resumeData.experiences && resumeData.experiences.length > 0 && (
                    <Card isDarkMode={isDarkMode} style={{ marginBottom: 12, padding: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 14, fontWeight: 650, color: isDarkMode ? "#e8eef7" : "var(--gray-900)" }}>Experience timeline</div>
                        <div style={{ fontSize: 12.5, color: isDarkMode ? "#8a9bb5" : "#6b7280" }}>{experienceCount} role blocks</div>
                      </div>
                      {resumeData.experiences.map((exp, i) => (
                        <div key={i} style={{ 
                          marginBottom: i < resumeData.experiences.length - 1 ? 16 : 0,
                          paddingBottom: i < resumeData.experiences.length - 1 ? 16 : 0,
                          borderBottom: i < resumeData.experiences.length - 1 ? (isDarkMode ? "1px solid rgba(70,100,150,0.2)" : "1px solid var(--gray-100)") : "none"
                        }}>
                          {exp.title && <div style={{ fontSize: 14, fontWeight: 650, color: isDarkMode ? "#e8eef7" : "var(--gray-900)", marginBottom: 4 }}>{exp.title}</div>}
                          {(exp.company || exp.duration) && (
                            <div style={{ fontSize: 12.5, color: isDarkMode ? "#8a9bb5" : "var(--gray-500)", marginBottom: 6 }}>
                              {exp.company}{exp.company && exp.duration ? ' · ' : ''}{exp.duration}
                            </div>
                          )}
                          {exp.description && Array.isArray(exp.description) && exp.description.length > 0 && (
                            <div style={{ fontSize: 12.5, color: isDarkMode ? "#b4c3d9" : "var(--gray-600)", lineHeight: 1.6 }}>
                              {exp.description.join('. ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </Card>
                  )}

                  {/* Education Card */}
                  {resumeData.education && resumeData.education.length > 0 && (
                    <Card isDarkMode={isDarkMode} style={{ marginBottom: 12, padding: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 14, fontWeight: 650, color: isDarkMode ? "#e8eef7" : "var(--gray-900)" }}>Education</div>
                        <div style={{ fontSize: 12.5, color: isDarkMode ? "#8a9bb5" : "#6b7280" }}>{educationCount} entries parsed</div>
                      </div>
                      {resumeData.education.map((edu, i) => (
                        <div key={i} style={{ 
                          marginBottom: i < resumeData.education.length - 1 ? 14 : 0,
                          paddingBottom: i < resumeData.education.length - 1 ? 14 : 0,
                          borderBottom: i < resumeData.education.length - 1 ? (isDarkMode ? "1px solid rgba(70,100,150,0.2)" : "1px solid var(--gray-100)") : "none"
                        }}>
                          {edu.degree && <div style={{ fontSize: 14, fontWeight: 650, color: isDarkMode ? "#e8eef7" : "var(--gray-900)", marginBottom: 4 }}>{edu.degree}</div>}
                          {(edu.institution || edu.year) && (
                            <div style={{ fontSize: 12.5, color: isDarkMode ? "#8a9bb5" : "var(--gray-500)", marginBottom: 4 }}>
                              {edu.institution}{edu.institution && edu.year ? ' · ' : ''}{edu.year}
                            </div>
                          )}
                          {edu.gpa && <div style={{ fontSize: 12.5, color: isDarkMode ? "#b4c3d9" : "var(--gray-600)" }}>CGPA: {edu.gpa}</div>}
                        </div>
                      ))}
                    </Card>
                  )}

                  {/* Projects Card */}
                  {resumeData.projects && resumeData.projects.length > 0 && (
                    <Card isDarkMode={isDarkMode} style={{ marginBottom: 12, padding: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 14, fontWeight: 650, color: isDarkMode ? "#e8eef7" : "var(--gray-900)" }}>Project evidence</div>
                        <div style={{ fontSize: 12.5, color: isDarkMode ? "#8a9bb5" : "#6b7280" }}>{projectCount} project signals</div>
                      </div>
                      {resumeData.projects.map((proj, i) => (
                        <div key={i} style={{ 
                          marginBottom: i < resumeData.projects.length - 1 ? 14 : 0,
                          paddingBottom: i < resumeData.projects.length - 1 ? 14 : 0,
                          borderBottom: i < resumeData.projects.length - 1 ? (isDarkMode ? "1px solid rgba(70,100,150,0.2)" : "1px solid var(--gray-100)") : "none"
                        }}>
                          {proj.name && (
                            <div style={{ fontSize: 13.5, fontWeight: 650, color: isDarkMode ? "#e8eef7" : "var(--gray-900)", marginBottom: 8 }}>
                              {proj.name}
                            </div>
                          )}
                          {proj.technologies && proj.technologies.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                              {proj.technologies.map((tech, j) => (
                                <span key={j} style={{
                                  padding: "4px 10px", borderRadius: 6,
                                  background: isDarkMode ? "rgba(91,127,196,0.15)" : "var(--gray-100)", fontSize: 11.5,
                                  color: isDarkMode ? "#b4c3d9" : "var(--gray-600)", fontWeight: 500,
                                  border: isDarkMode ? "1px solid rgba(91,127,196,0.3)" : "1px solid var(--gray-200)",
                                }}>{tech}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </Card>
                  )}
                </div>
              )}

              {/* Issues */}
              <Card isDarkMode={isDarkMode} style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 650, color: isDarkMode ? "#e8eef7" : "var(--gray-900)" }}>Priority fixes</div>
                  <div style={{ fontSize: 12.5, color: isDarkMode ? "#8a9bb5" : "#6b7280" }}>{issues.length} issues identified</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {issues.map((issue, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      padding: "10px 14px", borderRadius: 10,
                      background: issue.type === "error" ? (isDarkMode ? "rgba(239,68,68,0.15)" : "#fef2f2") : issue.type === "warning" ? (isDarkMode ? "rgba(245,158,11,0.15)" : "#fffbeb") : (isDarkMode ? "rgba(91,127,196,0.1)" : "var(--gray-50)"),
                      border: `1px solid ${issue.type === "error" ? (isDarkMode ? "rgba(239,68,68,0.3)" : "#fecaca") : issue.type === "warning" ? (isDarkMode ? "rgba(245,158,11,0.3)" : "#fde68a") : (isDarkMode ? "rgba(91,127,196,0.2)" : "var(--gray-150)")}`,
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", marginTop: 5, flexShrink: 0, background: issue.type === "error" ? "#ef4444" : issue.type === "warning" ? "#f59e0b" : (isDarkMode ? "#6b93d6" : "var(--gray-400)") }}/>
                      <span style={{ fontSize: 13, color: isDarkMode ? "#e8eef7" : "var(--gray-700)", lineHeight: 1.5 }}>{issue.text}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Suggestions */}
              <Card isDarkMode={isDarkMode} style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 650, color: isDarkMode ? "#e8eef7" : "var(--gray-900)" }}>AI suggestions</div>
                  <div style={{ fontSize: 12.5, color: isDarkMode ? "#8a9bb5" : "#6b7280" }}>What to improve next</div>
                </div>
                {suggestions.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < suggestions.length - 1 ? (isDarkMode ? "1px solid rgba(70,100,150,0.2)" : "1px solid var(--gray-100)") : "none" }}>
                    <Icon name="zap" size={14} color={isDarkMode ? "#6b93d6" : "var(--gray-400)"} style={{ marginTop: 2, flexShrink: 0 }}/>
                    <span style={{ fontSize: 13, color: isDarkMode ? "#b4c3d9" : "var(--gray-600)", lineHeight: 1.6 }}>{s}</span>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>

        {/* Score */}
        <Card isDarkMode={isDarkMode} style={{ padding: "26px 22px", textAlign: "center", position: "sticky", top: 20, overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: isDarkMode ? "radial-gradient(circle at top, rgba(107,147,214,0.16), transparent 36%)" : "radial-gradient(circle at top, rgba(17,24,39,0.06), transparent 36%)" }}/>
          <div style={{ position: "relative" }}>
          <div style={{ fontSize: 12, color: isDarkMode ? "#8a9bb5" : "var(--gray-400)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Resume health</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.05em", color: isDarkMode ? "#f5f9ff" : "#111827", marginBottom: 6 }}>ATS Score</div>
          <div style={{ fontSize: 13, color: isDarkMode ? "#b4c3d9" : "#6b7280", marginBottom: 18 }}>A fast read on readiness for recruiter systems and hiring screens.</div>
          <CircularProgress value={uploaded ? atsScore : 0} size={140} label="Score" isDarkMode={isDarkMode}/>
          {loading && <div style={{ fontSize: 12, color: isDarkMode ? "#b4c3d9" : "var(--gray-500)", marginTop: 10 }}>{loadingStage || "Analyzing..."}</div>}
          {uploaded && <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}><Badge variant={scoreStatusVariant}>{scoreStatus}</Badge></div>}
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14, textAlign: "left" }}>
            {scoreItems.map(item => (
              <div key={item.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, color: isDarkMode ? "#b4c3d9" : "var(--gray-500)", fontWeight: 600 }}>
                  <span>{item.label}</span><span>{item.val}%</span>
                </div>
                <div style={{ height: 5, background: isDarkMode ? "rgba(91,127,196,0.2)" : "var(--gray-100)", borderRadius: 99 }}>
                  <div style={{ height: "100%", borderRadius: 99, width: `${uploaded ? item.val : 0}%`, background: item.accent, transition: "width 1s ease" }}/>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, padding: "14px 14px 0", borderTop: isDarkMode ? "1px solid rgba(122,147,193,0.18)" : "1px solid rgba(17,24,39,0.06)", textAlign: "left" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: isDarkMode ? "#8a9bb5" : "#9ca3af", marginBottom: 10 }}>System readout</div>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: isDarkMode ? "#dbe8fb" : "#374151" }}><span>Projects surfaced</span><strong>{projectCount}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: isDarkMode ? "#dbe8fb" : "#374151" }}><span>Issues flagged</span><strong>{issues.length}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: isDarkMode ? "#dbe8fb" : "#374151" }}><span>Suggestions queued</span><strong>{suggestions.length}</strong></div>
            </div>
          </div>
          {uploaded && <Btn variant="primary" onClick={handleDownloadReport} style={{ marginTop: 20, width: "100%", justifyContent: "center", padding: "10px", ...(isDarkMode ? { background: "#5b7fc4" } : {}) }}>Download report</Btn>}
          </div>
        </Card>
      </div>
      </div>
    </>
  );
}

// ─── JD Matcher ───────────────────────────────────────────────────────────────
const JDMatcher = ({ resumeId, initialJobDescription, initialMatchResult, onJobMatched, isDarkMode }) => {
  const [jd, setJD] = useState(initialJobDescription || "");
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState("");
  const [matchResult, setMatchResult] = useState(initialMatchResult || null);

  useEffect(() => {
    setJD(initialJobDescription || "");
    setMatchResult(initialMatchResult || null);
    setError("");
    setLoading(false);
    setLoadingProgress(0);
    setLoadingStage("");
  }, [initialJobDescription, initialMatchResult, resumeId]);

  const analyzeMatch = async () => {
    if (!resumeId) {
      setError("Upload your resume in Resume Analyzer first.");
      setMatchResult(null);
      return;
    }
    if (!jd.trim()) {
      setError("Paste a job description first.");
      setMatchResult(null);
      return;
    }

    setLoading(true);
    setLoadingProgress(0);
    setLoadingStage("SkillBridge is mapping your resume signals to JD requirements...");
    setError("");
    
    // Start progress animation
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 12 + 3; // Random increment between 3-15
      if (progress >= 95) {
        progress = 95;
        clearInterval(progressInterval);
      }
      setLoadingProgress(Math.floor(progress));
    }, 250);
    
    try {
      const formData = new FormData();
      formData.append("resume_id", resumeId);
      formData.append("job_description", jd);

      const response = await fetch('/api/jd/match', {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "Failed to analyze JD match";
        try {
          const payload = await response.json();
          const detail = String(payload?.detail || payload?.message || "").trim();
          if (detail) {
            message = detail.includes("validation errors for JDMatchResult")
              ? "JD analysis response was malformed. Please retry once."
              : detail;
          }
        } catch {
          const text = await response.text();
          if (text) message = text;
        }
        throw new Error(message);
      }

      const data = await response.json();
      
      // Complete progress
      clearInterval(progressInterval);
      setLoadingProgress(100);
      
      // Small delay to show 100%
      setTimeout(() => {
        setMatchResult(data);
        setLoading(false);
        setLoadingProgress(0);
        // Call the callback to update parent state with job description and match result
        if (onJobMatched) {
          onJobMatched(jd, data);
        }
      }, 400);
    } catch (e) {
      clearInterval(progressInterval);
      console.error(e);
      const message = e?.message || "";
      if (message.includes("Resume not found")) {
        setError("Resume not found. Upload your resume again, then retry JD matching.");
      } else {
        setError(message || "Could not analyze JD match with real data. Please try again.");
      }
      setMatchResult(null);
      setLoading(false);
      setLoadingProgress(0);
      setLoadingStage("");
    }
  };

  const analyzed = matchResult !== null;
  const missingSkills = matchResult?.missing_skills || [];
  const focusAreas = matchResult?.focus_areas || [];
  const strengths = matchResult?.strengths || [];
  const weaknesses = matchResult?.weaknesses || [];
  const suggestions = matchResult?.suggestions || [];
  const overallMatch = Math.round(matchResult?.match_percentage || 0);
  const jdLength = jd.trim().length;
  const canAnalyze = Boolean(resumeId) && jdLength > 0 && !loading;

  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 22, animation: "fadeIn 0.4s ease" }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: isDarkMode ? "#e8eef7" : "var(--gray-900)", letterSpacing: "-0.04em", marginBottom: 4 }}>JD Matcher</h2>
        <p style={{ fontSize: 13.5, color: isDarkMode ? "#b4c3d9" : "var(--gray-500)", maxWidth: 720 }}>Paste a job description to discover your match percentage, missing skills, and role-specific focus areas.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card isDarkMode={isDarkMode} style={{ padding: 22, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: isDarkMode ? "radial-gradient(circle at top right, rgba(107,147,214,0.16), transparent 40%)" : "radial-gradient(circle at top right, rgba(17,24,39,0.08), transparent 40%)" }} />
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? "#e8eef7" : "#111827", letterSpacing: "0.04em", textTransform: "uppercase" }}>Paste Job Description</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: jdLength > 120 ? "#10b981" : (isDarkMode ? "#8a9bb5" : "#9ca3af") }}>{jdLength} chars</span>
            </div>
            <textarea
              value={jd}
              onChange={e => setJD(e.target.value)}
              placeholder="Paste the full job description here..."
              disabled={loading}
              style={{
                width: "100%", height: 200, border: isDarkMode ? "1px solid rgba(91,127,196,0.3)" : "1px solid var(--gray-200)",
                borderRadius: 10, padding: "12px 14px", fontSize: 13,
                color: isDarkMode ? "#e8eef7" : "var(--gray-700)", background: isDarkMode ? "#1e2a3a" : "var(--gray-50)",
                outline: "none", resize: "none", fontFamily: "inherit",
                lineHeight: 1.65,
              }}
            />
            <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: isDarkMode ? "#dbe8fb" : "#374151", lineHeight: 1.5 }}>
              {!resumeId ? "Upload a resume first to enable analysis." : "Tip: Keep the character count low for better accuracy."}
            </div>
            <Btn
              variant="primary"
              onClick={analyzeMatch}
              disabled={!canAnalyze}
              style={{ marginTop: 12, width: "100%", justifyContent: "center", ...(isDarkMode ? { background: "#5b7fc4" } : {}) }}
              icon={<Icon name="search" size={14}/>}
            >
              {loading ? "Analyzing..." : (!resumeId ? "Upload resume to analyze" : "Analyze match")}
            </Btn>
            {error && <div style={{ marginTop: 10, fontSize: 12.5, color: "#ef4444", fontWeight: 600 }}>{error}</div>}
          </Card>

          {analyzed && (
            <Card isDarkMode={isDarkMode} style={{ padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? "#e8eef7" : "var(--gray-700)", marginBottom: 14 }}>Focus Areas</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {focusAreas.length === 0 && (
                  <div style={{ fontSize: 12.5, color: isDarkMode ? "#8a9bb5" : "var(--gray-500)" }}>No focus areas returned for this JD.</div>
                )}
                {focusAreas.map((a, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", borderRadius: 10,
                    background: isDarkMode ? "#5b7fc4" : "var(--gray-900)", color: "var(--white)",
                    fontSize: 13, fontWeight: 500,
                  }}>
                    <Icon name="target" size={14} color="rgba(255,255,255,0.7)"/>
                    {a.skill || "Skill"}
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{a.priority || "MEDIUM"}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {analyzed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card isDarkMode={isDarkMode} style={{ padding: "24px 22px", textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? "#8a9bb5" : "var(--gray-400)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Overall Match</div>
              <CircularProgress value={overallMatch} size={130} label="Match" isDarkMode={isDarkMode}/>
              <div style={{ marginTop: 18, fontSize: 13, color: isDarkMode ? "#b4c3d9" : "var(--gray-500)", lineHeight: 1.6 }}>
                You match <strong style={{ color: "var(--gray-900)" }}>{overallMatch}%</strong> of this job's requirements.
              </div>
            </Card>

            <Card isDarkMode={isDarkMode} style={{ padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 650, color: isDarkMode ? "#edf3ff" : "var(--gray-900)", marginBottom: 14 }}>Missing Skills</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {missingSkills.length === 0 && (
                  <span style={{ fontSize: 12.5, color: isDarkMode ? "#b4c3d9" : "var(--gray-500)" }}>No missing skills detected.</span>
                )}
                {missingSkills.map(skill => (
                  <span key={skill} style={{
                    padding: "5px 12px", borderRadius: 99,
                    background: isDarkMode ? "rgba(143,176,227,0.12)" : "var(--gray-100)", fontSize: 12,
                    color: isDarkMode ? "#dbe8fb" : "var(--gray-600)", fontWeight: 500,
                    border: isDarkMode ? "1px solid rgba(122,147,193,0.35)" : "1px solid var(--gray-200)",
                  }}>{skill}</span>
                ))}
              </div>

              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                <ProgressBar value={Math.max(0, Math.min(100, overallMatch))} label="Overall technical match" sublabel={`${overallMatch}%`} isDarkMode={isDarkMode}/>
                <ProgressBar value={Math.max(0, 100 - Math.min(100, missingSkills.length * 8))} label="Skill coverage" sublabel={`${Math.max(0, 100 - Math.min(100, missingSkills.length * 8))}%`} isDarkMode={isDarkMode}/>
              </div>

              {(strengths.length > 0 || weaknesses.length > 0) && (
                <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? "#86efac" : "#166534", marginBottom: 8 }}>Strengths</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {strengths.slice(0, 3).map((s, i) => (
                        <span key={i} style={{ fontSize: 12, color: isDarkMode ? "#c7d7ef" : "var(--gray-600)" }}>• {s}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? "#fdba74" : "#b45309", marginBottom: 8 }}>Weaknesses</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {weaknesses.slice(0, 3).map((w, i) => (
                        <span key={i} style={{ fontSize: 12, color: isDarkMode ? "#c7d7ef" : "var(--gray-600)" }}>• {w}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {suggestions.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? "#93c5fd" : "#1d4ed8", marginBottom: 8 }}>Suggestions</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {suggestions.slice(0, 4).map((item, i) => (
                      <span key={i} style={{ fontSize: 12, color: isDarkMode ? "#c7d7ef" : "var(--gray-600)" }}>• {item}</span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {!analyzed && !loading && (
          <Card isDarkMode={isDarkMode} style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 40, minHeight: 300, position: "relative", overflow: "hidden" }} hover={false}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: isDarkMode ? "radial-gradient(circle at 20% 20%, rgba(107,147,214,0.12), transparent 35%), radial-gradient(circle at 80% 75%, rgba(34,197,94,0.09), transparent 35%)" : "radial-gradient(circle at 20% 20%, rgba(17,24,39,0.07), transparent 35%), radial-gradient(circle at 80% 75%, rgba(16,185,129,0.08), transparent 35%)" }} />
            <div style={{ width: 56, height: 56, borderRadius: 16, background: isDarkMode ? "rgba(91,127,196,0.15)" : "var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="match" size={24} color={isDarkMode ? "#6b93d6" : "var(--gray-400)"}/>
            </div>
            <div style={{ textAlign: "center", position: "relative" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: isDarkMode ? "#e8eef7" : "var(--gray-700)", marginBottom: 6 }}>Awaiting analysis</div>
              <div style={{ fontSize: 13, color: isDarkMode ? "#b4c3d9" : "var(--gray-400)" }}>Paste a JD and click Analyze to see your match</div>
            </div>
          </Card>
        )}

        {!analyzed && loading && (
          <Card isDarkMode={isDarkMode} style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20, padding: 40, minHeight: 300 }} hover={false}>
            <div style={{ position: "relative", width: 140, height: 140 }}>
              {/* Outer spinning circle */}
              <div style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                border: isDarkMode ? "3px solid rgba(91,127,196,0.2)" : "3px solid var(--gray-100)",
                borderTopColor: isDarkMode ? "#6b93d6" : "var(--gray-800)",
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
                <div style={{ fontSize: 36, fontWeight: 900, color: isDarkMode ? "#e8eef7" : "var(--gray-900)", lineHeight: 1 }}>
                  {loadingProgress}%
                </div>
                <div style={{ fontSize: 11, color: isDarkMode ? "#8a9bb5" : "var(--gray-400)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Analyzing
                </div>
              </div>
            </div>
            
            <div style={{ textAlign: "center", maxWidth: 300 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: isDarkMode ? "#e8eef7" : "var(--gray-800)", marginBottom: 8 }}>
                Analyzing JD Match
              </div>
              <div style={{ fontSize: 13, color: isDarkMode ? "#b4c3d9" : "var(--gray-500)", lineHeight: 1.6 }}>
                {loadingStage || "SkillBridge is mapping your resume against JD requirements..."}
              </div>
            </div>
            
            {/* Progress bar */}
            <div style={{ width: "100%", maxWidth: 260 }}>
              <div style={{ height: 6, background: isDarkMode ? "rgba(91,127,196,0.2)" : "var(--gray-100)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${loadingProgress}%`,
                  background: isDarkMode ? "linear-gradient(90deg, #6b93d6, #5b7fc4)" : "linear-gradient(90deg, var(--gray-800), var(--gray-600))",
                  borderRadius: 999,
                  transition: "width 0.3s ease-out",
                }} />
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

// ─── Quiz ────────────────────────────────────────────────────────────────────
const Quiz = ({ resumeId, resumeData, jobDescription, onQuizComplete, isDarkMode }) => {
  const [domain, setDomain] = useState("Coding DSA");
  const [difficulty, setDifficulty] = useState("Easy");
  const [phase, setPhase] = useState("setup"); // setup | rules | quiz | result
  const [questions, setQuestions] = useState([]);
  const [studyMaterials, setStudyMaterials] = useState([]);
  const [rules, setRules] = useState([]);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState(0);
  const [showCongrats, setShowCongrats] = useState(false);

  const passingPercentage = 80;
  const darkText = isDarkMode ? "#e8eef7" : "var(--gray-900)";
  const mutedText = isDarkMode ? "#b4c3d9" : "var(--gray-500)";
  const softText = isDarkMode ? "#c7d7ef" : "var(--gray-600)";
  const panelBg = isDarkMode ? "#1f2d41" : "var(--white)";
  const surfaceBg = isDarkMode ? "#24354c" : "var(--gray-50)";
  const surfaceBorder = isDarkMode ? "1px solid rgba(122,147,193,0.35)" : "1px solid var(--gray-150)";
  const selectedBg = isDarkMode ? "#8fb0e3" : "var(--gray-900)";
  const selectedText = isDarkMode ? "#0f1a29" : "var(--white)";

  const getOptionText = (opt) => (typeof opt === "string" ? opt : opt?.text || "");

  const persistQuizContext = (nextContext) => {
    if (typeof window === "undefined") return;
    try {
      const existing = JSON.parse(window.localStorage.getItem("skillbridge.lastQuizContext") || "{}");
      window.localStorage.setItem("skillbridge.lastQuizContext", JSON.stringify({
        ...existing,
        ...nextContext,
      }));
    } catch {
      // Ignore storage failures in private/incognito contexts.
    }
  };

  const startQuizGeneration = async () => {
    if (!resumeId) {
      setError("Upload your resume first in Resume Analyzer.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("topic", `${domain} ${difficulty}`);
      formData.append("domain", domain);
      formData.append("difficulty", difficulty);
      formData.append("count", 10);
      formData.append("resume_id", resumeId);
      formData.append("job_description", jobDescription || "");

      const response = await fetch("/api/quiz/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to generate quiz");
      }

      const data = await response.json();
      const quizQuestions = Array.isArray(data.questions) ? data.questions.slice(0, 10) : [];

      setQuestions(quizQuestions);
      setStudyMaterials(Array.isArray(data.study_materials) ? data.study_materials : []);
      setRules(Array.isArray(data.rules) ? data.rules : [
        "No external help during quiz.",
        "Each section has 10 questions.",
        "Passing criteria is 80%.",
      ]);
      setAnswers({});
      setIndex(0);
      setShowCongrats(false);
      persistQuizContext({
        domain,
        difficulty,
        topic: `${domain} ${difficulty}`,
        generatedAt: new Date().toISOString(),
        passingPercentage: data.passing_percentage ?? passingPercentage,
        studyMaterials: Array.isArray(data.study_materials) ? data.study_materials : [],
        weakTopics: [],
        questions: quizQuestions.map((question) => ({
          id: question.id,
          topic: question.topic,
          difficulty: question.difficulty,
          question: question.question,
        })),
      });
      setPhase("rules");
    } catch (e) {
      console.error(e);
      setError("Could not generate quiz right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitQuiz = () => {
    let correct = 0;
    const weakTopics = [];
    questions.forEach((q, idx) => {
      const selected = answers[idx];
      const optionObjs = Array.isArray(q.options) ? q.options : [];
      const correctOption = optionObjs.find((o) => o?.is_correct);
      const correctText = correctOption ? getOptionText(correctOption) : (q.correct_answer || "");
      if (selected && selected === correctText) {
        correct += 1;
      } else {
        weakTopics.push(q.topic || q.question || `Question ${idx + 1}`);
      }
    });

    const computed = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    setScore(computed);
    setShowCongrats(computed >= passingPercentage);
    persistQuizContext({
      score: computed,
      weakTopics: Array.from(new Set(weakTopics)),
      completedAt: new Date().toISOString(),
    });
    onQuizComplete?.({
      score: computed,
      domain,
      difficulty,
      questionsCount: questions.length,
      completed: true,
      completedAt: new Date().toISOString(),
    });
    setPhase("result");
  };

  const current = questions[index];
  const progressPct = questions.length > 0 ? ((index + 1) / questions.length) * 100 : 0;

  return (
    <div style={{ padding: 28, animation: "fadeIn 0.4s ease", display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 18 }}>
      {showCongrats && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 10, 10, 0.48)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: 20,
          }}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              borderRadius: 24,
              border: isDarkMode ? "1px solid rgba(122,147,193,0.35)" : "1px solid var(--gray-200)",
              background: panelBg,
              boxShadow: "0 22px 64px rgba(0,0,0,0.22)",
              padding: 28,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", color: mutedText, textTransform: "uppercase", marginBottom: 8 }}>
              Quiz Completed
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, color: "#166534", letterSpacing: "-0.03em", marginBottom: 8 }}>
              Congratulations
            </div>
            <div style={{ fontSize: 14, color: softText, lineHeight: 1.7, marginBottom: 18 }}>
              You passed the {domain} assessment with a score of <strong>{score}%</strong>.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="secondary" onClick={() => setShowCongrats(false)} style={{ flex: 1, justifyContent: "center" }}>
                Close
              </Btn>
              <Btn variant="primary" onClick={() => { setShowCongrats(false); setPhase("setup"); }} style={{ flex: 1, justifyContent: "center" }}>
                Continue
              </Btn>
            </div>
          </div>
        </div>
      )}

      <div>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: darkText, letterSpacing: "-0.04em" }}>Adaptive Quiz</h2>
          <p style={{ fontSize: 13.5, color: mutedText, marginTop: 4 }}>
            Resume + JD + roadmap-based quizzes by section and difficulty.
          </p>
        </div>

        <Card style={{ padding: 18, marginBottom: 14 }} isDarkMode={isDarkMode}>
          <div style={{ fontSize: 12, fontWeight: 700, color: mutedText, marginBottom: 8 }}>Select Section</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            {["Coding DSA", "Development"].map((d) => (
              <Btn key={d} variant={domain === d ? "primary" : "secondary"} onClick={() => setDomain(d)} style={isDarkMode ? (domain === d ? { background: selectedBg, color: selectedText } : { background: "rgba(143,176,227,0.14)", color: "#dbe8fb", border: "1px solid rgba(122,147,193,0.35)" }) : {}}>
                {d}
              </Btn>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: mutedText, marginBottom: 8 }}>Difficulty</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            {["Easy", "Hard", "Advanced"].map((d) => (
              <Btn key={d} variant={difficulty === d ? "primary" : "secondary"} onClick={() => setDifficulty(d)} style={isDarkMode ? (difficulty === d ? { background: selectedBg, color: selectedText } : { background: "rgba(143,176,227,0.14)", color: "#dbe8fb", border: "1px solid rgba(122,147,193,0.35)" }) : {}}>
                {d}
              </Btn>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Badge style={isDarkMode ? { background: "rgba(122,147,193,0.18)", color: "#d7e4f7", border: "1px solid rgba(122,147,193,0.35)" } : {}}>10 questions per section</Badge>
            <Badge variant="warning" style={isDarkMode ? { background: "rgba(250,204,21,0.14)", color: "#fcd34d", border: "1px solid rgba(250,204,21,0.32)" } : {}}>Pass: {passingPercentage}%</Badge>
          </div>
          <div style={{ marginTop: 14 }}>
            <Btn variant="primary" onClick={startQuizGeneration} disabled={loading} style={{ width: "100%", justifyContent: "center", ...(isDarkMode ? { background: selectedBg, color: selectedText } : {}) }}>
              {loading ? "Generating quiz..." : "Generate Quiz"}
            </Btn>
          </div>
          {error && <div style={{ marginTop: 10, color: isDarkMode ? "#fca5a5" : "#b91c1c", fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
        </Card>

        {phase === "rules" && (
          <Card style={{ padding: 18 }} isDarkMode={isDarkMode}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: darkText }}>Rules & Regulations</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rules.map((rule, i) => (
                <div key={i} style={{ fontSize: 13.5, color: softText, lineHeight: 1.6 }}>• {rule}</div>
              ))}
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <Btn variant="secondary" onClick={() => setPhase("setup")} style={{ flex: 1, justifyContent: "center", ...(isDarkMode ? { background: "rgba(143,176,227,0.14)", color: "#dbe8fb", border: "1px solid rgba(122,147,193,0.35)" } : {}) }}>Back</Btn>
              <Btn variant="primary" onClick={() => setPhase("quiz")} style={{ flex: 2, justifyContent: "center", ...(isDarkMode ? { background: selectedBg, color: selectedText } : {}) }}>Start Test</Btn>
            </div>
          </Card>
        )}

        {phase === "quiz" && current && (
          <>
            <Card style={{ padding: 18, marginBottom: 12 }} isDarkMode={isDarkMode}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <Badge style={isDarkMode ? { background: "rgba(122,147,193,0.18)", color: "#d7e4f7", border: "1px solid rgba(122,147,193,0.35)" } : {}}>{domain}</Badge>
                <Badge style={isDarkMode ? { background: "rgba(122,147,193,0.18)", color: "#d7e4f7", border: "1px solid rgba(122,147,193,0.35)" } : {}}>Question {index + 1} / {questions.length}</Badge>
              </div>
              <div style={{ height: 4, background: isDarkMode ? "rgba(122,147,193,0.25)" : "var(--gray-100)", borderRadius: 99, marginBottom: 14 }}>
                <div style={{ width: `${progressPct}%`, height: "100%", borderRadius: 99, background: isDarkMode ? "#8fb0e3" : "var(--gray-800)" }}/>
              </div>
              <p style={{ fontSize: 17, fontWeight: 600, color: darkText, lineHeight: 1.55 }}>{current.question}</p>
            </Card>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(current.options || []).map((opt, i) => {
                const label = getOptionText(opt);
                const chosen = answers[index] === label;
                return (
                  <button
                    key={i}
                    onClick={() => setAnswers((prev) => ({ ...prev, [index]: label }))}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      borderRadius: 12, border: `1.5px solid ${chosen ? selectedBg : (isDarkMode ? "rgba(122,147,193,0.45)" : "var(--gray-200)")}`,
                      background: chosen ? selectedBg : (isDarkMode ? surfaceBg : "var(--white)"),
                      color: chosen ? selectedText : (isDarkMode ? "#e5eefc" : "var(--gray-700)"),
                      padding: "13px 16px", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                      fontSize: 14,
                    }}
                  >
                    <span style={{ width: 24, height: 24, borderRadius: 7, background: chosen ? (isDarkMode ? "rgba(12,20,34,0.2)" : "rgba(255,255,255,0.2)") : (isDarkMode ? "rgba(10,18,32,0.35)" : "rgba(0,0,0,0.06)"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <Btn variant="secondary" onClick={() => setIndex((p) => Math.max(0, p - 1))} style={{ flex: 1, justifyContent: "center", ...(isDarkMode ? { background: "rgba(143,176,227,0.14)", color: "#dbe8fb", border: "1px solid rgba(122,147,193,0.35)" } : {}) }}>
                Previous
              </Btn>
              {index < questions.length - 1 ? (
                <Btn variant="primary" onClick={() => setIndex((p) => Math.min(questions.length - 1, p + 1))} style={{ flex: 2, justifyContent: "center", ...(isDarkMode ? { background: selectedBg, color: selectedText } : {}) }}>
                  Next Question
                </Btn>
              ) : (
                <Btn variant="primary" onClick={submitQuiz} style={{ flex: 2, justifyContent: "center", ...(isDarkMode ? { background: selectedBg, color: selectedText } : {}) }}>
                  Submit Test
                </Btn>
              )}
            </div>
          </>
        )}

        {phase === "result" && (
          <Card style={{ padding: 20 }} isDarkMode={isDarkMode}>
            <div style={{ fontSize: 18, fontWeight: 700, color: darkText, marginBottom: 8 }}>Quiz Result</div>
            <div style={{ fontSize: 13, color: mutedText, marginBottom: 14 }}>{domain} • {difficulty} • {questions.length} questions</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: score >= passingPercentage ? "#166534" : "#b91c1c" }}>{score}%</div>
              <Badge variant={score >= passingPercentage ? "success" : "error"} style={isDarkMode ? { borderColor: "transparent" } : {}}>{score >= passingPercentage ? "PASS" : "FAIL"}</Badge>
            </div>
            <div style={{ fontSize: 13.5, color: softText, lineHeight: 1.6, marginBottom: 16 }}>
              Passing criteria is <strong>{passingPercentage}%</strong>. {score >= passingPercentage ? "You cleared this section." : "Review study materials and retry."}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="secondary" onClick={() => setPhase("setup")} style={{ flex: 1, justifyContent: "center", ...(isDarkMode ? { background: "rgba(143,176,227,0.14)", color: "#dbe8fb", border: "1px solid rgba(122,147,193,0.35)" } : {}) }}>Back to Setup</Btn>
              <Btn variant="primary" onClick={startQuizGeneration} style={{ flex: 2, justifyContent: "center", ...(isDarkMode ? { background: selectedBg, color: selectedText } : {}) }}>Retake Quiz</Btn>
            </div>
          </Card>
        )}
      </div>

      <div>
        <Card style={{ padding: 18 }} isDarkMode={isDarkMode}>
          <div style={{ fontSize: 15, fontWeight: 700, color: darkText, marginBottom: 10 }}>Study Material</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {studyMaterials.length === 0 && (
              <div style={{ fontSize: 13, color: mutedText, lineHeight: 1.6 }}>
                Generate a quiz to load week-wise study materials based on resume, JD, and roadmap.
              </div>
            )}
            {studyMaterials.map((item, i) => (
              <div key={i} style={{ border: surfaceBorder, borderRadius: 12, padding: 12, background: surfaceBg }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: mutedText, letterSpacing: "0.06em", marginBottom: 6 }}>WEEK {item.week}</div>
                <div style={{ fontSize: 13.5, fontWeight: 650, color: darkText, marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 12.5, color: softText, lineHeight: 1.55, marginBottom: 8 }}>{item.what_to_study}</div>
                {Array.isArray(item.resources) && item.resources.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {item.resources.slice(0, 3).map((resource, rIndex) => {
                      const resourceLabel = typeof resource === "string" ? resource : (resource?.label || resource?.url || `Resource ${rIndex + 1}`);
                      const resourceUrl = typeof resource === "string" ? "" : (resource?.url || "");

                      if (!resourceUrl) {
                        return (
                          <div key={rIndex} style={{ fontSize: 11.5, color: mutedText, lineHeight: 1.5 }}>
                            {resourceLabel}
                          </div>
                        );
                      }

                      return (
                        <a
                          key={rIndex}
                          href={resourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: isDarkMode ? "#9ec4ff" : "#1d4ed8",
                            textDecoration: "none",
                            lineHeight: 1.5,
                          }}
                        >
                          {resourceLabel}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─── Mock Interview ───────────────────────────────────────────────────────────
const MockInterview = ({ resumeId, resumeData, jobDescription, onInterviewProgress, onLogout, isDarkMode }) => {
  const [mode, setMode] = useState("Technical");
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [score, setScore] = useState(0);
  const [generationSource, setGenerationSource] = useState(null);
  const [feedbackScores, setFeedbackScores] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const chatRef = useRef(null);

  const textColor = isDarkMode ? "#e8eef7" : "var(--gray-900)";
  const mutedColor = isDarkMode ? "#b4c3d9" : "var(--gray-500)";
  const softColor = isDarkMode ? "#c7d7ef" : "var(--gray-600)";
  const panelBg = isDarkMode ? "#1f2d41" : "var(--white)";
  const panelBorder = isDarkMode ? "1px solid rgba(122,147,193,0.35)" : "1px solid var(--gray-150)";
  const surfaceBg = isDarkMode ? "#24354c" : "var(--gray-50)";
  const accentBg = isDarkMode ? "#8fb0e3" : "var(--gray-900)";
  const accentText = isDarkMode ? "#0f1a29" : "var(--white)";

  const loadQuizContext = () => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem("skillbridge.lastQuizContext") || "{}");
    } catch {
      return {};
    }
  };

  const parseApiError = (error, fallbackMessage) => {
    const raw = String(error?.message || "").trim();
    if (!raw) return fallbackMessage;

    try {
      const parsed = JSON.parse(raw);
      const detail = String(parsed?.detail || "").trim();
      if (detail) {
        if (detail.toLowerCase().includes("rate-limit") || detail.toLowerCase().includes("rate limit")) {
          return "Interview API rate limit reached. Please wait 5-10 seconds and try again.";
        }
        return detail;
      }
    } catch {
      // Non-JSON payload.
    }

    if (raw.toLowerCase().includes("rate_limit_exceeded") || raw.toLowerCase().includes("rate limit")) {
      return "Interview API rate limit reached. Please wait 5-10 seconds and try again.";
    }

    return raw.length > 220 ? fallbackMessage : raw;
  };

  useEffect(() => {
    if (!loading) {
      setLoadingSeconds(0);
      return undefined;
    }

    setLoadingSeconds(0);
    const timer = window.setInterval(() => {
      setLoadingSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [loading]);

  const formatElapsedTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const formatFeedbackMessage = (feedback) => {
    const scoreLine = `Score: ${feedback?.score ?? 0}/10`;
    const confidenceLine = `Confidence: ${feedback?.confidence_level || "Medium"}`;

    const strengths = Array.isArray(feedback?.strengths) ? feedback.strengths.slice(0, 3) : [];
    const weaknesses = Array.isArray(feedback?.weaknesses) ? feedback.weaknesses.slice(0, 3) : [];
    const tips = Array.isArray(feedback?.improvement_tips) ? feedback.improvement_tips.slice(0, 3) : [];

    const strengthsLine = strengths.length > 0 ? `Strengths: ${strengths.join(" | ")}` : "Strengths: Keep your answer specific and role-aligned.";
    const gapsLine = weaknesses.length > 0 ? `Gaps: ${weaknesses.join(" | ")}` : "Gaps: Add more concrete depth and measurable impact.";
    const tipsLine = tips.length > 0 ? `Next step: ${tips.join(" | ")}` : "Next step: Use STAR structure and include one measurable project outcome.";

    const modelAnswer = String(feedback?.model_answer || "").trim();
    const structuredModelAnswer = modelAnswer
      ? `Model guidance:\n${modelAnswer}`
      : "Model guidance:\nSummary: Good attempt.\nStrength: You addressed the topic.\nGap: Add deeper technical decisions and outcomes.\nBetter answer: Use STAR and quantify impact.";

    return [scoreLine, confidenceLine, strengthsLine, gapsLine, tipsLine, structuredModelAnswer].join("\n");
  };

  const scrollToBottom = () => {
    window.setTimeout(() => chatRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 60);
  };

  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const startInterview = async (selectedMode) => {
    if (!resumeId) {
      setError("Upload your resume first in Resume Analyzer.");
      return;
    }

    setMode(selectedMode);
    setLoading(true);
    setError("");
    setGenerationSource(null);
    setCompleted(false);
    const startedAt = Date.now();
    const interviewMode = selectedMode || "Technical";

    try {
      const formData = new FormData();
      formData.append("resume_id", resumeId);
      formData.append("job_description", jobDescription || "");
      formData.append("mode", interviewMode);
      formData.append("count", 4);
      formData.append("quiz_context", JSON.stringify(loadQuizContext()));

      const response = await fetch("/api/interview/start", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to start interview");
      }

      const data = await response.json();
      const nextSession = data?.session_id ? data : null;
      const firstQuestion = nextSession?.questions?.[0]?.question;

      if (!firstQuestion) {
        throw new Error("Interview model did not return questions");
      }

      setSession(nextSession);
      setGenerationSource(data?.generation_source || null);
      setMessages([
        { role: "ai", text: "Interview started from your resume, quiz history, and roadmap context. Your score begins at 0." },
        { role: "ai", text: firstQuestion },
      ]);
      setInput("");
      setScore(0);
      setFeedbackScores([]);
      setCurrentIndex(0);
      onInterviewProgress?.({
        mode: interviewMode,
        score: 0,
        completed: false,
        answered: 0,
        totalQuestions: nextSession?.questions?.length || 0,
        updatedAt: new Date().toISOString(),
      });
      scrollToBottom();
    } catch (e) {
      console.error(e);
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1200) {
        await wait(1200 - elapsed);
      }
      setError(parseApiError(e, "Could not start the interview right now. Please try again."));
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1200) {
        await wait(1200 - elapsed);
      }
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!session || completed || !input.trim() || submitting) return;

    const currentQuestion = session.questions?.[currentIndex];
    if (!currentQuestion) return;

    const answerText = input.trim();
    setSubmitting(true);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: answerText }]);

    try {
      const formData = new FormData();
      formData.append("session_id", session.session_id);
      formData.append("question_id", currentQuestion.id);
      formData.append("answer", answerText);
      formData.append("time_taken", 20);

      const response = await fetch("/api/interview/evaluate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to evaluate answer");
      }

      const feedback = await response.json();
      const nextScores = [...feedbackScores, Number(feedback.score || 0)];
      const nextAverage = nextScores.length > 0
        ? Math.round((nextScores.reduce((sum, value) => sum + value, 0) / (nextScores.length * 10)) * 100)
        : 0;

      setFeedbackScores(nextScores);
      setScore(nextAverage);
      const hasNextQuestion = Boolean(session.questions?.[currentIndex + 1]);
      onInterviewProgress?.({
        mode,
        score: nextAverage,
        completed: !hasNextQuestion,
        answered: nextScores.length,
        totalQuestions: session.questions?.length || 0,
        updatedAt: new Date().toISOString(),
      });

      const feedbackText = formatFeedbackMessage(feedback);
      const nextQuestion = session.questions?.[currentIndex + 1];

      setMessages((prev) => {
        const updated = [...prev, { role: "ai", text: feedbackText }];
        if (nextQuestion) {
          updated.push({ role: "ai", text: nextQuestion.question });
        } else {
          updated.push({ role: "ai", text: `Interview complete. Final score: ${nextAverage}%` });
        }
        return updated;
      });

      if (nextQuestion) {
        setCurrentIndex((value) => value + 1);
      } else {
        setCompleted(true);
      }

      scrollToBottom();
    } catch (e) {
      console.error(e);
      setError(parseApiError(e, "Could not evaluate your answer right now. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const currentQuestion = session?.questions?.[currentIndex];

  return (
    <div style={{ padding: 28, animation: "fadeIn 0.4s ease", height: "calc(100vh - 60px)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: textColor, letterSpacing: "-0.04em", marginBottom: 4 }}>Mock Interview</h2>
          <p style={{ fontSize: 13.5, color: mutedColor }}>Questions are based on your resume, quiz history, and roadmap progress.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {generationSource === "model" && (
            <Badge style={isDarkMode ? { background: "rgba(122,147,193,0.18)", color: "#d7e4f7", border: "1px solid rgba(122,147,193,0.35)" } : {}}>Source: Live API model</Badge>
          )}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: textColor, letterSpacing: "-0.04em" }}>{score}</div>
            <div style={{ fontSize: 11, color: mutedColor, fontWeight: 500 }}>Interview score</div>
          </div>
          <div style={{ width: 1, background: isDarkMode ? "rgba(122,147,193,0.35)" : "var(--gray-150)", height: 28 }}/>
          <Btn variant="outline" style={{ padding: "8px 16px", fontSize: 13, ...(isDarkMode ? { background: "rgba(143,176,227,0.12)", color: "#dbe8fb", border: "1px solid rgba(122,147,193,0.35)" } : {}) }} icon={<Icon name="mic" size={14}/>}>Voice mode</Btn>
        </div>
      </div>

      {!session && (
        <div style={{ background: panelBg, border: panelBorder, borderRadius: "var(--radius-lg)", boxShadow: isDarkMode ? "0 14px 36px rgba(0,0,0,0.22)" : "var(--shadow-md)", padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: mutedColor, marginBottom: 12 }}>Select Interview Mode</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Btn onClick={() => startInterview("Technical")} disabled={loading} style={isDarkMode ? { background: accentBg, color: accentText } : {}}>
              Start Technical Interview
            </Btn>
            <Btn variant="outline" onClick={() => startInterview("HR")} disabled={loading} style={isDarkMode ? { background: "rgba(143,176,227,0.12)", color: "#dbe8fb", border: "1px solid rgba(122,147,193,0.35)" } : {}}>
              Start HR Interview
            </Btn>
          </div>
          {loading && (
            <div style={{ marginTop: 18, padding: 18, borderRadius: 18, border: isDarkMode ? "1px solid rgba(122,147,193,0.35)" : "1px solid var(--gray-200)", background: isDarkMode ? "rgba(91,127,196,0.12)" : "var(--gray-50)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 999, border: isDarkMode ? "3px solid rgba(122,147,193,0.25)" : "3px solid var(--gray-200)", borderTopColor: isDarkMode ? "#8fb0e3" : "var(--gray-800)", animation: "rotate 1s linear infinite" }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: textColor, marginBottom: 4 }}>Interview is starting...</div>
                  <div style={{ fontSize: 12.5, color: mutedColor, lineHeight: 1.6 }}>
                    Please wait a few mins while SkillBridge prepares your {mode.toLowerCase()} interview from your resume and progress history.
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: isDarkMode ? "rgba(143,176,227,0.14)" : "var(--white)", border: isDarkMode ? "1px solid rgba(122,147,193,0.35)" : "1px solid var(--gray-200)", color: isDarkMode ? "#dbe8fb" : "var(--gray-700)", fontSize: 12, fontWeight: 700 }}>
                  <span>Timer</span>
                  <span>{formatElapsedTime(loadingSeconds)}</span>
                </div>
                <div style={{ fontSize: 12, color: mutedColor, fontWeight: 500 }}>
                  Generating {mode.toLowerCase()} questions, scoring flow, and interview context.
                </div>
              </div>
            </div>
          )}
          {error && <div style={{ marginTop: 12, color: isDarkMode ? "#fca5a5" : "#b91c1c", fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
          {resumeData?.name && <div style={{ marginTop: 10, color: mutedColor, fontSize: 12.5 }}>Interview profile: {resumeData.name}</div>}
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
                maxWidth: 720,
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              }}>
                {msg.role === "ai" && (
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: isDarkMode ? "#8fb0e3" : "var(--gray-900)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="brain" size={14} color="white"/>
                  </div>
                )}
                <div style={{
                  padding: "13px 16px", borderRadius: msg.role === "ai" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                  background: msg.role === "ai" ? panelBg : accentBg,
                  color: msg.role === "ai" ? (isDarkMode ? "#edf3ff" : "var(--gray-800)") : accentText,
                  border: msg.role === "ai" ? panelBorder : "none",
                  boxShadow: isDarkMode ? "0 8px 24px rgba(0,0,0,0.16)" : "var(--shadow-sm)",
                  fontSize: 13.5, lineHeight: 1.65, maxWidth: 560,
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && <div style={{ color: mutedColor, fontSize: 12.5 }}>Starting interview...</div>}
            {submitting && <div style={{ color: mutedColor, fontSize: 12.5 }}>Scoring answer...</div>}
          </div>

          <div style={{
            display: "flex", gap: 10, padding: "14px 0 0",
            borderTop: isDarkMode ? "1px solid rgba(122,147,193,0.25)" : "1px solid var(--gray-150)", flexShrink: 0,
          }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: surfaceBg, border: isDarkMode ? "1px solid rgba(122,147,193,0.35)" : "1px solid var(--gray-200)", borderRadius: 99, padding: "10px 18px" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={completed ? "Interview complete" : "Type your answer..."}
                disabled={completed || submitting}
                style={{ flex: 1, border: "none", background: "transparent", fontSize: 13.5, color: isDarkMode ? "#e5eefc" : "var(--gray-700)", outline: "none", fontFamily: "inherit" }}
              />
            </div>
            <Btn variant="primary" onClick={handleSend} disabled={completed || submitting} style={{ borderRadius: "50%", width: 44, height: 44, padding: 0, ...(isDarkMode ? { background: accentBg, color: accentText } : {}) }} icon={<Icon name="send" size={16}/>}></Btn>
          </div>

          {error && <div style={{ marginTop: 12, color: isDarkMode ? "#fca5a5" : "#b91c1c", fontSize: 12.5, fontWeight: 600 }}>{error}</div>}
          {completed && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ color: mutedColor, fontSize: 12.5 }}>You can go back to the auth page when you're done.</div>
              <Btn
                variant="secondary"
                onClick={onLogout}
                style={isDarkMode
                  ? { background: "rgba(255,255,255,0.08)", color: "#dbe8fb", border: "1px solid rgba(122,147,193,0.35)" }
                  : {}}
              >
                Logout
              </Btn>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Job Finder ───────────────────────────────────────────────────────────────
const JobFinder = ({ resumeId, resumeData, onJobsUpdated, isDarkMode }) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [location, setLocation] = useState("India");
  const [activeChip, setActiveChip] = useState("all");
  const [savedJobs, setSavedJobs] = useState({});
  const onJobsUpdatedRef = useRef(onJobsUpdated);

  useEffect(() => {
    onJobsUpdatedRef.current = onJobsUpdated;
  }, [onJobsUpdated]);

  const deriveRoleFromResume = (data) => {
    if (data?.experiences?.length > 0) {
      const title = data.experiences[0]?.title?.trim();
      if (title) return title;
    }

    const skillNames = (data?.skills || [])
      .map((s) => (typeof s === "string" ? s : s?.name || ""))
      .filter(Boolean)
      .map((s) => s.toLowerCase());

    if (skillNames.includes("react")) return "React Developer";
    if (skillNames.includes("python")) return "Python Developer";
    if (skillNames.includes("node.js")) return "Node.js Developer";

    return "Software Engineer";
  };

  const [role, setRole] = useState(deriveRoleFromResume(resumeData));

  useEffect(() => {
    setRole(deriveRoleFromResume(resumeData));
  }, [resumeData]);

  const fetchJobs = async () => {
    if (!resumeId) {
      setError("Upload your resume in Resume Analyzer first to get matched jobs.");
      setJobs([]);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("resume_id", resumeId);
      formData.append("role", role || "Software Engineer");
      formData.append("location", location || "India");
      formData.append("remote", "false");

      const response = await fetch('/api/jobs/search', {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "Failed to fetch jobs";
        try {
          const errorData = await response.json();
          message = errorData?.detail || errorData?.message || message;
        } catch {
          // Keep default if backend response is not JSON.
        }
        throw new Error(message);
      }

      const data = await response.json();
      const recommendedJobs = Array.isArray(data.jobs) ? data.jobs : [];
      setJobs(recommendedJobs);

      if (isSupabaseReady && supabase && recommendedJobs.length > 0) {
        const rows = recommendedJobs.map((job) => ({
          user_id: resumeId,
          title: job.title || "Recommended job",
          company: job.company || "",
          location: job.location || "",
          raw_text: job.description || "",
          parsed_data: {
            source: "job_recommendation",
            job_id: job.id || null,
            role: role || "Software Engineer",
            location: location || "India",
            match_percentage: job.match_percentage || 0,
            salary: job.salary || null,
            description: job.description || "",
            required_skills: Array.isArray(job.required_skills) ? job.required_skills : [],
            apply_link: job.apply_link || "",
            posted_date: job.posted_date || "",
            job_source: job.source || "",
          },
        }));

        const { error: saveError } = await supabase.from("job_descriptions").insert(rows);
        if (saveError) {
          console.warn("Failed to persist job recommendations:", saveError);
        }
      }
    } catch (e) {
      console.error(e);
      setError("Could not load jobs right now. Please try again.");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (resumeId) {
      fetchJobs();
    }
  }, [resumeId]);

  const filterByChip = (job) => {
    const match = Math.round(job.match_percentage || 0);
    const title = (job.title || "").toLowerCase();

    if (activeChip === "high") return match >= 70;
    if (activeChip === "entry") return /junior|intern|trainee|associate|graduate/.test(title);
    if (activeChip === "remote") return (job.location || "").toLowerCase().includes("remote");
    if (activeChip === "saved") return Boolean(savedJobs[job.id]);
    return true;
  };

  const filteredJobs = jobs.filter((job) => {
    const haystack = `${job.title || ""} ${job.company || ""} ${job.location || ""}`.toLowerCase();
    return haystack.includes(filter.toLowerCase()) && filterByChip(job);
  });

  const toggleSave = (jobId) => {
    setSavedJobs((prev) => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  useEffect(() => {
    onJobsUpdatedRef.current?.({
      total: jobs.length,
      filtered: filteredJobs.length,
      saved: Object.values(savedJobs).filter(Boolean).length,
      updatedAt: new Date().toISOString(),
    });
  }, [jobs, filteredJobs.length, savedJobs]);

  const quickChips = [
    { id: "all", label: "All jobs" },
    { id: "high", label: "70%+ match" },
    { id: "entry", label: "Entry level" },
    { id: "remote", label: "Remote" },
    { id: "saved", label: "Saved" },
  ];

  const textColor = isDarkMode ? "#e8eef7" : "var(--gray-900)";
  const mutedColor = isDarkMode ? "#b4c3d9" : "var(--gray-500)";
  const softColor = isDarkMode ? "#c7d7ef" : "var(--gray-600)";
  const panelBg = isDarkMode ? "#1f2d41" : "var(--white)";
  const panelBorder = isDarkMode ? "1px solid rgba(122,147,193,0.35)" : "1px solid var(--gray-150)";
  const surfaceBg = isDarkMode ? "#24354c" : "var(--gray-50)";
  const surfaceBorder = isDarkMode ? "1px solid rgba(122,147,193,0.3)" : "1px solid var(--gray-150)";
  const accentBg = isDarkMode ? "#8fb0e3" : "var(--gray-900)";
  const accentText = isDarkMode ? "#0f1a29" : "var(--white)";

  return (
    <div style={{ padding: 28, animation: "fadeIn 0.4s ease" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 14,
        marginBottom: 20,
        alignItems: "start",
      }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: textColor, letterSpacing: "-0.04em", marginBottom: 4 }}>Job Finder</h2>
          <p style={{ fontSize: 13.5, color: mutedColor }}>
            {loading ? "Finding jobs from your extracted resume data..." : `${filteredJobs.length} curated roles matched to your profile.`}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <Badge variant="default" style={isDarkMode ? { background: "rgba(122,147,193,0.18)", color: "#d7e4f7", border: "1px solid rgba(122,147,193,0.35)" } : {}}>Role: {role || "Software Engineer"}</Badge>
            <Badge variant="default" style={isDarkMode ? { background: "rgba(122,147,193,0.18)", color: "#d7e4f7", border: "1px solid rgba(122,147,193,0.35)" } : {}}>Location: {location}</Badge>
            <Badge variant="default" style={isDarkMode ? { background: "rgba(122,147,193,0.18)", color: "#d7e4f7", border: "1px solid rgba(122,147,193,0.35)" } : {}}>Saved: {Object.values(savedJobs).filter(Boolean).length}</Badge>
          </div>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: surfaceBg, border: isDarkMode ? "1px solid rgba(122,147,193,0.35)" : "1px solid var(--gray-200)", borderRadius: 99, padding: "8px 14px" }}>
            <Icon name="search" size={14} color={isDarkMode ? "#9db2d3" : "var(--gray-400)"}/>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter jobs..."
              style={{ border: "none", background: "transparent", fontSize: 13, color: isDarkMode ? "#e5eefc" : "var(--gray-600)", outline: "none", fontFamily: "inherit", width: 170 }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Target role"
              style={{
                border: isDarkMode ? "1px solid rgba(122,147,193,0.35)" : "1px solid var(--gray-200)",
                background: panelBg,
                fontSize: 12.5,
                color: isDarkMode ? "#e5eefc" : "var(--gray-700)",
                outline: "none",
                fontFamily: "inherit",
                borderRadius: 99,
                padding: "8px 12px",
                width: 140,
              }}
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
              style={{
                border: isDarkMode ? "1px solid rgba(122,147,193,0.35)" : "1px solid var(--gray-200)",
                background: panelBg,
                fontSize: 12.5,
                color: isDarkMode ? "#e5eefc" : "var(--gray-700)",
                outline: "none",
                fontFamily: "inherit",
                borderRadius: 99,
                padding: "8px 12px",
                width: 120,
              }}
            />
            <Btn variant="secondary" onClick={fetchJobs} style={{ padding: "8px 14px", fontSize: 13, ...(isDarkMode ? { background: "rgba(143,176,227,0.12)", color: "#dbe8fb", border: "1px solid rgba(122,147,193,0.35)" } : {}) }}>Refresh</Btn>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {quickChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setActiveChip(chip.key)}
            style={{
              border: isDarkMode ? "1px solid rgba(122,147,193,0.35)" : "1px solid var(--gray-200)",
              background: activeChip === chip.key ? (isDarkMode ? "rgba(143,176,227,0.16)" : "var(--gray-100)") : panelBg,
              color: isDarkMode ? "#dbe8fb" : "var(--gray-700)",
              borderRadius: 999,
              padding: "8px 12px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {error && (
        <Card isDarkMode={isDarkMode} style={{ marginBottom: 14, padding: "14px 16px", border: isDarkMode ? "1px solid rgba(250,204,21,0.3)" : "1px solid #fde68a", background: isDarkMode ? "rgba(250,204,21,0.08)" : "#fffbeb" }}>
          <div style={{ fontSize: 13, color: isDarkMode ? "#fcd34d" : "#92400e", fontWeight: 600 }}>{error}</div>
        </Card>
      )}

      {loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <Card key={idx} isDarkMode={isDarkMode} style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "linear-gradient(90deg, rgba(122,147,193,0.14), rgba(122,147,193,0.24), rgba(122,147,193,0.14))" : "linear-gradient(90deg, var(--gray-100), var(--gray-150), var(--gray-100))", backgroundSize: "250% 100%", animation: "shimmer 1.8s infinite" }}/>
                <div style={{ width: 72, height: 20, borderRadius: 99, background: isDarkMode ? "linear-gradient(90deg, rgba(122,147,193,0.14), rgba(122,147,193,0.24), rgba(122,147,193,0.14))" : "linear-gradient(90deg, var(--gray-100), var(--gray-150), var(--gray-100))", backgroundSize: "250% 100%", animation: "shimmer 1.8s infinite" }}/>
              </div>
              <div style={{ width: "75%", height: 14, borderRadius: 6, marginBottom: 8, background: isDarkMode ? "linear-gradient(90deg, rgba(122,147,193,0.14), rgba(122,147,193,0.24), rgba(122,147,193,0.14))" : "linear-gradient(90deg, var(--gray-100), var(--gray-150), var(--gray-100))", backgroundSize: "250% 100%", animation: "shimmer 1.8s infinite" }}/>
              <div style={{ width: "45%", height: 12, borderRadius: 6, marginBottom: 14, background: isDarkMode ? "linear-gradient(90deg, rgba(122,147,193,0.14), rgba(122,147,193,0.24), rgba(122,147,193,0.14))" : "linear-gradient(90deg, var(--gray-100), var(--gray-150), var(--gray-100))", backgroundSize: "250% 100%", animation: "shimmer 1.8s infinite" }}/>
              <div style={{ width: "100%", height: 4, borderRadius: 99, marginBottom: 14, background: isDarkMode ? "linear-gradient(90deg, rgba(122,147,193,0.14), rgba(122,147,193,0.24), rgba(122,147,193,0.14))" : "linear-gradient(90deg, var(--gray-100), var(--gray-150), var(--gray-100))", backgroundSize: "250% 100%", animation: "shimmer 1.8s infinite" }}/>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 2, height: 34, borderRadius: 99, background: isDarkMode ? "linear-gradient(90deg, rgba(122,147,193,0.14), rgba(122,147,193,0.24), rgba(122,147,193,0.14))" : "linear-gradient(90deg, var(--gray-100), var(--gray-150), var(--gray-100))", backgroundSize: "250% 100%", animation: "shimmer 1.8s infinite" }}/>
                <div style={{ flex: 1, height: 34, borderRadius: 99, background: isDarkMode ? "linear-gradient(90deg, rgba(122,147,193,0.14), rgba(122,147,193,0.24), rgba(122,147,193,0.14))" : "linear-gradient(90deg, var(--gray-100), var(--gray-150), var(--gray-100))", backgroundSize: "250% 100%", animation: "shimmer 1.8s infinite" }}/>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && filteredJobs.length === 0 && (
        <Card isDarkMode={isDarkMode} style={{ marginBottom: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 13.5, color: isDarkMode ? "#c7d7ef" : "var(--gray-600)" }}>
            No matching jobs found yet. Try clicking Refresh after uploading your latest resume.
          </div>
        </Card>
      )}

      {!loading && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
        {filteredJobs.map((job, i) => {
          const match = Math.round(job.match_percentage || 0);
          const company = job.company || "Company";
          const skills = (job.required_skills || []).slice(0, 4);
          const sourceLabel = String(job.source || "").trim();
          const showSourceLabel = sourceLabel && sourceLabel.toLowerCase() !== "fallback";
          const isSaved = Boolean(savedJobs[job.id]);
          return (
          <Card key={i} isDarkMode={isDarkMode} style={{ padding: "20px 22px", overflow: "hidden", position: "relative" }}>
            <div style={{
              position: "absolute",
              right: -40,
              top: -40,
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: match >= 70 ? "radial-gradient(circle, rgba(16,185,129,0.15), transparent 70%)" : "radial-gradient(circle, rgba(59,130,246,0.12), transparent 70%)",
              pointerEvents: "none",
            }}/>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: isDarkMode ? "rgba(122,147,193,0.16)" : "var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: isDarkMode ? "#dbe8fb" : "var(--gray-700)" }}>
                {company[0]}
              </div>
              <Badge variant={match >= 85 ? "success" : "default"} style={isDarkMode ? { background: match >= 70 ? "rgba(16,185,129,0.14)" : "rgba(122,147,193,0.18)", color: match >= 70 ? "#6ee7b7" : "#d7e4f7", border: match >= 70 ? "1px solid rgba(16,185,129,0.28)" : "1px solid rgba(122,147,193,0.35)" } : {}}>
                {match}% match
              </Badge>
            </div>
            <div style={{ fontSize: 15, fontWeight: 650, color: isDarkMode ? "#edf3ff" : "var(--gray-900)", marginBottom: 4, letterSpacing: "-0.02em" }}>{job.title || "Role"}</div>
            <div style={{ fontSize: 13, color: isDarkMode ? "#b4c3d9" : "var(--gray-500)", marginBottom: 4 }}>{company}</div>
            <div style={{ fontSize: 12, color: isDarkMode ? "#9db2d3" : "var(--gray-400)", marginBottom: 16, display: "flex", gap: 8 }}>
              <span>📍 {job.location || "India"}</span>
              {showSourceLabel && <span>· {sourceLabel}</span>}
            </div>
            {job.salary && (
              <div style={{ fontSize: 12, color: isDarkMode ? "#c7d7ef" : "var(--gray-500)", marginBottom: 10, fontWeight: 600 }}>
                Salary: {job.salary}
              </div>
            )}
            <div style={{ height: 3, background: isDarkMode ? "rgba(122,147,193,0.25)" : "var(--gray-100)", borderRadius: 99, marginBottom: 14 }}>
              <div style={{
                height: "100%",
                borderRadius: 99,
                width: `${match}%`,
                background: match >= 70 ? "linear-gradient(90deg, #10b981, #34d399)" : "linear-gradient(90deg, var(--gray-700), var(--gray-400))",
                transition: "width 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
              }}/>
            </div>
            {skills.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                {skills.map((skill, idx) => (
                  <span key={idx} style={{
                    fontSize: 11.5,
                    padding: "4px 8px",
                    borderRadius: 99,
                    border: isDarkMode ? "1px solid rgba(122,147,193,0.28)" : "1px solid var(--gray-200)",
                    background: isDarkMode ? "rgba(143,176,227,0.12)" : "var(--gray-50)",
                    color: isDarkMode ? "#dbe8fb" : "var(--gray-600)",
                    fontWeight: 600,
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <Btn
                variant="primary"
                onClick={() => job.apply_link && window.open(job.apply_link, "_blank", "noopener,noreferrer")}
                style={{ flex: 2, justifyContent: "center", padding: "8px", fontSize: 13, ...(isDarkMode ? { background: accentBg, color: accentText } : {}) }}
              >
                Apply now
              </Btn>
              <Btn
                variant={isSaved ? "primary" : "secondary"}
                onClick={() => {
                  toggleSave(job.id);
                  navigator.clipboard?.writeText(job.apply_link || "");
                }}
                style={{ flex: 1, justifyContent: "center", padding: "8px", fontSize: 13, ...(isDarkMode ? (isSaved ? { background: accentBg, color: accentText } : { background: "rgba(143,176,227,0.12)", color: "#dbe8fb", border: "1px solid rgba(122,147,193,0.35)" }) : {}) }}
              >
                {isSaved ? "Saved" : "Save"}
              </Btn>
            </div>
          </Card>
          );
        })}
      </div>
      )}
    </div>
  );
};

// ─── Dashboard Shell ──────────────────────────────────────────────────────────
const Dashboard = ({ onLogout }) => {
  const [active, setActive] = useState("resume");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [learningStateVersion, setLearningStateVersion] = useState(0);
  const [resumeContext, setResumeContext] = useState({ 
    resumeId: null, 
    resumeData: null, 
    jobDescription: null,
    matchResult: null,
  });
  const [overviewMetrics, setOverviewMetrics] = useState({
    resume: null,
    roadmap: null,
    quiz: null,
    interview: null,
    jobs: { total: 0, filtered: 0, saved: 0 },
  });

  const handleResumeParsed = (resumeId, resumeData) => {
    setResumeContext(prev => {
      const isNewResume = Boolean(prev.resumeId && resumeId && prev.resumeId !== resumeId);
      if (isNewResume) {
        // Clear section states for roadmap/quiz/interview/jobs only on new resume upload.
        setLearningStateVersion((value) => value + 1);
        setOverviewMetrics((previous) => ({
          ...previous,
          roadmap: null,
          quiz: null,
          interview: null,
          jobs: { total: 0, filtered: 0, saved: 0 },
        }));
      }

      return {
        ...prev,
        resumeId,
        resumeData,
        ...(isNewResume ? { jobDescription: null, matchResult: null } : {}),
      };
    });
  };

  const handleJobDescriptionMatched = (jobDescription, matchResult) => {
    setResumeContext(prev => ({ ...prev, jobDescription, matchResult }));
  };

  const handleResumeAnalyzed = (payload) => {
    setOverviewMetrics((previous) => ({ ...previous, resume: payload }));
  };

  const handleRoadmapProgress = (payload) => {
    setOverviewMetrics((previous) => ({ ...previous, roadmap: payload }));
  };

  const handleQuizComplete = (payload) => {
    setOverviewMetrics((previous) => ({ ...previous, quiz: payload }));
  };

  const handleInterviewProgress = (payload) => {
    setOverviewMetrics((previous) => ({ ...previous, interview: payload }));
  };

  const handleJobsUpdated = (payload) => {
    setOverviewMetrics((previous) => ({ ...previous, jobs: payload }));
  };

  const pages = {
    dashboard: {
      title: "Overview",
      render: () => <DashboardOverview resumeContext={resumeContext} overviewMetrics={overviewMetrics} isDarkMode={isDarkMode}/>,
      resetOnResumeChange: false,
    },
    resume: {
      title: "Resume Analyzer",
      render: () => <ResumeAnalyzer onResumeParsed={handleResumeParsed} onResumeAnalyzed={handleResumeAnalyzed} isDarkMode={isDarkMode} isActive={active === "resume"}/>,
      resetOnResumeChange: false,
    },
    matcher: {
      title: "JD Matcher",
      render: () => <JDMatcher resumeId={resumeContext.resumeId} initialJobDescription={resumeContext.jobDescription} initialMatchResult={resumeContext.matchResult} onJobMatched={handleJobDescriptionMatched} isDarkMode={isDarkMode}/>,
      resetOnResumeChange: true,
    },
    roadmap: {
      title: "Learning Roadmap",
      render: () => <Roadmap resumeId={resumeContext.resumeId} jobDescription={resumeContext.jobDescription} onProgressChange={handleRoadmapProgress} isDarkMode={isDarkMode}/>,
      resetOnResumeChange: true,
    },
    quiz: {
      title: "Adaptive Quiz",
      render: () => <Quiz resumeId={resumeContext.resumeId} resumeData={resumeContext.resumeData} jobDescription={resumeContext.jobDescription} onQuizComplete={handleQuizComplete} isDarkMode={isDarkMode}/>,
      resetOnResumeChange: true,
    },
    interview: {
      title: "Mock Interview",
      render: () => <MockInterview resumeId={resumeContext.resumeId} resumeData={resumeContext.resumeData} jobDescription={resumeContext.jobDescription} onInterviewProgress={handleInterviewProgress} onLogout={onLogout} isDarkMode={isDarkMode}/>,
      resetOnResumeChange: true,
    },
    jobs: {
      title: "Job Finder",
      render: () => <JobFinder resumeId={resumeContext.resumeId} resumeData={resumeContext.resumeData} onJobsUpdated={handleJobsUpdated} isDarkMode={isDarkMode}/>,
      resetOnResumeChange: true,
    },
  };

  const current = pages[active];

  // Animated particles
  const particles = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    size: Math.random() * 4 + 3,
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 4,
    duration: Math.random() * 12 + 18,
    animation: `floatParticle${(i % 3) + 1}`
  }));

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: isDarkMode ? "#1a2332" : "var(--gray-50)", position: "relative" }}>
      {/* Animated Background Particles */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        {particles.map(p => (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: isDarkMode ? "rgba(100, 130, 200, 0.15)" : "rgba(160, 160, 160, 0.22)",
              animation: `${p.animation} ${p.duration}s ease-in-out ${p.delay}s infinite`,
              boxShadow: isDarkMode ? `0 0 ${p.size * 2}px rgba(100, 130, 200, 0.12)` : `0 0 ${p.size * 2}px rgba(160, 160, 160, 0.12)`,
              filter: "blur(0.5px)"
            }}
          />
        ))}
        
        {/* Larger floating shapes */}
        <div style={{
          position: "absolute",
          top: "15%",
          right: "20%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: isDarkMode ? "radial-gradient(circle, rgba(70, 100, 180, 0.12), transparent 70%)" : "radial-gradient(circle, rgba(180, 180, 180, 0.1), transparent 70%)",
          animation: "floatSlow 22s ease-in-out infinite",
          filter: "blur(50px)"
        }}/>
        <div style={{
          position: "absolute",
          bottom: "25%",
          left: "15%",
          width: 380,
          height: 380,
          borderRadius: "50%",
          background: isDarkMode ? "radial-gradient(circle, rgba(80, 110, 190, 0.1), transparent 70%)" : "radial-gradient(circle, rgba(170, 170, 170, 0.08), transparent 70%)",
          animation: "floatSlow 26s ease-in-out infinite 4s",
          filter: "blur(55px)"
        }}/>
        <div style={{
          position: "absolute",
          top: "40%",
          left: "60%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: isDarkMode ? "radial-gradient(circle, rgba(90, 120, 200, 0.08), transparent 70%)" : "radial-gradient(circle, rgba(165, 165, 165, 0.07), transparent 70%)",
          animation: "floatSlow 24s ease-in-out infinite 8s",
          filter: "blur(52px)"
        }}/>
      </div>

      <Sidebar active={active} setActive={setActive} isDarkMode={isDarkMode}/>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 1 }}>
        <Topbar title={current.title} onLogout={onLogout} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}/>
        <main style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {Object.entries(pages).map(([pageId, page]) => {
            const isVisible = active === pageId;
            const componentKey = page.resetOnResumeChange
              ? `${pageId}-${learningStateVersion}`
              : pageId;

            return (
              <section
                key={pageId}
                style={{
                  display: isVisible ? "block" : "none",
                  height: "100%",
                }}
              >
                <div key={componentKey}>{page.render()}</div>
              </section>
            );
          })}
        </main>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENT PORTAL ROOT
// ═══════════════════════════════════════════════════════════════════════════════

function StudentPortal({ onExit }) {
  const [view, setView] = useState("landing"); // "landing" | "app"

  const handleLogout = () => {
    setView("landing");
    onExit?.();
  };

  return (
    <>
      {view === "landing"
        ? <LandingPage onEnterApp={() => setView("app")}/>
        : <Dashboard onLogout={handleLogout}/>}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [authRole, setAuthRole] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("skillbridge.authRole");
  }, []);

  const handleLogin = (role) => {
    setAuthRole(role);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("skillbridge.authRole", role);
    }
  };

  const handleLogout = () => {
    setAuthRole("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("skillbridge.authRole");
    }
  };

  return (
    <>
      <style>{globalStyles}</style>
      {!authRole && <AuthPage onLogin={handleLogin} />}
      {authRole === "student" && <StudentPortal onExit={handleLogout} />}
      {authRole === "admin" && <AdminDashboard onLogout={handleLogout} />}
    </>
  );
}
