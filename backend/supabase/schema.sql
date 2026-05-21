create extension if not exists "pgcrypto";

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  filename text not null,
  file_type text,
  raw_text text not null default '',
  parsed_data jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  title text,
  company text,
  location text,
  raw_text text not null default '',
  parsed_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.jd_matches (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  job_description_id uuid not null references public.job_descriptions(id) on delete cascade,
  match_percentage numeric(5,2) not null default 0,
  hire_probability text,
  matched_skills jsonb not null default '[]'::jsonb,
  missing_skills jsonb not null default '[]'::jsonb,
  focus_areas jsonb not null default '[]'::jsonb,
  interview_topics jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.progress_metrics (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  completed_tasks int not null default 0,
  total_tasks int not null default 0,
  progress numeric(5,2) not null default 0,
  weak_areas jsonb not null default '[]'::jsonb,
  eligibility_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (resume_id)
);

create table if not exists public.admin_settings (
  id int primary key default 1,
  min_cgpa numeric(4,2) not null default 7.00,
  min_ats_score numeric(5,2) not null default 65.00,
  required_skills jsonb not null default '["Python", "React", "SQL"]'::jsonb,
  company_name text,
  updated_at timestamptz not null default now()
);

insert into public.admin_settings (id, min_cgpa, min_ats_score, required_skills, company_name)
values (1, 7.00, 65.00, '["Python", "React", "SQL"]'::jsonb, 'SkillBridge')
on conflict (id) do nothing;

create table if not exists public.roadmaps (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  job_description_id uuid not null references public.job_descriptions(id) on delete cascade,
  duration_weeks int not null default 12,
  daily_hours int not null default 2,
  milestones jsonb not null default '[]'::jsonb,
  completion_criteria text,
  created_at timestamptz not null default now()
);

create table if not exists public.roadmap_tasks (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid not null references public.roadmaps(id) on delete cascade,
  week int not null,
  task text not null,
  skill text not null,
  difficulty text not null,
  estimated_hours int not null default 0,
  resources jsonb not null default '[]'::jsonb,
  priority text,
  milestone boolean not null default false,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.interview_sessions (
  id uuid primary key,
  resume_id uuid null references public.resumes(id) on delete set null,
  job_description_id uuid null references public.job_descriptions(id) on delete set null,
  mode text not null default 'Technical',
  score int not null default 0,
  readiness text,
  quiz_context jsonb not null default '{}'::jsonb,
  roadmap_context jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  interview_session_id uuid not null references public.interview_sessions(id) on delete cascade,
  question_order int not null,
  type text not null,
  difficulty text not null,
  question text not null,
  expected_keywords jsonb not null default '[]'::jsonb,
  evaluation_criteria jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_resumes_user_id on public.resumes(user_id);
create index if not exists idx_jd_matches_resume_id on public.jd_matches(resume_id);
create index if not exists idx_jd_matches_jd_id on public.jd_matches(job_description_id);
create index if not exists idx_roadmaps_resume_id on public.roadmaps(resume_id);
create index if not exists idx_roadmap_tasks_roadmap_id on public.roadmap_tasks(roadmap_id);
create index if not exists idx_interview_sessions_resume_id on public.interview_sessions(resume_id);
create index if not exists idx_interview_questions_session_id on public.interview_questions(interview_session_id);

create table if not exists public.runtime_api_keys (
  scope_key text primary key,
  encrypted_api_key text not null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_runtime_api_key_encrypted(
  p_scope_key text,
  p_plain_api_key text,
  p_secret text
) returns void
language plpgsql
security definer
as $$
begin
  insert into public.runtime_api_keys (scope_key, encrypted_api_key, updated_at)
  values (
    p_scope_key,
    encode(pgp_sym_encrypt(p_plain_api_key, p_secret), 'base64'),
    now()
  )
  on conflict (scope_key)
  do update set
    encrypted_api_key = excluded.encrypted_api_key,
    updated_at = now();
end;
$$;

create or replace function public.get_runtime_api_key_decrypted(
  p_scope_key text,
  p_secret text
) returns table (api_key text, updated_at timestamptz)
language sql
security definer
as $$
  select
    pgp_sym_decrypt(decode(r.encrypted_api_key, 'base64')::bytea, p_secret) as api_key,
    r.updated_at
  from public.runtime_api_keys r
  where r.scope_key = p_scope_key
  limit 1;
$$;
