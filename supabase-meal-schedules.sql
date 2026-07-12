create table if not exists public.meal_schedules (
  date text primary key,
  menu text not null,
  users text[] not null default '{}',
  ticket_users text[] null,
  updated_at timestamptz not null default now()
);

alter table public.meal_schedules
add column if not exists ticket_users text[] null;

alter table public.meal_schedules enable row level security;

drop policy if exists "meal_schedules_select" on public.meal_schedules;
drop policy if exists "meal_schedules_insert" on public.meal_schedules;
drop policy if exists "meal_schedules_update" on public.meal_schedules;
drop policy if exists "meal_schedules_delete" on public.meal_schedules;

create policy "meal_schedules_select"
on public.meal_schedules
for select
to anon
using (true);

create policy "meal_schedules_insert"
on public.meal_schedules
for insert
to anon
with check (true);

create policy "meal_schedules_update"
on public.meal_schedules
for update
to anon
using (true)
with check (true);

create policy "meal_schedules_delete"
on public.meal_schedules
for delete
to anon
using (true);
