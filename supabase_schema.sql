-- Enable UUID Generation
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE (User metadata & settings)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  avatar_url text,
  xp_points integer default 120 not null,
  streak_count integer default 4 not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Profiles
alter table public.profiles enable row level security;

-- Profiles Policies
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- 2. DAILY_TASKS TABLE (Dynamic tasks logged on daily basis)
create table public.daily_tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  task_name text not null,
  intended_hours numeric(4,2) default 0.00 not null,
  actual_hours numeric(4,2) default 0.00 not null,
  category text, -- check constraint dropped to support dynamic customization
  productivity_score integer constraint check_score check (productivity_score between 1 and 5),
  is_billable boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Daily Tasks
alter table public.daily_tasks enable row level security;

-- Daily Tasks Policies
create policy "Users can view own daily tasks" on public.daily_tasks
  for select using (auth.uid() = user_id);

create policy "Users can insert own daily tasks" on public.daily_tasks
  for insert with check (auth.uid() = user_id);

create policy "Users can update own daily tasks" on public.daily_tasks
  for update using (auth.uid() = user_id);

create policy "Users can delete own daily tasks" on public.daily_tasks
  for delete using (auth.uid() = user_id);

-- 3. WEEKLY_SUMMARIES TABLE (AI summaries and metrics snapshot)
create table public.weekly_summaries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  week_start_date date not null,
  generated_report_text text not null,
  selected_tone text not null,
  stats_snapshot jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Weekly Summaries
alter table public.weekly_summaries enable row level security;

-- Weekly Summaries Policies
create policy "Users can view own weekly summaries" on public.weekly_summaries
  for select using (auth.uid() = user_id);

create policy "Users can insert own weekly summaries" on public.weekly_summaries
  for insert with check (auth.uid() = user_id);

create policy "Users can delete own weekly summaries" on public.weekly_summaries
  for delete using (auth.uid() = user_id);

-- AUTOMATIC PROFILE TRIGGER ON SIGNUP
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, xp_points, streak_count)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    120,
    4
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. USER_CATEGORIES TABLE (Dynamic custom categories defined by users)
create table public.user_categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  color text not null, -- Hex color code like "#0d9488"
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_user_category unique(user_id, name)
);

-- Enable RLS on User Categories
alter table public.user_categories enable row level security;

-- User Categories Policies
create policy "Users can view own categories" on public.user_categories
  for select using (auth.uid() = user_id);

create policy "Users can insert own categories" on public.user_categories
  for insert with check (auth.uid() = user_id);

create policy "Users can update own categories" on public.user_categories
  for update using (auth.uid() = user_id);

create policy "Users can delete own categories" on public.user_categories
  for delete using (auth.uid() = user_id);
