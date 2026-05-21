import { useEffect, useMemo, useRef, useState } from 'react';

const Button = ({ children, active = false, onClick, disabled = false, style = {}, isDarkMode = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: '10px 18px',
      borderRadius: 999,
      border: active 
        ? (isDarkMode ? '1px solid #5b7fc4' : '1px solid #111827')
        : (isDarkMode ? '1px solid rgba(70,100,150,0.3)' : '1px solid #d1d5db'),
      background: active 
        ? (isDarkMode ? '#5b7fc4' : '#111827')
        : (isDarkMode ? 'transparent' : '#ffffff'),
      color: active 
        ? '#ffffff' 
        : (isDarkMode ? '#b4c3d9' : '#374151'),
      fontWeight: 600,
      fontSize: 13,
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.2s ease',
      opacity: disabled ? 0.6 : 1,
      fontFamily: 'inherit',
      ...style,
    }}
  >
    {children}
  </button>
);

const Card = ({ children, style = {}, isDarkMode = false }) => (
  <div
    style={{
      background: isDarkMode ? '#253447' : '#ffffff',
      border: isDarkMode ? '1px solid rgba(70,100,150,0.25)' : '1px solid #ececec',
      borderRadius: 20,
      boxShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.15)' : '0 10px 30px rgba(0,0,0,0.06)',
      ...style,
    }}
  >
    {children}
  </div>
);

const Icon = ({ check = false }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {check ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="10" />}
  </svg>
);

const CelebrationPopup = ({ visible, onClose }) => {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.68)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'roadmapFadeIn 0.25s ease',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 'min(92vw, 560px)',
          padding: '56px 34px 32px',
          borderRadius: 28,
          background: '#fff',
          boxShadow: '0 30px 80px rgba(0,0,0,0.3)',
          textAlign: 'center',
          transformOrigin: 'center',
          animation: 'roadmapPop 0.45s cubic-bezier(0.2, 1, 0.22, 1)',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          {Array.from({ length: 18 }).map((_, index) => (
            <span
              key={index}
              style={{
                position: 'absolute',
                top: -18,
                left: `${(index * 17) % 100}%`,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'][index % 4],
                animation: `roadmapConfetti ${2.6 + (index % 4) * 0.2}s linear forwards`,
                animationDelay: `${index * 0.05}s`,
              }}
            />
          ))}
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 76, lineHeight: 1, marginBottom: 14 }}>🎉</div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.04em', color: '#111827' }}>
            Congratulations!
          </div>
          <div style={{ marginTop: 10, fontSize: 16, color: '#4b5563', lineHeight: 1.6 }}>
            You completed your roadmap. The learning path is done.
          </div>
          <div style={{ marginTop: 10, fontSize: 14, color: '#6b7280' }}>
            Resume and JD-based plan fully completed.
          </div>
          <div style={{ marginTop: 26 }}>
            <Button active onClick={onClose} style={{ padding: '12px 26px' }}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Roadmap({ resumeId, jobDescription, onProgressChange, isDarkMode }) {
  const [durationWeeks, setDurationWeeks] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generationSource, setGenerationSource] = useState('');
  const [generationWarning, setGenerationWarning] = useState('');
  const [taskProgress, setTaskProgress] = useState({});
  const [showCongrats, setShowCongrats] = useState(false);
  const onProgressChangeRef = useRef(onProgressChange);

  useEffect(() => {
    onProgressChangeRef.current = onProgressChange;
  }, [onProgressChange]);

  const fetchRoadmap = async (weeks) => {
    if (!resumeId) {
      setError('Upload your resume first.');
      return;
    }
    if (!jobDescription) {
      setError('Analyze a JD first.');
      return;
    }

    setLoading(true);
    setError('');
    setGenerationSource('');
    setGenerationWarning('');
    setShowCongrats(false);

    try {
      const formData = new FormData();
      formData.append('resume_id', resumeId);
      formData.append('job_description', jobDescription);
      formData.append('daily_hours', '2');

      const response = await fetch('/api/roadmap', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to generate roadmap');
      }

      const data = await response.json();

      const tasksByWeek = new Map();
      if (Array.isArray(data.tasks)) {
        data.tasks.forEach((task) => {
          const week = Number(task.week);
          if (week >= 1 && week <= weeks) {
            if (!tasksByWeek.has(week)) {
              tasksByWeek.set(week, []);
            }
            const cleaned = {
              ...task,
              week,
              task: String(task.task || '').trim(),
              skill: String(task.skill || 'Focus skill').trim(),
              difficulty: String(task.difficulty || 'Medium').trim(),
              estimated_hours: Number(task.estimated_hours || 12),
              resources: Array.isArray(task.resources) ? task.resources : [],
            };
            const existingTexts = new Set(tasksByWeek.get(week).map((item) => item.task.toLowerCase()));
            if (cleaned.task && !existingTexts.has(cleaned.task.toLowerCase())) {
              tasksByWeek.get(week).push(cleaned);
            }
          }
        });
      }

      const normalizedTasks = [];
      for (let week = 1; week <= weeks; week += 1) {
        const weekTasks = tasksByWeek.get(week) || [];

        if (weekTasks.length === 0) {
          normalizedTasks.push({
            week,
            task: `Week ${week}: Analyze JD requirements against your resume and implement one focused task to close the highest-priority gap for your target role.`,
            skill: week <= 4 ? 'Foundation' : week <= 8 ? 'Build' : 'Industry',
            difficulty: week <= 3 ? 'Easy' : week <= 8 ? 'Medium' : 'Hard',
            estimated_hours: week <= 4 ? 12 : week <= 8 ? 14 : 16,
            resources: ['JD requirements', 'Resume gap analysis', 'Weekly implementation checklist'],
            priority: 'HIGH',
            milestone: week === 4 || week === 8 || week === weeks,
          });
        } else {
          weekTasks.forEach((task) => normalizedTasks.push(task));
        }
      }

      const milestones = Array.isArray(data.milestones) && data.milestones.length > 0
        ? data.milestones
        : normalizedTasks.filter((task) => task.milestone).map((task) => `Week ${task.week}: ${task.skill} milestone`);

      const source = String(data.generation_source || '').trim();
      const warning = String(data.generation_warning || '').trim();
      setGenerationSource(source);
      setGenerationWarning(warning);

      setRoadmap({
        ...data,
        duration_weeks: weeks,
        tasks: normalizedTasks,
        milestones,
      });
      setTaskProgress({});
      onProgressChangeRef.current?.({
        generated: true,
        durationWeeks: weeks,
        completedTasks: 0,
        totalTasks: normalizedTasks.length,
        overallProgress: 0,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(error);
      setError('Could not generate roadmap. Ensure API is configured and try again.');
      setRoadmap(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!roadmap?.tasks?.length) return;
    const allDone = roadmap.tasks.every((task, index) => taskProgress[`${task.week}-${index}`]);
    if (allDone) {
      const timer = setTimeout(() => setShowCongrats(true), 350);
      return () => clearTimeout(timer);
    }
    setShowCongrats(false);
    return undefined;
  }, [roadmap, taskProgress]);

  const groupedWeeks = useMemo(() => {
    if (!roadmap?.tasks?.length) return [];

    const groups = roadmap.tasks.reduce((acc, task, index) => {
      const week = Number(task.week);
      if (!acc[week]) acc[week] = [];
      acc[week].push({ ...task, _index: index });
      return acc;
    }, {});

    return Object.keys(groups)
      .map(Number)
      .sort((a, b) => a - b)
      .map((week) => {
        const tasks = groups[week];
        const completed = tasks.filter((task) => taskProgress[`${task.week}-${task._index}`]).length;
        return {
          week,
          tasks,
          completed,
          total: tasks.length,
          topics: [...new Set(tasks.map((task) => task.skill).filter(Boolean))],
        };
      });
  }, [roadmap, taskProgress]);

  const completedTasks = groupedWeeks.reduce((sum, week) => sum + week.completed, 0);
  const totalTasks = groupedWeeks.reduce((sum, week) => sum + week.total, 0);
  const overallProgress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  useEffect(() => {
    if (!roadmap) {
      onProgressChangeRef.current?.({
        generated: false,
        durationWeeks,
        completedTasks: 0,
        totalTasks: 0,
        overallProgress: 0,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    onProgressChangeRef.current?.({
      generated: true,
      durationWeeks,
      completedTasks,
      totalTasks,
      overallProgress,
      updatedAt: new Date().toISOString(),
    });
  }, [roadmap, durationWeeks, completedTasks, totalTasks, overallProgress]);

  const toggleTask = (task) => {
    const key = `${task.week}-${task._index}`;
    setTaskProgress((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const timelineWidth = `${overallProgress}%`;
  const isModelSource = generationSource === 'model' || generationSource === 'cache';
  const normalizedRoadmapWarning = String(generationWarning || '').trim();
  const showRoadmapWarning = isModelSource && normalizedRoadmapWarning && !/^AI API request failed:?$/i.test(normalizedRoadmapWarning);

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 22, animation: 'roadmapFadeIn 0.3s ease' }}>
      <CelebrationPopup visible={showCongrats} onClose={() => setShowCongrats(false)} />

      <style>{`
        @keyframes roadmapFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes roadmapPop {
          from { opacity: 0; transform: scale(0.55); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes roadmapConfetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(560px) rotate(540deg); opacity: 0; }
        }
      `}</style>

      <div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: isDarkMode ? '#e8eef7' : '#111827', letterSpacing: '-0.04em' }}>Learning Roadmap</h2>
        <p style={{ marginTop: 4, color: isDarkMode ? '#b4c3d9' : '#6b7280', fontSize: 13.5 }}>
          Your personalized learning path based on your resume and JD.
        </p>
        {isModelSource ? (
          <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: isDarkMode ? '#86efac' : '#166534' }}>
            Source: Live API model
          </div>
        ) : null}
        {showRoadmapWarning ? (
          <div style={{ marginTop: 6, fontSize: 12, color: isDarkMode ? '#fcd34d' : '#b45309', maxWidth: 860 }}>
            Warning: {normalizedRoadmapWarning}
          </div>
        ) : null}
      </div>

      {error ? (
        <Card isDarkMode={isDarkMode} style={{ padding: 16, borderColor: isDarkMode ? 'rgba(239,68,68,0.4)' : '#fecaca', background: isDarkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2' }}>
          <div style={{ color: isDarkMode ? '#fca5a5' : '#991b1b', fontSize: 13, fontWeight: 600 }}>{error}</div>
        </Card>
      ) : null}

      <Card isDarkMode={isDarkMode} style={{ padding: 22 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#e8eef7' : '#111827', marginBottom: 8 }}>Choose duration</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[4, 8, 12].map((weeks) => (
                <Button
                  key={weeks}
                  active={durationWeeks === weeks}
                  onClick={() => {
                    setDurationWeeks(weeks);
                    fetchRoadmap(weeks);
                  }}
                  isDarkMode={isDarkMode}
                >
                  {weeks} weeks
                </Button>
              ))}
            </div>
          </div>

          <div style={{ minWidth: 190, textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? '#e8eef7' : '#111827' }}>Overall Progress</div>
            <div style={{ fontSize: 12, color: isDarkMode ? '#b4c3d9' : '#6b7280', marginTop: 2 }}>{completedTasks} of {totalTasks} tasks completed</div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ height: 6, borderRadius: 999, background: isDarkMode ? 'rgba(91,127,196,0.2)' : '#e5e7eb', overflow: 'hidden' }}>
            <div style={{ width: timelineWidth, height: '100%', borderRadius: 999, background: isDarkMode ? 'linear-gradient(90deg, #6b93d6, #22c55e)' : 'linear-gradient(90deg, #111827, #10b981)', transition: 'width 0.35s ease' }} />
          </div>
        </div>
      </Card>

      {loading ? (
        <Card isDarkMode={isDarkMode} style={{ padding: 24, textAlign: 'center', color: isDarkMode ? '#b4c3d9' : '#6b7280' }}>
          Loading roadmap...
        </Card>
      ) : null}

      {!loading && groupedWeeks.length > 0 ? (
        <>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, paddingTop: 4 }}>
            {groupedWeeks.map((week) => {
              const done = week.completed === week.total && week.total > 0;
              const current = week.week === 1;
              return (
                <div
                  key={week.week}
                  style={{
                    flex: '0 0 260px',
                    borderRadius: 22,
                    padding: 18,
                    background: isDarkMode ? '#253447' : '#ffffff',
                    color: isDarkMode ? '#e8eef7' : '#111827',
                    border: isDarkMode
                      ? (current ? '1px solid rgba(107,147,214,0.4)' : '1px solid rgba(70,100,150,0.25)')
                      : (current ? '1px solid #d1d5db' : '1px solid #ececec'),
                    boxShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.15)' : '0 12px 30px rgba(0,0,0,0.08)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 11, letterSpacing: '0.08em', fontWeight: 800, color: isDarkMode ? (current ? '#6b93d6' : '#8a9bb5') : (current ? '#6b7280' : '#9ca3af') }}>
                      WEEK {week.week}
                    </div>
                    {done ? <span style={{ color: isDarkMode ? '#22c55e' : '#10b981' }}><Icon check /></span> : null}
                  </div>

                  <div style={{ marginTop: 12, fontSize: 15, fontWeight: 700, color: isDarkMode ? '#e8eef7' : '#111827' }}>{`Week ${week.week}`}</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: isDarkMode ? '#b4c3d9' : '#6b7280' }}>{week.completed}/{week.total} tasks</div>

                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: isDarkMode ? (current ? '1px solid rgba(107,147,214,0.2)' : '1px solid rgba(70,100,150,0.2)') : (current ? '1px solid #e5e7eb' : '1px solid #f3f4f6') }}>
                    {week.topics.slice(0, 3).map((topic) => (
                      <div key={topic} style={{ fontSize: 12, marginBottom: 6, color: isDarkMode ? '#b4c3d9' : '#6b7280' }}>
                        • {topic}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {week.tasks.slice(0, 4).map((task) => {
                      const checked = Boolean(taskProgress[`${task.week}-${task._index}`]);
                      return (
                        <button
                          key={`${task.week}-${task._index}`}
                          onClick={() => toggleTask(task)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'left',
                            color: 'inherit',
                            padding: 0,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          <span style={{ 
                            marginTop: 2, 
                            width: 18, 
                            height: 18, 
                            borderRadius: 5, 
                            border: `1.5px solid ${checked ? (isDarkMode ? '#22c55e' : '#10b981') : (isDarkMode ? 'rgba(107,147,214,0.4)' : '#d1d5db')}`, 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            background: checked ? (isDarkMode ? '#22c55e' : '#10b981') : 'transparent', 
                            flex: '0 0 auto' 
                          }}>
                            {checked ? <Icon check /> : null}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ 
                              fontSize: 12.5, 
                              lineHeight: 1.45, 
                              color: checked ? (isDarkMode ? '#8a9bb5' : '#9ca3af') : (isDarkMode ? '#e8eef7' : '#111827'), 
                              textDecoration: checked ? 'line-through' : 'none' 
                            }}>
                              {task.task}
                            </div>
                            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11, lineHeight: 1.4, color: isDarkMode ? '#8a9bb5' : '#6b7280' }}>
                              <span>{task.skill || 'Focus skill'}</span>
                              <span>•</span>
                              <span>{task.difficulty || 'Medium'}</span>
                              <span>•</span>
                              <span>{task.estimated_hours || 0} hrs</span>
                              {task.milestone ? (
                                <>
                                  <span>•</span>
                                  <span>Milestone</span>
                                </>
                              ) : null}
                            </div>
                            {Array.isArray(task.resources) && task.resources.length > 0 ? (
                              <div style={{ marginTop: 4, fontSize: 10.5, lineHeight: 1.45, color: isDarkMode ? '#8a9bb5' : '#6b7280' }}>
                                {task.resources.slice(0, 2).join(' • ')}
                              </div>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                    {week.tasks.length > 4 ? (
                      <div style={{ fontSize: 11, color: isDarkMode ? '#8a9bb5' : '#6b7280' }}>
                        +{week.tasks.length - 4} more tasks
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <Card isDarkMode={isDarkMode} style={{ padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#e8eef7' : '#111827', marginBottom: 14 }}>Track Your Progress</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
              {groupedWeeks.map((week) => {
                const percent = week.total ? Math.round((week.completed / week.total) * 100) : 0;
                const complete = percent === 100;
                return (
                  <div key={week.week} style={{ 
                    padding: 14, 
                    borderRadius: 16, 
                    border: complete 
                      ? (isDarkMode ? '1px solid rgba(34,197,94,0.4)' : '1px solid #bbf7d0')
                      : (isDarkMode ? '1px solid rgba(70,100,150,0.25)' : '1px solid #e5e7eb'), 
                    background: complete 
                      ? (isDarkMode ? 'rgba(34,197,94,0.1)' : '#f0fdf4')
                      : (isDarkMode ? '#1e2a3a' : '#fafafa') 
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: complete ? (isDarkMode ? '#86efac' : '#166534') : (isDarkMode ? '#e8eef7' : '#374151') }}>Week {week.week}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: complete ? (isDarkMode ? '#86efac' : '#166534') : (isDarkMode ? '#b4c3d9' : '#6b7280') }}>{week.completed}/{week.total}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 999, background: isDarkMode ? 'rgba(91,127,196,0.2)' : '#e5e7eb', overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', borderRadius: 999, background: complete ? (isDarkMode ? '#22c55e' : '#10b981') : (isDarkMode ? '#6b93d6' : '#111827'), transition: 'width 0.25s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      ) : null}

      {!loading && !roadmap ? (
        <Card isDarkMode={isDarkMode} style={{ padding: 22, textAlign: 'center', color: isDarkMode ? '#b4c3d9' : '#6b7280' }}>
          Select a duration to generate a roadmap focused on your resume and job description.
        </Card>
      ) : null}
    </div>
  );
}
