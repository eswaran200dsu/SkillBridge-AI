import { useMemo, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const defaultCredentials = {
  student: { username: 'student', password: '1234' },
  admin: { username: 'admin', password: 'admin123' },
};

const roleLabels = {
  student: {
    title: 'Student Login',
    subtitle: 'Access resume analysis, roadmaps, quiz, interview, and job tools.',
  },
  admin: {
    title: 'Admin Login',
    subtitle: 'Manage eligibility, students, jobs, ATS analytics, and screening rules.',
  },
};

const studentFlowNodes = [
  { key: 'resume', label: 'Resume Upload', hint: 'Extract profile', color: '#60a5fa', step: '1/4' },
  { key: 'match', label: 'JD Match', hint: 'Measure fit score', color: '#22d3ee', step: '2/4' },
  { key: 'roadmap', label: 'Roadmap', hint: 'Personalized plan', color: '#34d399', step: '3/4' },
  { key: 'interview', label: 'Interview', hint: 'Practice + feedback', color: '#fbbf24', step: '4/4' },
];

const adminFlowNodes = [
  { key: 'students', label: 'Student Management', hint: 'Review user profiles', color: '#f87171', step: '1/4' },
  { key: 'rules', label: 'Screening Rules', hint: 'Set ATS criteria', color: '#a78bfa', step: '2/4' },
  { key: 'analytics', label: 'Platform Analytics', hint: 'Review metrics', color: '#fb923c', step: '3/4' },
  { key: 'jobs', label: 'Job Database', hint: 'Manage listings', color: '#f472b6', step: '4/4' },
];

// Starfield background component
function StarField() {
  const [stars, setStars] = useState([]);

  useEffect(() => {
    const starArray = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 2,
    }));
    setStars(starArray);
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {stars.map((star) => (
        <motion.div
          key={star.id}
          animate={{
            y: [0, -20, 0],
            opacity: [0.2, 0.8, 0.2],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: star.delay,
            ease: 'easeInOut',
          }}
          style={{
            position: 'absolute',
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.6)',
            boxShadow: '0 0 4px rgba(255, 255, 255, 0.4)',
          }}
        />
      ))}
    </div>
  );
}

// Geometric dot grid background
function DotGrid() {
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 0.15, pointerEvents: 'none' }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dot-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="rgba(0, 229, 196, 0.3)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-pattern)" />
      </svg>
    </div>
  );
}

function CareerFlowPanel({ role = 'student' }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const nodes = role === 'admin' ? adminFlowNodes : studentFlowNodes;

  return (
    <div style={{ 
      width: '100%', 
      borderRadius: 24,
      background: 'rgba(15, 25, 45, 0.6)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(0, 229, 196, 0.2)',
      padding: 24,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      transition: 'border-color 300ms ease',
    }}
    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(0, 229, 196, 0.4)'}
    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(0, 229, 196, 0.2)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ 
          fontSize: 11, 
          letterSpacing: '0.1em', 
          textTransform: 'uppercase', 
          color: 'rgba(0, 229, 196, 0.8)', 
          fontWeight: 700 
        }}>
          {role === 'admin' ? 'ADMIN CONTROLS' : 'CAREER PIPELINE'}
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 6,
          padding: '4px 10px',
          borderRadius: 12,
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
        }}>
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ 
              width: 6, 
              height: 6, 
              borderRadius: '50%', 
              background: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
            }}
          />
          <span style={{ fontSize: 11, color: '#86efac', fontWeight: 700 }}>Live</span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {nodes.map((node, index) => (
          <motion.div
            key={node.key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{
              display: 'grid',
              gridTemplateColumns: '12px 1fr auto',
              alignItems: 'center',
              gap: 14,
              borderRadius: 14,
              padding: '14px 16px',
              background: hoveredIndex === index 
                ? 'rgba(0, 229, 196, 0.08)' 
                : 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              transition: 'all 250ms ease',
            }}
          >
            <motion.span
              animate={{ 
                scale: hoveredIndex === index ? [1, 1.3, 1] : 1,
                boxShadow: hoveredIndex === index 
                  ? [`0 0 0px ${node.color}`, `0 0 12px ${node.color}`, `0 0 0px ${node.color}`]
                  : `0 0 8px ${node.color}`
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ 
                width: 10, 
                height: 10, 
                borderRadius: '50%', 
                background: node.color,
              }}
            />
            <div>
              <div style={{ 
                fontSize: 14, 
                fontWeight: 700, 
                color: 'rgba(255, 255, 255, 0.95)',
                marginBottom: 2,
              }}>
                {node.label}
              </div>
              <div style={{ 
                fontSize: 12, 
                color: 'rgba(255, 255, 255, 0.55)',
              }}>
                {node.hint}
              </div>
            </div>
            <div style={{ 
              fontSize: 12, 
              color: 'rgba(255, 255, 255, 0.5)', 
              fontWeight: 700,
              fontFamily: 'monospace',
            }}>
              {node.step}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function AuthPage({ onLogin }) {
  const [role, setRole] = useState('student');
  const [username, setUsername] = useState(defaultCredentials.student.username);
  const [password, setPassword] = useState(defaultCredentials.student.password);
  const [error, setError] = useState('');

  const activeConfig = useMemo(() => roleLabels[role], [role]);

  const switchRole = (nextRole) => {
    setRole(nextRole);
    setError('');
    setUsername(defaultCredentials[nextRole].username);
    setPassword(defaultCredentials[nextRole].password);
  };

  const handleLogin = () => {
    const valid =
      username.trim() === defaultCredentials[role].username &&
      password === defaultCredentials[role].password;

    if (!valid) {
      setError('Invalid credentials. Use the pre-filled demo login.');
      return;
    }

    onLogin?.(role);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#0a0f1e',
      color: 'white', 
      overflow: 'hidden',
      position: 'relative',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    }}>
      {/* Starfield background */}
      <StarField />
      
      {/* Dot grid pattern */}
      <DotGrid />

      {/* Main content container */}
      <div style={{ 
        position: 'relative', 
        zIndex: 1, 
        minHeight: '100vh', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))',
        gap: 30,
        padding: '20px clamp(20px, 5vw, 60px)',
        maxWidth: 1500,
        margin: '0 auto',
      }}>
        {/* LEFT SECTION - Hero */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center',
            gap: 24,
            paddingTop: '20px',
            paddingBottom: '20px',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 14, 
              background: 'linear-gradient(135deg, rgba(0, 229, 196, 0.2), rgba(0, 229, 196, 0.05))',
              border: '1px solid rgba(0, 229, 196, 0.3)',
              display: 'grid', 
              placeItems: 'center',
              boxShadow: '0 8px 32px rgba(0, 229, 196, 0.2)',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00e5c4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: '#ffffff' }}>
                SkillBridge AI
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)', letterSpacing: '0.01em' }}>
                Career operating system
              </div>
            </div>
          </div>

          {/* Powered by badge */}
          <div>
            <div style={{ 
              display: 'inline-flex', 
              padding: '8px 16px', 
              borderRadius: 999, 
              border: '1px solid rgba(0, 229, 196, 0.3)',
              background: 'rgba(0, 229, 196, 0.08)',
              color: '#00e5c4',
              fontSize: 12, 
              fontWeight: 600,
              letterSpacing: '0.02em',
              boxShadow: '0 0 20px rgba(0, 229, 196, 0.15)',
            }}>
              Powered by Supabase + AI workflows
            </div>
          </div>

          {/* Hero heading */}
          <div style={{ maxWidth: 600 }}>
            <h1 style={{ 
              fontSize: 'clamp(36px, 6vw, 64px)', 
              lineHeight: 1.1, 
              letterSpacing: '-0.04em', 
              margin: 0, 
              fontWeight: 800,
              background: 'linear-gradient(135deg, #ffffff 0%, #00e5c4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              {role === 'admin' ? 'Empower student ' : 'Start your career '}
              <span style={{ 
                background: 'linear-gradient(135deg, #ffffff 0%, #22d3ee 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {role === 'admin' ? 'success.' : 'mission.'}
              </span>
            </h1>
            <p style={{ 
              marginTop: 20, 
              fontSize: 17, 
              lineHeight: 1.7, 
              color: 'rgba(255, 255, 255, 0.7)',
              maxWidth: 540,
            }}>
              {role === 'admin'
                ? 'Manage eligibility rules, track ATS analytics, monitor student progress, and oversee job placements from the admin control center.'
                : 'Upload resumes, compare job descriptions, generate roadmaps, and practice interviews from a single student workspace.'}
            </p>
          </div>

          <div style={{ maxWidth: 560 }}>
            <CareerFlowPanel role={role} />
          </div>

          {/* Feature badges */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
            gap: 12,
            maxWidth: 560,
          }}>
            {[
              { title: 'Live ATS', desc: 'Real student data' },
              { title: 'Supabase', desc: 'Persistent records' },
              { title: 'Motion UI', desc: 'Smooth transitions' },
            ].map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 + idx * 0.1 }}
                style={{ 
                  padding: 16, 
                  borderRadius: 16, 
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 250ms ease',
                }}
                whileHover={{
                  background: 'rgba(0, 229, 196, 0.08)',
                  borderColor: 'rgba(0, 229, 196, 0.2)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>
                  {feature.title}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.55)' }}>
                  {feature.desc}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* RIGHT SECTION - Login Panel */}
        <div style={{ 
          display: 'grid', 
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 0 40px 0',
        }}>
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ 
              width: '100%', 
              maxWidth: 440,
              position: 'relative',
              marginTop: '-40px', // moves it slightly up as requested
            }}
          >
            {/* Animated glow behind card */}
            <motion.div
              animate={{
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{
                position: 'absolute',
                inset: -20,
                background: 'radial-gradient(circle, rgba(0, 229, 196, 0.3), transparent 70%)',
                filter: 'blur(40px)',
                zIndex: -1,
              }}
            />

            {/* Login card */}
            <div style={{ 
              background: 'rgba(15, 25, 45, 0.7)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(0, 229, 196, 0.2)',
              borderRadius: 28, 
              padding: 32,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            }}>
              {/* Tab toggle */}
              <div style={{ 
                display: 'flex', 
                gap: 6, 
                padding: 4, 
                borderRadius: 999, 
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                marginBottom: 28,
              }}>
                <button
                  onClick={() => switchRole('student')}
                  style={{ 
                    flex: 1, 
                    border: 'none', 
                    cursor: 'pointer', 
                    padding: '12px 20px', 
                    borderRadius: 999,
                    background: role === 'student' ? '#ffffff' : 'transparent',
                    color: role === 'student' ? '#0a0f1e' : 'rgba(255, 255, 255, 0.7)',
                    fontWeight: 700,
                    fontSize: 14,
                    transition: 'all 200ms ease',
                    fontFamily: 'inherit',
                  }}
                >
                  Student Login
                </button>
                <button
                  onClick={() => switchRole('admin')}
                  style={{ 
                    flex: 1, 
                    border: 'none', 
                    cursor: 'pointer', 
                    padding: '12px 20px', 
                    borderRadius: 999,
                    background: role === 'admin' ? '#ffffff' : 'transparent',
                    color: role === 'admin' ? '#0a0f1e' : 'rgba(255, 255, 255, 0.7)',
                    fontWeight: 700,
                    fontSize: 14,
                    transition: 'all 200ms ease',
                    fontFamily: 'inherit',
                  }}
                >
                  Admin Login
                </button>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={role}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Section label */}
                  <div style={{ 
                    fontSize: 11, 
                    letterSpacing: '0.12em', 
                    textTransform: 'uppercase', 
                    color: 'rgba(0, 229, 196, 0.8)',
                    fontWeight: 700,
                    marginBottom: 12,
                  }}>
                    {activeConfig.title.toUpperCase()}
                  </div>

                  {/* Heading */}
                  <div style={{ 
                    fontSize: 32, 
                    fontWeight: 800, 
                    letterSpacing: '-0.03em',
                    color: '#ffffff',
                    marginBottom: 10,
                  }}>
                    {role === 'admin' ? 'Admin access' : 'Student access'}
                  </div>

                  {/* Subtitle */}
                  <p style={{ 
                    fontSize: 14, 
                    color: 'rgba(255, 255, 255, 0.65)', 
                    lineHeight: 1.6,
                    marginBottom: 28,
                  }}>
                    {activeConfig.subtitle}
                  </p>

                  {/* Form */}
                  <div style={{ display: 'grid', gap: 16 }}>
                    <label style={{ display: 'grid', gap: 8 }}>
                      <span style={{ 
                        fontSize: 13, 
                        color: 'rgba(255, 255, 255, 0.75)', 
                        fontWeight: 600 
                      }}>
                        Username
                      </span>
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={{ 
                          width: '100%', 
                          borderRadius: 14, 
                          border: '1px solid rgba(0, 229, 196, 0.2)',
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: 'white', 
                          padding: '14px 16px',
                          outline: 'none', 
                          fontSize: 14,
                          fontFamily: 'inherit',
                          transition: 'all 200ms ease',
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'rgba(0, 229, 196, 0.5)';
                          e.target.style.boxShadow = '0 0 0 3px rgba(0, 229, 196, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(0, 229, 196, 0.2)';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: 8 }}>
                      <span style={{ 
                        fontSize: 13, 
                        color: 'rgba(255, 255, 255, 0.75)', 
                        fontWeight: 600 
                      }}>
                        Password
                      </span>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        style={{ 
                          width: '100%', 
                          borderRadius: 14, 
                          border: '1px solid rgba(0, 229, 196, 0.2)',
                          background: 'rgba(255, 255, 255, 0.06)',
                          color: 'white', 
                          padding: '14px 16px',
                          outline: 'none', 
                          fontSize: 14,
                          fontFamily: 'inherit',
                          transition: 'all 200ms ease',
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = 'rgba(0, 229, 196, 0.5)';
                          e.target.style.boxShadow = '0 0 0 3px rgba(0, 229, 196, 0.1)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(0, 229, 196, 0.2)';
                          e.target.style.boxShadow = 'none';
                        }}
                      />
                    </label>

                    {/* Hint row */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      fontSize: 12, 
                      color: 'rgba(255, 255, 255, 0.5)',
                    }}>
                      <span>Demo credentials are prefilled.</span>
                      <span style={{ fontFamily: 'monospace', color: 'rgba(0, 229, 196, 0.7)' }}>
                        {role === 'admin' ? 'admin / admin123' : 'student / 1234'}
                      </span>
                    </div>

                    {/* Error message */}
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ 
                          padding: '12px 16px', 
                          borderRadius: 14, 
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#fca5a5', 
                          fontSize: 13, 
                          fontWeight: 600 
                        }}
                      >
                        {error}
                      </motion.div>
                    )}

                    {/* Sign in button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleLogin}
                      style={{
                        border: 'none',
                        cursor: 'pointer',
                        padding: '16px 20px',
                        borderRadius: 14,
                        background: '#ffffff',
                        color: '#0a0f1e',
                        fontWeight: 800,
                        fontSize: 15,
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                        transition: 'all 200ms ease',
                        fontFamily: 'inherit',
                        marginTop: 8,
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.boxShadow = '0 12px 32px rgba(0, 229, 196, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)';
                      }}
                    >
                      Sign in
                    </motion.button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
