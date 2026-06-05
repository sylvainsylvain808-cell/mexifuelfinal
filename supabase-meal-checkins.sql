create table if not exists public.meal_checkins (
  date text not null,
  name text not null,
  time text not null,
  updated_at timestamptz not null default now(),
  primary key (date, name)
);

alter table public.meal_checkins enable row level security;

drop policy if exists "meal_checkins_select" on public.meal_checkins;
drop policy if exists "meal_checkins_insert" on public.meal_checkins;
drop policy if exists "meal_checkins_update" on public.meal_checkins;
drop policy if exists "meal_checkins_delete" on public.meal_checkins;

create policy "meal_checkins_select"
on public.meal_checkins
for select
to anon
using (true);

create policy "meal_checkins_insert"
on public.meal_checkins
for insert
to anon
with check (true);

create policy "meal_checkins_update"
on public.meal_checkins
for update
to anon
using (true)
with check (true);

create policy "meal_checkins_delete"
on public.meal_checkins
for delete
to anon
using (true);

