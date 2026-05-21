import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { isSupabaseReady, supabase } from '../../lib/supabaseClient';

const defaultSettings = {
  min_cgpa: 7,
  min_ats_score: 65,
  required_skills: ['Python', 'React', 'SQL'],
};

const arrayify = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

const normalizeSkills = (skills) => {
  if (!Array.isArray(skills)) return [];
  return skills
    .map((skill) => {
      if (typeof skill === 'string') return skill.trim();
      if (skill && typeof skill === 'object') return String(skill.name || skill.skill || '').trim();
      return '';
    })
    .filter(Boolean);
};

const extractCgpa = (parsedData) => {
  const candidates = [
    parsedData?.cgpa,
    parsedData?.education?.[0]?.gpa,
    parsedData?.education?.[0]?.cgpa,
    parsedData?.summary?.cgpa,
  ];

  for (const candidate of candidates) {
    const numeric = Number.parseFloat(String(candidate ?? '').replace(/[^0-9.]/g, ''));
    if (!Number.isNaN(numeric) && numeric > 0) return numeric;
  }

  return null;
};

const calculateEligibility = (student, settings) => {
  const requiredSkills = normalizeSkills(settings?.required_skills || []);
  const hasSkills = requiredSkills.length === 0 || requiredSkills.every((skill) =>
    student.skills.some((value) => value.toLowerCase().includes(skill.toLowerCase()))
  );
  const cgpaOk = student.cgpa === null ? false : student.cgpa >= Number(settings?.min_cgpa ?? defaultSettings.min_cgpa);
  const atsOk = Number(student.ats_score || 0) >= Number(settings?.min_ats_score ?? defaultSettings.min_ats_score);
  const missingRules = [];
  if (!cgpaOk) missingRules.push(`CGPA < ${Number(settings?.min_cgpa ?? defaultSettings.min_cgpa)}`);
  if (!atsOk) missingRules.push(`ATS < ${Number(settings?.min_ats_score ?? defaultSettings.min_ats_score)}%`);
  if (!hasSkills && requiredSkills.length) missingRules.push(`Missing ${requiredSkills.filter((skill) => !student.skills.some((value) => value.toLowerCase().includes(skill.toLowerCase()))).join(', ')}`);

  return {
    eligible: cgpaOk && atsOk && hasSkills,
    meetsCGPA: cgpaOk,
    meetsATS: atsOk,
    meetsSkills: hasSkills,
    missingRules,
  };
};

const mergeStudentRecords = (resumes, matches, progressMetrics, roadmaps, roadmapTasks, settings) => {
  const matchesByResume = new Map((matches || []).map((item) => [item.resume_id, item]));
  const progressByResume = new Map((progressMetrics || []).map((item) => [item.resume_id, item]));
  const roadmapsByResume = new Map((roadmaps || []).map((item) => [item.resume_id, item]));
  const tasksByRoadmap = new Map();
  (roadmapTasks || []).forEach((task) => {
    const existing = tasksByRoadmap.get(task.roadmap_id) || [];
    existing.push(task);
    tasksByRoadmap.set(task.roadmap_id, existing);
  });

  return (resumes || []).map((resume) => {
    const parsed = resume.parsed_data || {};
    const match = matchesByResume.get(resume.id) || {};
    const progress = progressByResume.get(resume.id) || {};
    const roadmap = roadmapsByResume.get(resume.id) || null;
    const roadmapTasksForResume = roadmap ? tasksByRoadmap.get(roadmap.id) || [] : [];
    const completedTasks = Number(progress.completed_tasks ?? roadmapTasksForResume.filter((task) => task.completed).length ?? 0);
    const totalTasks = roadmapTasksForResume.length || Number(progress.total_tasks || 0);
    const progressPct = Number(progress.progress ?? (totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0));

    const student = {
      id: resume.id,
      name: parsed.name || resume.filename || 'Unnamed student',
      skills: normalizeSkills(parsed.skills),
      cgpa: extractCgpa(parsed),
      ats_score: Number(match.match_percentage || 0),
      strengths: arrayify(match.strengths),
      weaknesses: arrayify(match.weaknesses),
      progress: progressPct,
      weak_areas: arrayify(progress.weak_areas),
      completed_tasks: completedTasks,
      total_tasks: totalTasks,
      matched_skills: arrayify(match.matched_skills),
      missing_skills: arrayify(match.missing_skills),
      eligibility_note: progress.eligibility_note || '',
      roadmap,
    };

    const eligibility = calculateEligibility(student, settings);

    return {
      ...student,
      eligible: eligibility.eligible,
      eligibility,
    };
  });
};

export function useAdminData() {
  const [state, setState] = useState({
    students: [],
    jobs: [],
    roadmaps: [],
    roadmapTasks: [],
    settings: defaultSettings,
    loading: true,
    error: '',
  });

  const loadData = useCallback(async () => {
    if (!isSupabaseReady || !supabase) {
      setState((previous) => ({
        ...previous,
        loading: false,
        error: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to load live admin data.',
      }));
      return;
    }

    setState((previous) => ({ ...previous, loading: true, error: '' }));

    const safeSelect = async (queryBuilder, fallback = []) => {
      const response = await queryBuilder;
      if (response.error) {
        return { data: fallback, error: response.error };
      }
      return { data: response.data || fallback, error: null };
    };

    const [resumesResult, matchesResult, progressResult, settingsResult, jobsResult, roadmapsResult, roadmapTasksResult] = await Promise.all([
      safeSelect(supabase.from('resumes').select('id, filename, parsed_data, uploaded_at').order('uploaded_at', { ascending: false })),
      safeSelect(supabase.from('jd_matches').select('resume_id, match_percentage, strengths, weaknesses, matched_skills, missing_skills, created_at').order('created_at', { ascending: false })),
      safeSelect(supabase.from('progress_metrics').select('resume_id, completed_tasks, total_tasks, weak_areas')),
      safeSelect(supabase.from('admin_settings').select('min_cgpa, min_ats_score, required_skills, updated_at').order('updated_at', { ascending: false }).limit(1), [defaultSettings]),
      safeSelect(supabase.from('job_descriptions').select('id, title, company, location, raw_text, parsed_data, created_at').order('created_at', { ascending: false })),
      safeSelect(supabase.from('roadmaps').select('id, resume_id, job_description_id, duration_weeks, daily_hours, milestones, completion_criteria, created_at').order('created_at', { ascending: false })),
      safeSelect(supabase.from('roadmap_tasks').select('id, roadmap_id, week, task, skill, difficulty, estimated_hours, completed, milestone, priority, resources').order('week', { ascending: true })),
    ]);

    const warnings = [resumesResult.error, matchesResult.error, progressResult.error, settingsResult.error, jobsResult.error, roadmapsResult.error, roadmapTasksResult.error]
      .filter(Boolean)
      .map((issue) => issue.message || String(issue));

    const settingsRow = settingsResult.data?.[0] || defaultSettings;
    const mergedStudents = mergeStudentRecords(
      resumesResult.data || [],
      matchesResult.data || [],
      progressResult.data || [],
      roadmapsResult.data || [],
      roadmapTasksResult.data || [],
      {
        min_cgpa: Number(settingsRow.min_cgpa ?? defaultSettings.min_cgpa),
        min_ats_score: Number(settingsRow.min_ats_score ?? defaultSettings.min_ats_score),
        required_skills: normalizeSkills(settingsRow.required_skills || defaultSettings.required_skills),
      },
    );

    setState({
      students: mergedStudents,
      jobs: jobsResult.data || [],
      roadmaps: roadmapsResult.data || [],
      roadmapTasks: roadmapTasksResult.data || [],
      settings: {
        min_cgpa: Number(settingsRow.min_cgpa ?? defaultSettings.min_cgpa),
        min_ats_score: Number(settingsRow.min_ats_score ?? defaultSettings.min_ats_score),
        required_skills: normalizeSkills(settingsRow.required_skills || defaultSettings.required_skills),
      },
      loading: false,
      error: warnings.length ? `Some tables could not be loaded: ${warnings.slice(0, 2).join(' | ')}` : '',
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isSupabaseReady || !supabase) return undefined;

    const channel = supabase
      .channel('admin-dashboard-resumes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'resumes' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_descriptions' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  return {
    ...state,
    refetch: loadData,
  };
}

export default function StudentsSection({ students, settings, loading, error, onRefresh }) {
  const [search, setSearch] = useState('');
  const [skillFilter, setSkillFilter] = useState('all');
  const [eligibilityFilter, setEligibilityFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState(0);

  const skillOptions = useMemo(() => {
    const values = new Set();
    (students || []).forEach((student) => {
      (student.skills || []).forEach((skill) => values.add(skill));
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b)).slice(0, 20);
  }, [students]);

  const filteredStudents = useMemo(() => {
    return (students || []).filter((student) => {
      const haystack = `${student.name} ${(student.skills || []).join(' ')}`.toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesSkill = skillFilter === 'all' || (student.skills || []).some((skill) => skill.toLowerCase().includes(skillFilter.toLowerCase()));
      const matchesEligibility = eligibilityFilter === 'all' || (eligibilityFilter === 'eligible' ? student.eligible : !student.eligible);
      const matchesScore = Number(student.ats_score || 0) >= scoreFilter;
      return matchesSearch && matchesSkill && matchesEligibility && matchesScore;
    });
  }, [students, search, skillFilter, eligibilityFilter, scoreFilter]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} style={{ height: 160, borderRadius: 24, background: 'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.1), rgba(255,255,255,0.05))', backgroundSize: '250% 100%', animation: 'shimmer 1.6s infinite', border: '1px solid rgba(255,255,255,0.08)' }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, borderRadius: 22, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.24)', color: '#fecaca', fontWeight: 600 }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em' }}>Students</div>
          <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.58)', fontSize: 13 }}>{filteredStudents.length} records from Supabase</div>
        </div>
        <button onClick={onRefresh} style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'white', borderRadius: 999, padding: '10px 14px', cursor: 'pointer' }}>
          Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 0.8fr', gap: 12 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students..." style={inputStyle} />
        <select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} style={selectStyle}>
          <option value="all" style={{ background: '#0f172a', color: 'white' }}>All skills</option>
          {skillOptions.map((skill) => <option key={skill} value={skill} style={{ background: '#0f172a', color: 'white' }}>{skill}</option>)}
        </select>
        <select value={eligibilityFilter} onChange={(e) => setEligibilityFilter(e.target.value)} style={selectStyle}>
          <option value="all" style={{ background: '#0f172a', color: 'white' }}>All statuses</option>
          <option value="eligible" style={{ background: '#0f172a', color: 'white' }}>Eligible</option>
          <option value="not" style={{ background: '#0f172a', color: 'white' }}>Not eligible</option>
        </select>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            <span>Min ATS Score</span>
            <span style={{ fontWeight: 700, color: '#a78bfa' }}>{scoreFilter}%</span>
          </div>
          <input type="range" min="0" max="100" value={scoreFilter} onChange={(e) => setScoreFilter(Number(e.target.value))} style={{ width: '100%', accentColor: '#7c3aed' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {filteredStudents.map((student, index) => (
          <motion.div
            key={student.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            whileHover={{ y: -6, scale: 1.01 }}
            style={{
              borderRadius: 24,
              padding: 18,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 18px 50px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em' }}>{student.name}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{student.eligible ? 'Eligible ✅' : 'Not Eligible ❌'}</div>
                  {!student.eligible && student.eligibility?.missingRules?.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.48)', lineHeight: 1.45 }}>
                      {student.eligibility.missingRules.slice(0, 3).join(' · ')}
                    </div>
                  )}
              </div>
              <div style={{ minWidth: 72, height: 72, borderRadius: '50%', background: 'conic-gradient(#22c55e 0deg, #22c55e ' + (student.ats_score * 3.6) + 'deg, rgba(255,255,255,0.08) ' + (student.ats_score * 3.6) + 'deg 360deg)', display: 'grid', placeItems: 'center' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#0f172a', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{Math.round(student.ats_score || 0)}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>ATS</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {(student.skills || []).slice(0, 8).map((skill) => (
                <span key={skill} style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', fontSize: 11, color: 'rgba(255,255,255,0.82)', border: '1px solid rgba(255,255,255,0.08)' }}>{skill}</span>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.62)', marginBottom: 6 }}>
                <span>Progress</span>
                <span>{Math.round(student.progress || 0)}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${student.progress || 0}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #8b5cf6, #38bdf8)', transition: 'width 0.6s ease' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <MiniList label="Strengths" items={student.strengths} empty="No strengths stored yet." />
              <MiniList label="Weak areas" items={student.weak_areas} empty="No weak areas stored yet." />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.05)',
  color: 'white',
  padding: '13px 14px',
  outline: 'none',
  fontSize: 14,
};

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'white\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  paddingRight: '40px',
};

function MiniList({ label, items, empty }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>{label}</div>
      {items.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {items.slice(0, 4).map((item) => (
            <span key={item} style={{ fontSize: 11, padding: '5px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.72)' }}>{item}</span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)' }}>{empty}</div>
      )}
    </div>
  );
}
