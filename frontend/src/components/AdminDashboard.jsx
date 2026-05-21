import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase, isSupabaseReady } from '../lib/supabaseClient';
import StudentsSection, { useAdminData } from './admin/Students';

const navItems = [
  { id: 'overview', label: 'Dashboard Overview' },
  { id: 'summary', label: 'Executive Summary' },
  { id: 'students', label: 'Students' },
  { id: 'eligibility', label: 'Eligibility Control' },
  { id: 'jobs', label: 'Job Management' },
  { id: 'analytics', label: 'Analytics' },
];

const colors = ['#22c55e', '#38bdf8', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6'];

const metricStyle = {
  borderRadius: 20,
  border: '1px solid rgba(70,100,150,0.25)',
  background: '#253447',
  backdropFilter: 'blur(20px)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
};

function StatCard({ label, value, hint, accent }) {
  return (
    <motion.div 
      whileHover={{ y: -3, scale: 1.01 }} 
      style={{ 
        ...metricStyle, 
        padding: 24, 
        position: 'relative', 
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 20% 20%, ${accent}18, transparent 65%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ color: '#b4c3d9', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{label}</div>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em', color: '#e8eef7', lineHeight: 1 }}>{value}</div>
        <div style={{ marginTop: 8, color: '#8a9bb5', fontSize: 12, lineHeight: 1.4 }}>{hint}</div>
      </div>
    </motion.div>
  );
}

function SectionShell({ title, subtitle, children, right }) {
  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4 }} 
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.03em', fontWeight: 700, color: '#e8eef7' }}>{title}</h2>
          <p style={{ marginTop: 8, color: '#b4c3d9', fontSize: 14, lineHeight: 1.5 }}>{subtitle}</p>
        </div>
        {right}
      </div>
      {children}
    </motion.section>
  );
}

function Gauge({ value, label }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', gap: 10 }}>
      <div style={{ width: 130, height: 130, borderRadius: '50%', background: `conic-gradient(#22c55e 0deg, #22c55e ${value * 3.6}deg, rgba(255,255,255,0.08) ${value * 3.6}deg 360deg)`, display: 'grid', placeItems: 'center' }}>
        <div style={{ width: 98, height: 98, borderRadius: '50%', background: '#0b1020', display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800 }}>{Math.round(value)}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.48)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function evaluateEligibility(student, settings) {
  const cgpa = Number(student.cgpa);
  const requiredSkills = settings.required_skills || [];
  const skillList = student.skills || [];
  const meetsCGPA = !Number.isNaN(cgpa) && cgpa >= Number(settings.min_cgpa);
  const meetsATS = Number(student.ats_score || 0) >= Number(settings.min_ats_score);
  const meetsSkills = requiredSkills.length === 0 || requiredSkills.every((requiredSkill) =>
    skillList.some((skill) => skill.toLowerCase().includes(requiredSkill.toLowerCase())),
  );

  return {
    meetsCGPA,
    meetsATS,
    meetsSkills,
    eligible: meetsCGPA && meetsATS && meetsSkills,
  };
}

export function AdminDashboard({ onLogout }) {
  const { students, jobs, settings, loading, error, refetch } = useAdminData();
  const [active, setActive] = useState('overview');
  const [savedSettings, setSavedSettings] = useState(settings);
  const [editingJob, setEditingJob] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const [jobForm, setJobForm] = useState({ title: '', company: '', location: '' });
  const [toast, setToast] = useState('');
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    setSavedSettings(settings);
  }, [settings]);

  const eligibilitySnapshot = useMemo(() => {
    return students.map((student) => ({
      student,
      ...evaluateEligibility(student, savedSettings),
    }));
  }, [students, savedSettings.min_cgpa, savedSettings.min_ats_score, savedSettings.required_skills]);

  // Calculate bottleneck eligibility (minimum of all criteria)
  const eligibilityBreakdown = useMemo(() => {
    const cgpaCount = eligibilitySnapshot.filter(e => e.meetsCGPA).length;
    const atsCount = eligibilitySnapshot.filter(e => e.meetsATS).length;
    const skillsCount = eligibilitySnapshot.filter(e => e.meetsSkills).length;
    const totalEligible = Math.min(cgpaCount, atsCount, skillsCount);
    
    return {
      cgpaCount,
      atsCount,
      skillsCount,
      totalEligible,
      notEligible: students.length - totalEligible
    };
  }, [eligibilitySnapshot, students.length]);

  const eligibleStudents = useMemo(
    () => ({ length: eligibilityBreakdown.totalEligible }),
    [eligibilityBreakdown.totalEligible],
  );

  const eligibilityCounts = useMemo(() => {
    return eligibilitySnapshot.reduce((counts, entry) => {
      if (entry.meetsCGPA) counts.cgpa += 1;
      if (entry.meetsATS) counts.ats += 1;
      if (entry.meetsSkills) counts.skills += 1;
      if (entry.eligible) counts.eligible += 1;
      return counts;
    }, { cgpa: 0, ats: 0, skills: 0, eligible: 0 });
  }, [eligibilitySnapshot]);

  const totalStudents = students.length;
  const averageAts = totalStudents ? students.reduce((sum, student) => sum + Number(student.ats_score || 0), 0) / totalStudents : 0;
  const placementReadiness = totalStudents ? Math.round((eligibilityCounts.eligible / totalStudents) * 100) : 0;
  const liveJobs = useMemo(() => jobs || [], [jobs]);

  const activeJobs = liveJobs.length;

  const chartData = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    students.forEach((student) => {
      const score = Number(student.ats_score || 0);
      if (score < 20) buckets[0] += 1;
      else if (score < 40) buckets[1] += 1;
      else if (score < 60) buckets[2] += 1;
      else if (score < 80) buckets[3] += 1;
      else buckets[4] += 1;
    });
    return [
      { name: '0-20', value: buckets[0] },
      { name: '20-40', value: buckets[1] },
      { name: '40-60', value: buckets[2] },
      { name: '60-80', value: buckets[3] },
      { name: '80-100', value: buckets[4] },
    ];
  }, [students]);

  const skillGaps = useMemo(() => {
    const required = savedSettings.required_skills || [];
    return required.map((skill) => {
      const matchCount = students.filter((student) => student.skills.some((value) => value.toLowerCase().includes(skill.toLowerCase()))).length;
      return { skill, students: Math.max(0, students.length - matchCount) };
    });
  }, [students, savedSettings]);

  const trendData = useMemo(() => {
    return students.slice(0, 6).map((student, index) => ({
      name: `Student ${index + 1}`,
      ats: Number(student.ats_score || 0),
      progress: Number(student.progress || 0),
      order: index + 1,
    }));
  }, [students]);

  const saveEligibility = async () => {
    try {
      if (!isSupabaseReady || !supabase) {
        setToast('Supabase is not connected, so eligibility changes were only saved locally.');
        window.setTimeout(() => setToast(''), 2600);
        return;
      }

      const payload = {
        id: 1,
        min_cgpa: Number(savedSettings.min_cgpa ?? 7),
        min_ats_score: Number(savedSettings.min_ats_score ?? 65),
        required_skills: Array.isArray(savedSettings.required_skills) ? savedSettings.required_skills : [],
        company_name: 'SkillBridge',
        updated_at: new Date().toISOString(),
      };

      const { error: saveError } = await supabase
        .from('admin_settings')
        .upsert(payload, { onConflict: 'id' });

      if (saveError) {
        throw saveError;
      }

      setToast('Eligibility criteria saved and synced to Students page.');
      window.setTimeout(() => setToast(''), 2600);
      refetch();
    } catch (error) {
      console.error('Failed to save eligibility settings:', error);
      setToast(`Could not save eligibility settings: ${error.message || error}`);
      window.setTimeout(() => setToast(''), 3200);
    }
  };

  const handleJobSave = async () => {
    try {
      if (!isSupabaseReady || !supabase) {
        setToast('Supabase is not connected, so job changes were only saved locally.');
        window.setTimeout(() => setToast(''), 2600);
        return;
      }

      const payload = {
        title: jobForm.title.trim() || 'Untitled role',
        company: jobForm.company.trim(),
        location: jobForm.location.trim(),
        raw_text: [jobForm.title, jobForm.company, jobForm.location].filter(Boolean).join(' • '),
        parsed_data: {
          source: 'admin_job',
          created_by: 'admin',
        },
      };

      let saveError = null;
      if (editingJob?.id) {
        const response = await supabase
          .from('job_descriptions')
          .update(payload)
          .eq('id', editingJob.id);
        saveError = response.error;
      } else {
        const response = await supabase
          .from('job_descriptions')
          .insert(payload);
        saveError = response.error;
      }

      if (saveError) {
        throw saveError;
      }

      setToast(editingJob ? 'Job updated and synced to Supabase.' : 'Job created and synced to Supabase.');
      setShowJobModal(false);
      setEditingJob(null);
      setJobForm({ title: '', company: '', location: '' });
      window.setTimeout(() => setToast(''), 2600);
      refetch();
    } catch (error) {
      console.error('Failed to save job:', error);
      setToast(`Could not save job: ${error.message || error}`);
      window.setTimeout(() => setToast(''), 3200);
    }
  };

  const handleEditJob = (job) => {
    setEditingJob(job);
    setJobForm({ title: job.title || '', company: job.company || '', location: job.location || '' });
    setShowJobModal(true);
  };

  const handleDeleteJob = async (job) => {
    try {
      if (!job?.id) return;

      if (!isSupabaseReady || !supabase) {
        setToast('Supabase is not connected, so job removal was only applied locally.');
        window.setTimeout(() => setToast(''), 2600);
        return;
      }

      const { error: deleteError } = await supabase
        .from('job_descriptions')
        .delete()
        .eq('id', job.id);

      if (deleteError) {
        throw deleteError;
      }

      setToast('Job removed from Supabase.');
      window.setTimeout(() => setToast(''), 2600);
      refetch();
    } catch (error) {
      console.error('Failed to delete job:', error);
      setToast(`Could not delete job: ${error.message || error}`);
      window.setTimeout(() => setToast(''), 3200);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at top left, #111827 0%, #060814 55%, #03030a 100%)', color: 'white', padding: 28 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} style={{ height: 120, borderRadius: 28, background: 'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.1), rgba(255,255,255,0.05))', backgroundSize: '250% 100%', animation: 'shimmer 1.6s infinite' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a2332', color: '#e8eef7' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: '100vh' }}>
        <aside style={{ 
          position: 'sticky', 
          top: 0, 
          height: '100vh', 
          padding: 24, 
          borderRight: '1px solid rgba(70,100,150,0.25)', 
          background: '#1e2a3a',
          display: 'flex',
          flexDirection: 'column',
          gap: 20
        }}>
          <div style={{ 
            padding: 16, 
            borderRadius: 16, 
            background: '#253447', 
            border: '1px solid rgba(70,100,150,0.25)' 
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', color: '#e8eef7' }}>SkillBridge Admin</div>
            <div style={{ fontSize: 12, color: '#8a9bb5', marginTop: 6, lineHeight: 1.4 }}>Empowering careers, one skill at a time</div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                style={{
                  border: '1px solid',
                  borderColor: active === item.id ? 'rgba(91,127,196,0.4)' : 'transparent',
                  background: active === item.id ? 'rgba(91,127,196,0.15)' : 'transparent',
                  color: active === item.id ? '#e8eef7' : '#b4c3d9',
                  borderRadius: 12,
                  padding: '12px 16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: active === item.id ? 700 : 500,
                  fontSize: 14,
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  if (active !== item.id) {
                    e.currentTarget.style.background = 'rgba(91,127,196,0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (active !== item.id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div style={{ 
            padding: 16, 
            borderRadius: 16, 
            background: '#253447', 
            border: '1px solid rgba(70,100,150,0.25)' 
          }}>
            <div style={{ fontSize: 12, color: '#8a9bb5', marginBottom: 8 }}>Admin tools</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e8eef7' }}>
              {savedSettings.min_cgpa} CGPA / {savedSettings.min_ats_score}% ATS
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#8a9bb5', lineHeight: 1.5 }}>
              Required skills: {(savedSettings.required_skills || []).length ? (savedSettings.required_skills || []).join(', ') : 'None'}
            </div>
          </div>
        </aside>

        <main style={{ padding: 32, overflow: 'auto', background: '#1a2332' }}>
          <div style={{
            ...metricStyle,
            padding: 24,
            marginBottom: 32,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 20,
            flexWrap: 'wrap'
          }}>
            <div>
              <div style={{ color: '#8a9bb5', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Premium Admin Dashboard</div>
              <h1 style={{ 
                margin: 0, 
                fontSize: 'clamp(26px, 3.5vw, 38px)', 
                letterSpacing: '-0.03em', 
                fontWeight: 800,
                color: '#e8eef7',
                lineHeight: 1.1
              }}>
                Company control center
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button 
                onClick={refetch} 
                style={{ 
                  border: '1px solid rgba(91,127,196,0.3)', 
                  background: '#253447', 
                  color: '#e8eef7', 
                  borderRadius: 12, 
                  padding: '10px 18px', 
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit'
                }}
              >
                Refresh
              </button>
              <button 
                onClick={onLogout} 
                style={{ 
                  border: 'none', 
                  background: '#5b7fc4', 
                  color: 'white', 
                  borderRadius: 12, 
                  padding: '10px 18px', 
                  cursor: 'pointer', 
                  fontWeight: 700,
                  fontSize: 13,
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit'
                }}
              >
                Logout
              </button>
            </div>
          </div>

          {error && (
            <div style={{ 
              marginBottom: 20, 
              padding: 16, 
              borderRadius: 16, 
              background: 'rgba(239,68,68,0.15)', 
              border: '1px solid rgba(239,68,68,0.3)', 
              color: '#fca5a5',
              fontSize: 14
            }}>
              {error}
            </div>
          )}

          {toast && (
            <div style={{ 
              marginBottom: 20, 
              padding: 16, 
              borderRadius: 16, 
              background: 'rgba(34,197,94,0.15)', 
              border: '1px solid rgba(34,197,94,0.3)', 
              color: '#86efac',
              fontSize: 14
            }}>
              {toast}
            </div>
          )}

          <AnimatePresence mode="wait">
            {active === 'overview' && (
              <motion.div 
                key="overview" 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }} 
                style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                  <StatCard label="Total Students" value={totalStudents} hint="Synced from resumes table" accent="#38bdf8" />
                  <StatCard label="Average ATS Score" value={Math.round(averageAts)} hint="From jd_matches" accent="#8b5cf6" />
                  <StatCard label="Placement Readiness" value={`${placementReadiness}%`} hint="Eligible students vs total" accent="#22c55e" />
                  <StatCard label="Active Jobs" value={activeJobs} hint="Live job descriptions" accent="#f59e0b" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
                  <div style={{ ...metricStyle, padding: 24, minHeight: 320 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: '#e8eef7' }}>ATS score distribution</div>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(91,127,196,0.2)" />
                        <XAxis dataKey="name" stroke="#8a9bb5" style={{ fontSize: 12 }} />
                        <YAxis stroke="#8a9bb5" style={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ background: '#253447', border: '1px solid rgba(91,127,196,0.3)', borderRadius: 12, color: '#e8eef7' }} />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                          {chartData.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ ...metricStyle, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#e8eef7' }}>Readiness gauge</div>
                    <Gauge value={Math.max(placementReadiness, Math.round(averageAts))} label="ready" />
                    <div style={{ marginTop: 12, color: '#8a9bb5', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>
                      Based on eligibility settings and student performance.
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {active === 'summary' && (
              <motion.div key="summary" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                <SectionShell title="Executive Summary" subtitle="Comprehensive overview of student performance, eligibility, and placement readiness.">
                  
                  {/* Analytics Charts */}
                  <div>
                    <div style={{ marginBottom: 20 }}>
                      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#e8eef7', letterSpacing: '-0.02em' }}>Performance Analytics</h3>
                      <p style={{ margin: '8px 0 0 0', fontSize: 14, color: '#8a9bb5' }}>Visual breakdown of key metrics and distributions</p>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 20 }}>
                      {/* Eligibility Breakdown */}
                      <div style={{ ...metricStyle, padding: 28 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#e8eef7' }}>Eligibility Breakdown</div>
                            <div style={{ fontSize: 12, color: '#8a9bb5', marginTop: 4 }}>Student qualification status</div>
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height={280}>
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Eligible', value: eligibilityBreakdown.totalEligible, fill: '#22c55e' },
                                { name: 'Not Eligible', value: eligibilityBreakdown.notEligible, fill: '#ef4444' }
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={70}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                            >
                            </Pie>
                            <Tooltip 
                              contentStyle={{ 
                                background: '#1e2a3a', 
                                border: '1px solid rgba(91,127,196,0.3)', 
                                borderRadius: 12, 
                                color: '#e8eef7',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                              }} 
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
                            <span style={{ fontSize: 13, color: '#b4c3d9', fontWeight: 500 }}>Eligible ({eligibilityBreakdown.totalEligible})</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
                            <span style={{ fontSize: 13, color: '#b4c3d9', fontWeight: 500 }}>Not Eligible ({eligibilityBreakdown.notEligible})</span>
                          </div>
                        </div>
                      </div>

                      {/* ATS Distribution */}
                      <div style={{ ...metricStyle, padding: 28 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#e8eef7' }}>ATS Score Distribution</div>
                            <div style={{ fontSize: 12, color: '#8a9bb5', marginTop: 4 }}>Resume screening performance</div>
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(91,127,196,0.15)" vertical={false} />
                            <XAxis 
                              dataKey="name" 
                              stroke="#8a9bb5" 
                              style={{ fontSize: 12 }}
                              tickLine={false}
                              axisLine={{ stroke: 'rgba(91,127,196,0.2)' }}
                            />
                            <YAxis 
                              stroke="#8a9bb5" 
                              style={{ fontSize: 12 }}
                              tickLine={false}
                              axisLine={{ stroke: 'rgba(91,127,196,0.2)' }}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                background: '#1e2a3a', 
                                border: '1px solid rgba(91,127,196,0.3)', 
                                borderRadius: 12, 
                                color: '#e8eef7',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                              }} 
                            />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                              {chartData.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* CGPA Distribution */}
                      <div style={{ ...metricStyle, padding: 28 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#e8eef7' }}>CGPA Distribution</div>
                            <div style={{ fontSize: 12, color: '#8a9bb5', marginTop: 4 }}>Academic performance spread</div>
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={[
                            { range: '4-5', count: students.filter(s => !isNaN(Number(s.cgpa)) && Number(s.cgpa) >= 4 && Number(s.cgpa) < 5).length },
                            { range: '5-6', count: students.filter(s => !isNaN(Number(s.cgpa)) && Number(s.cgpa) >= 5 && Number(s.cgpa) < 6).length },
                            { range: '6-7', count: students.filter(s => !isNaN(Number(s.cgpa)) && Number(s.cgpa) >= 6 && Number(s.cgpa) < 7).length },
                            { range: '7-8', count: students.filter(s => !isNaN(Number(s.cgpa)) && Number(s.cgpa) >= 7 && Number(s.cgpa) < 8).length },
                            { range: '8-9', count: students.filter(s => !isNaN(Number(s.cgpa)) && Number(s.cgpa) >= 8 && Number(s.cgpa) < 9).length },
                            { range: '9-10', count: students.filter(s => !isNaN(Number(s.cgpa)) && Number(s.cgpa) >= 9).length },
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(91,127,196,0.15)" vertical={false} />
                            <XAxis 
                              dataKey="range" 
                              stroke="#8a9bb5" 
                              style={{ fontSize: 12 }}
                              tickLine={false}
                              axisLine={{ stroke: 'rgba(91,127,196,0.2)' }}
                            />
                            <YAxis 
                              stroke="#8a9bb5" 
                              style={{ fontSize: 12 }}
                              tickLine={false}
                              axisLine={{ stroke: 'rgba(91,127,196,0.2)' }}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                background: '#1e2a3a', 
                                border: '1px solid rgba(91,127,196,0.3)', 
                                borderRadius: 12, 
                                color: '#e8eef7',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                              }} 
                            />
                            <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="#38bdf8" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Skills Gap */}
                      <div style={{ ...metricStyle, padding: 28 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#e8eef7' }}>Skills Gap Analysis</div>
                            <div style={{ fontSize: 12, color: '#8a9bb5', marginTop: 4 }}>Students lacking required skills</div>
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={skillGaps}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(91,127,196,0.15)" vertical={false} />
                            <XAxis 
                              dataKey="skill" 
                              stroke="#8a9bb5" 
                              style={{ fontSize: 12 }}
                              tickLine={false}
                              axisLine={{ stroke: 'rgba(91,127,196,0.2)' }}
                            />
                            <YAxis 
                              stroke="#8a9bb5" 
                              style={{ fontSize: 12 }}
                              tickLine={false}
                              axisLine={{ stroke: 'rgba(91,127,196,0.2)' }}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                background: '#1e2a3a', 
                                border: '1px solid rgba(91,127,196,0.3)', 
                                borderRadius: 12, 
                                color: '#e8eef7',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                              }} 
                            />
                            <Bar dataKey="students" radius={[8, 8, 0, 0]} fill="#8b5cf6" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  
                  {/* Summary Text Insights */}
                  <div style={{ ...metricStyle, padding: 28 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#e8eef7' }}>Dashboard Insights</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ padding: 16, borderRadius: 12, background: 'rgba(91,127,196,0.1)', border: '1px solid rgba(91,127,196,0.25)' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#6b93d6', marginBottom: 8 }}>📊 Student Overview</div>
                        <div style={{ fontSize: 14, color: '#e8eef7', lineHeight: 1.7 }}>
                          Currently tracking <strong>{totalStudents}</strong> students with an average ATS score of <strong>{Math.round(averageAts)}</strong>. 
                          The average CGPA across all students is <strong>{totalStudents ? (students.reduce((sum, s) => sum + Number(s.cgpa || 0), 0) / totalStudents).toFixed(2) : '0.00'}</strong>.
                          {totalStudents > 0 && ` The top performer has achieved an ATS score of ${Math.max(...students.map(s => Number(s.ats_score || 0)))}.`}
                        </div>
                      </div>

                      <div style={{ padding: 16, borderRadius: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#22c55e', marginBottom: 8 }}>✅ Eligibility Status</div>
                        <div style={{ fontSize: 14, color: '#e8eef7', lineHeight: 1.7 }}>
                          Out of {totalStudents} students, <strong>{eligibilityBreakdown.totalEligible}</strong> ({Math.round((eligibilityBreakdown.totalEligible / totalStudents) * 100)}%) 
                          meet all eligibility criteria. <strong>{eligibilityBreakdown.cgpaCount}</strong> students meet the CGPA requirement (≥{savedSettings.min_cgpa}), 
                          <strong> {eligibilityBreakdown.atsCount}</strong> meet the ATS threshold (≥{savedSettings.min_ats_score}%), 
                          and <strong>{eligibilityBreakdown.skillsCount}</strong> possess all required skills.
                        </div>
                      </div>

                      <div style={{ padding: 16, borderRadius: 12, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#8b5cf6', marginBottom: 8 }}>🎯 Skills Analysis</div>
                        <div style={{ fontSize: 14, color: '#e8eef7', lineHeight: 1.7 }}>
                          {(() => {
                            const skillCount = {};
                            students.forEach(student => {
                              (student.skills || []).forEach(skill => {
                                const skillName = typeof skill === 'string' ? skill : skill.name;
                                skillCount[skillName] = (skillCount[skillName] || 0) + 1;
                              });
                            });
                            const topSkills = Object.entries(skillCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
                            return topSkills.length > 0 
                              ? `The most common skills are ${topSkills.map(([skill, count]) => `${skill} (${count} students)`).join(', ')}. `
                              : 'No skill data available yet. ';
                          })()}
                          {savedSettings.required_skills?.length > 0 && `Required skills for placement include: ${savedSettings.required_skills.join(', ')}.`}
                        </div>
                      </div>

                      <div style={{ padding: 16, borderRadius: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#f59e0b', marginBottom: 8 }}>💼 Job Market</div>
                        <div style={{ fontSize: 14, color: '#e8eef7', lineHeight: 1.7 }}>
                          There are currently <strong>{activeJobs}</strong> active job openings available for students. 
                          {activeJobs > 0 && ` Students can explore these opportunities through the Job Finder section.`}
                          {activeJobs === 0 && ` Add job descriptions to help students find relevant opportunities.`}
                        </div>
                      </div>

                      <div style={{ padding: 16, borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>⚠️ Areas of Concern</div>
                        <div style={{ fontSize: 14, color: '#e8eef7', lineHeight: 1.7 }}>
                          {eligibilityBreakdown.notEligible > 0 && `${eligibilityBreakdown.notEligible} students (${Math.round((eligibilityBreakdown.notEligible / totalStudents) * 100)}%) do not meet all eligibility criteria. `}
                          {(() => {
                            const lowAts = students.filter(s => Number(s.ats_score || 0) < 40).length;
                            const lowCgpa = students.filter(s => Number(s.cgpa || 0) < 6).length;
                            const concerns = [];
                            if (lowAts > 0) concerns.push(`${lowAts} students have ATS scores below 40`);
                            if (lowCgpa > 0) concerns.push(`${lowCgpa} students have CGPA below 6.0`);
                            return concerns.length > 0 ? concerns.join(', ') + '. Focus on improving these metrics through targeted interventions.' : 'All students are performing well across key metrics.';
                          })()}
                        </div>
                      </div>

                      <div style={{ padding: 16, borderRadius: 12, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#38bdf8', marginBottom: 8 }}>📈 Recommendations</div>
                        <div style={{ fontSize: 14, color: '#e8eef7', lineHeight: 1.7 }}>
                          {placementReadiness < 50 && 'Consider lowering eligibility thresholds or providing additional training to increase placement readiness. '}
                          {eligibilityBreakdown.skillsCount < totalStudents * 0.7 && 'Focus on upskilling programs to help more students acquire required technical skills. '}
                          {averageAts < 60 && 'Conduct resume workshops to improve ATS scores across the student body. '}
                          {placementReadiness >= 70 && 'Strong placement readiness! Continue monitoring and supporting students through the placement process.'}
                        </div>
                      </div>
                    </div>
                  </div>

                </SectionShell>
              </motion.div>
            )}

            {active === 'students' && (
              <motion.div key="students" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <StudentsSection students={students} settings={savedSettings} loading={loading} error={error} onRefresh={refetch} />
              </motion.div>
            )}

            {active === 'eligibility' && (
              <motion.div key="eligibility" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <SectionShell title="Eligibility control panel" subtitle="Tune screening rules for company placement and shortlist automation.">
                  <div style={{ ...metricStyle, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontWeight: 700 }}>Minimum CGPA</span>
                        <span>{savedSettings.min_cgpa.toFixed(1)}</span>
                      </div>
                      <input type="range" min="4" max="10" step="0.1" value={savedSettings.min_cgpa} onChange={(e) => setSavedSettings((prev) => ({ ...prev, min_cgpa: Number(e.target.value) }))} style={rangeStyle} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontWeight: 700 }}>Minimum ATS Score</span>
                        <span>{savedSettings.min_ats_score}%</span>
                      </div>
                      <input type="range" min="0" max="100" step="1" value={savedSettings.min_ats_score} onChange={(e) => setSavedSettings((prev) => ({ ...prev, min_ats_score: Number(e.target.value) }))} style={rangeStyle} />
                    </div>

                    <div>
                      <div style={{ marginBottom: 12, fontWeight: 700 }}>Required Skills</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        {(savedSettings.required_skills || []).map((skill) => (
                          <span 
                            key={skill} 
                            style={{ 
                              padding: '8px 12px', 
                              borderRadius: 999, 
                              background: 'rgba(255,255,255,0.08)', 
                              border: '1px solid rgba(255,255,255,0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8
                            }}
                          >
                            {skill}
                            <button
                              onClick={() => {
                                setSavedSettings(prev => ({
                                  ...prev,
                                  required_skills: prev.required_skills.filter(s => s !== skill)
                                }));
                              }}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                color: 'rgba(255,255,255,0.6)',
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: 16,
                                lineHeight: 1
                              }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          value={newSkill}
                          onChange={(e) => setNewSkill(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && newSkill.trim()) {
                              setSavedSettings(prev => ({
                                ...prev,
                                required_skills: [...(prev.required_skills || []), newSkill.trim()]
                              }));
                              setNewSkill('');
                            }
                          }}
                          placeholder="Add a skill (e.g., Docker, AWS)"
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'rgba(255,255,255,0.08)',
                            color: 'white',
                            fontSize: 13,
                            outline: 'none'
                          }}
                        />
                        <button
                          onClick={() => {
                            if (newSkill.trim()) {
                              setSavedSettings(prev => ({
                                ...prev,
                                required_skills: [...(prev.required_skills || []), newSkill.trim()]
                              }));
                              setNewSkill('');
                            }
                          }}
                          style={{
                            borderRadius: 12,
                            padding: '10px 18px',
                            background: 'rgba(139,92,246,0.2)',
                            border: '1px solid rgba(139,92,246,0.3)',
                            color: '#a78bfa',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: 13
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={saveEligibility} style={{ border: 'none', borderRadius: 999, padding: '12px 16px', background: 'linear-gradient(135deg, #8b5cf6, #38bdf8)', color: 'white', fontWeight: 800, cursor: 'pointer' }}>Save criteria</button>
                    </div>
                  </div>
                </SectionShell>

                <SectionShell title="Eligibility statistics" subtitle="Visual breakdown of student eligibility based on current criteria.">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                    <div style={{ ...metricStyle, padding: 20 }}>
                      <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 15 }}>Eligibility breakdown</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart key={`pie-${eligibilityBreakdown.totalEligible}-${students.length}`}>
                          <Pie
                            data={[
                              { name: 'Eligible', value: eligibilityBreakdown.totalEligible, fill: '#22c55e' },
                              { name: 'Not Eligible', value: eligibilityBreakdown.notEligible, fill: '#ef4444' }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                            animationBegin={0}
                            animationDuration={800}
                          >
                          </Pie>
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Eligible: {eligibilityBreakdown.totalEligible}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Not Eligible: {eligibilityBreakdown.notEligible}</span>
                        </div>
                      </div>
                      <div style={{ marginTop: 10, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.52)' }}>
                        Total eligible is the bottleneck (minimum) of all three criteria.
                      </div>
                    </div>

                    <div style={{ ...metricStyle, padding: 20 }}>
                      <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 15 }}>CGPA distribution</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={[
                          { range: '4-5', count: students.filter(s => !isNaN(Number(s.cgpa)) && Number(s.cgpa) >= 4 && Number(s.cgpa) < 5).length },
                          { range: '5-6', count: students.filter(s => !isNaN(Number(s.cgpa)) && Number(s.cgpa) >= 5 && Number(s.cgpa) < 6).length },
                          { range: '6-7', count: students.filter(s => !isNaN(Number(s.cgpa)) && Number(s.cgpa) >= 6 && Number(s.cgpa) < 7).length },
                          { range: '7-8', count: students.filter(s => !isNaN(Number(s.cgpa)) && Number(s.cgpa) >= 7 && Number(s.cgpa) < 8).length },
                          { range: '8-9', count: students.filter(s => !isNaN(Number(s.cgpa)) && Number(s.cgpa) >= 8 && Number(s.cgpa) < 9).length },
                          { range: '9-10', count: students.filter(s => !isNaN(Number(s.cgpa)) && Number(s.cgpa) >= 9).length },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="range" stroke="rgba(255,255,255,0.48)" style={{ fontSize: 11 }} />
                          <YAxis stroke="rgba(255,255,255,0.48)" style={{ fontSize: 11 }} />
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12 }} />
                          <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="#38bdf8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div style={{ ...metricStyle, padding: 20 }}>
                      <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 15 }}>Students meeting criteria</div>
                      <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>CGPA ≥ {savedSettings.min_cgpa}</span>
                          <span style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{eligibilityBreakdown.cgpaCount}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 12, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)' }}>
                          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>ATS ≥ {savedSettings.min_ats_score}%</span>
                          <span style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8' }}>{eligibilityBreakdown.atsCount}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 12, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
                          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Has required skills</span>
                          <span style={{ fontSize: 18, fontWeight: 800, color: '#8b5cf6' }}>
                            {eligibilityBreakdown.skillsCount}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(56,189,248,0.15))', border: '1px solid rgba(139,92,246,0.3)' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>Total Eligible</span>
                          <span style={{ fontSize: 22, fontWeight: 800, color: 'white' }}>{eligibilityBreakdown.totalEligible}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionShell>
              </motion.div>
            )}

            {active === 'jobs' && (
              <motion.div key="jobs" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ display: 'grid', gap: 16 }}>
                <SectionShell title="Job management" subtitle="Add, edit, and monitor company job postings.">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ color: '#8a9bb5', fontSize: 13 }}>
                      Showing every job row stored in Supabase.
                    </div>
                    <button onClick={() => setShowJobModal(true)} style={{ border: 'none', borderRadius: 999, padding: '12px 16px', background: 'linear-gradient(135deg, #8b5cf6, #22d3ee)', color: 'white', fontWeight: 800, cursor: 'pointer' }}>Add job</button>
                  </div>
                  <div style={{ overflow: 'hidden', borderRadius: 26, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ textAlign: 'left', color: 'rgba(255,255,255,0.64)' }}>
                          <th style={th}>Title</th>
                          <th style={th}>Company</th>
                          <th style={th}>Location</th>
                          <th style={th}>Match</th>
                          <th style={th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveJobs.length ? liveJobs.map((job) => {
                          const parsed = job.parsed_data || {};
                          const matchLabel = parsed.match_percentage != null ? `${Math.round(Number(parsed.match_percentage))}%` : '-';
                          const title = job.title || parsed.title || 'Recommended job';
                          const company = job.company || parsed.company || '-';
                          const location = job.location || parsed.location || '-';
                          const source = parsed.source || 'job_descriptions';
                          return (
                          <tr key={job.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <td style={td}>{title}</td>
                            <td style={td}>{company}</td>
                            <td style={td}>{location}</td>
                            <td style={td}>{matchLabel}</td>
                            <td style={td}>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => handleEditJob(job)} style={tableButton}>Edit</button>
                                <button onClick={() => handleDeleteJob(job)} style={tableButton}>Delete</button>
                              </div>
                              <div style={{ marginTop: 8, fontSize: 11, color: '#8a9bb5' }}>{source}</div>
                            </td>
                          </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan={5} style={{ padding: 24, color: '#8a9bb5' }}>
                              No live job recommendations yet. Run Job Finder to populate this section from Supabase.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionShell>
              </motion.div>
            )}

            {active === 'analytics' && (
              <motion.div key="analytics" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <SectionShell title="Analytics" subtitle="See ATS distribution, skills gaps, and student performance trends.">
                  
                  {/* Key Metrics Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    <div style={{ ...metricStyle, padding: 20, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: '#8a9bb5', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg CGPA</div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: '#e8eef7', lineHeight: 1 }}>
                        {totalStudents ? (students.reduce((sum, s) => sum + Number(s.cgpa || 0), 0) / totalStudents).toFixed(2) : '0.00'}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 11, color: '#8a9bb5' }}>Across {totalStudents} students</div>
                    </div>
                    
                    <div style={{ ...metricStyle, padding: 20, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: '#8a9bb5', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Top ATS Score</div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: '#e8eef7', lineHeight: 1 }}>
                        {totalStudents ? Math.max(...students.map(s => Number(s.ats_score || 0))) : 0}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 11, color: '#8a9bb5' }}>Highest performer</div>
                    </div>
                    
                    <div style={{ ...metricStyle, padding: 20, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: '#8a9bb5', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Skills Coverage</div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: '#e8eef7', lineHeight: 1 }}>
                        {savedSettings.required_skills?.length ? Math.round((eligibilityBreakdown.skillsCount / totalStudents) * 100) : 0}%
                      </div>
                      <div style={{ marginTop: 8, fontSize: 11, color: '#8a9bb5' }}>Students with all skills</div>
                    </div>
                    
                    <div style={{ ...metricStyle, padding: 20, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: '#8a9bb5', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Job Openings</div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: '#e8eef7', lineHeight: 1 }}>
                        {activeJobs}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 11, color: '#8a9bb5' }}>Active positions</div>
                    </div>
                  </div>

                  {/* Main Charts Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 16 }}>
                    <div style={{ ...metricStyle, padding: 24, minHeight: 340 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#e8eef7' }}>Skills gap analysis</div>
                      <ResponsiveContainer width="100%" height={270}>
                        <BarChart data={skillGaps}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(91,127,196,0.2)" />
                          <XAxis dataKey="skill" stroke="#8a9bb5" style={{ fontSize: 12 }} />
                          <YAxis stroke="#8a9bb5" style={{ fontSize: 12 }} />
                          <Tooltip contentStyle={{ background: '#253447', border: '1px solid rgba(91,127,196,0.3)', borderRadius: 12, color: '#e8eef7' }} />
                          <Bar dataKey="students" radius={[10, 10, 0, 0]} fill="#8b5cf6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div style={{ ...metricStyle, padding: 24, minHeight: 340 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#e8eef7' }}>Student performance trends</div>
                      <ResponsiveContainer width="100%" height={270}>
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(91,127,196,0.2)" />
                          <XAxis dataKey="name" stroke="#8a9bb5" style={{ fontSize: 12 }} />
                          <YAxis stroke="#8a9bb5" style={{ fontSize: 12 }} />
                          <Tooltip contentStyle={{ background: '#253447', border: '1px solid rgba(91,127,196,0.3)', borderRadius: 12, color: '#e8eef7' }} />
                          <Legend wrapperStyle={{ color: '#e8eef7' }} />
                          <Line type="monotone" dataKey="ats" stroke="#38bdf8" strokeWidth={3} dot={{ r: 5, fill: '#38bdf8' }} name="ATS Score" />
                          <Line type="monotone" dataKey="progress" stroke="#22c55e" strokeWidth={3} dot={{ r: 5, fill: '#22c55e' }} name="Progress" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Additional Analytics Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 16 }}>
                    {/* ATS Score Distribution Pie Chart */}
                    <div style={{ ...metricStyle, padding: 24 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#e8eef7' }}>ATS Score Categories</div>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Excellent (80-100)', value: students.filter(s => Number(s.ats_score || 0) >= 80).length, fill: '#22c55e' },
                              { name: 'Good (60-79)', value: students.filter(s => Number(s.ats_score || 0) >= 60 && Number(s.ats_score || 0) < 80).length, fill: '#38bdf8' },
                              { name: 'Average (40-59)', value: students.filter(s => Number(s.ats_score || 0) >= 40 && Number(s.ats_score || 0) < 60).length, fill: '#f59e0b' },
                              { name: 'Below Average (<40)', value: students.filter(s => Number(s.ats_score || 0) < 40).length, fill: '#ef4444' }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                          />
                          <Tooltip contentStyle={{ background: '#253447', border: '1px solid rgba(91,127,196,0.3)', borderRadius: 12, color: '#e8eef7' }} />
                          <Legend wrapperStyle={{ fontSize: 12, color: '#e8eef7' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Top Skills Distribution */}
                    <div style={{ ...metricStyle, padding: 24, minHeight: 340 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#e8eef7' }}>Top Skills Distribution</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {(() => {
                          const skillCount = {};
                          students.forEach(student => {
                            (student.skills || []).forEach(skill => {
                              const skillName = typeof skill === 'string' ? skill : skill.name;
                              skillCount[skillName] = (skillCount[skillName] || 0) + 1;
                            });
                          });
                          return Object.entries(skillCount)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 6)
                            .map(([skill, count], idx) => (
                              <div key={skill} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ 
                                  minWidth: 32, 
                                  height: 32, 
                                  borderRadius: 8, 
                                  background: `${colors[idx % colors.length]}20`, 
                                  border: `1px solid ${colors[idx % colors.length]}40`,
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: colors[idx % colors.length]
                                }}>
                                  {idx + 1}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eef7', marginBottom: 4 }}>{skill}</div>
                                  <div style={{ height: 6, background: 'rgba(91,127,196,0.2)', borderRadius: 999, overflow: 'hidden' }}>
                                    <div style={{ 
                                      height: '100%', 
                                      width: `${(count / totalStudents) * 100}%`, 
                                      background: colors[idx % colors.length],
                                      borderRadius: 999,
                                      transition: 'width 0.5s ease'
                                    }} />
                                  </div>
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: '#e8eef7', minWidth: 40, textAlign: 'right' }}>
                                  {count}
                                </div>
                              </div>
                            ));
                        })()}
                      </div>
                    </div>

                    {/* Eligibility Funnel */}
                    <div style={{ ...metricStyle, padding: 24 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#e8eef7' }}>Eligibility Funnel</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                          { label: 'Total Students', count: totalStudents, color: '#6b93d6', width: 100 },
                          { label: 'Meet CGPA', count: eligibilityBreakdown.cgpaCount, color: '#38bdf8', width: (eligibilityBreakdown.cgpaCount / totalStudents) * 100 },
                          { label: 'Meet ATS', count: eligibilityBreakdown.atsCount, color: '#8b5cf6', width: (eligibilityBreakdown.atsCount / totalStudents) * 100 },
                          { label: 'Have Skills', count: eligibilityBreakdown.skillsCount, color: '#f59e0b', width: (eligibilityBreakdown.skillsCount / totalStudents) * 100 },
                          { label: 'Fully Eligible', count: eligibilityBreakdown.totalEligible, color: '#22c55e', width: (eligibilityBreakdown.totalEligible / totalStudents) * 100 }
                        ].map((item, idx) => (
                          <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#e8eef7' }}>{item.label}</span>
                              <span style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.count}</span>
                            </div>
                            <div style={{ 
                              height: 32, 
                              background: 'rgba(91,127,196,0.15)', 
                              borderRadius: 8,
                              overflow: 'hidden',
                              position: 'relative'
                            }}>
                              <div style={{ 
                                height: '100%', 
                                width: `${item.width}%`, 
                                background: item.color,
                                borderRadius: 8,
                                transition: 'width 0.8s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                paddingRight: 12
                              }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>
                                  {Math.round(item.width)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </SectionShell>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {showJobModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={modalBackdrop} onClick={() => setShowJobModal(false)}>
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} transition={{ duration: 0.2 }} style={modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.05em' }}>{editingJob ? 'Edit job' : 'Add job'}</div>
              <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                <input value={jobForm.title} onChange={(e) => setJobForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Title" style={modalInput} />
                <input value={jobForm.company} onChange={(e) => setJobForm((prev) => ({ ...prev, company: e.target.value }))} placeholder="Company" style={modalInput} />
                <input value={jobForm.location} onChange={(e) => setJobForm((prev) => ({ ...prev, location: e.target.value }))} placeholder="Location" style={modalInput} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                  <button onClick={() => setShowJobModal(false)} style={secondaryButton}>Cancel</button>
                  <button onClick={handleJobSave} style={primaryButton}>Save</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const th = { padding: '16px 20px', fontSize: 13, fontWeight: 700, color: '#8a9bb5', textTransform: 'uppercase', letterSpacing: '0.05em' };
const td = { padding: '16px 20px', fontSize: 14, color: '#e8eef7' };
const tableButton = { 
  border: '1px solid rgba(91,127,196,0.3)', 
  background: '#253447', 
  color: '#e8eef7', 
  borderRadius: 10, 
  padding: '8px 14px', 
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  transition: 'all 0.2s ease'
};
const rangeStyle = { width: '100%', accentColor: '#6b93d6', height: 6 };
const chip = { padding: '6px 12px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: '#86efac', border: '1px solid rgba(34,197,94,0.3)', fontSize: 12, fontWeight: 600 };
const chipMuted = { padding: '6px 12px', borderRadius: 999, background: '#253447', color: '#b4c3d9', border: '1px solid rgba(91,127,196,0.25)', fontSize: 12, fontWeight: 600 };
const modalBackdrop = { position: 'fixed', inset: 0, background: 'rgba(10,15,30,0.85)', backdropFilter: 'blur(12px)', display: 'grid', placeItems: 'center', zIndex: 100 };
const modalCard = { width: 'min(92vw, 520px)', borderRadius: 20, background: '#1e2a3a', border: '1px solid rgba(91,127,196,0.3)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', padding: 28 };
const modalInput = { border: '1px solid rgba(91,127,196,0.3)', background: '#253447', color: '#e8eef7', borderRadius: 12, padding: '12px 16px', outline: 'none', fontSize: 14, width: '100%' };
const primaryButton = { border: 'none', borderRadius: 12, padding: '12px 20px', background: '#5b7fc4', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 14 };
const secondaryButton = { border: '1px solid rgba(91,127,196,0.3)', borderRadius: 12, padding: '12px 20px', background: '#253447', color: '#e8eef7', cursor: 'pointer', fontWeight: 600, fontSize: 14 };

function MiniText({ title, items }) {
  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ color: 'rgba(255,255,255,0.68)', fontSize: 13, lineHeight: 1.6 }}>{items.length ? items.join(' • ') : 'No data available.'}</div>
    </div>
  );
}
