create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(trim(text)) > 0 and char_length(text) <= 160),
  created_on date not null default current_date,
  completed_on date,
  inserted_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "users can read their tasks"
on public.tasks
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert their tasks"
on public.tasks
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update their tasks"
on public.tasks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can delete their tasks"
on public.tasks
for delete
to authenticated
using (auth.uid() = user_id);
