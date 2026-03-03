-- =========================================
-- RLS HARDENING: tasks + player_state
-- Each user can only access their own rows
-- =========================================

-- 0) (Opcional pero recomendado) Asegura que las tablas existen
--    select * from public.tasks limit 1;
--    select * from public.player_state limit 1;

-- 1) Activar Row Level Security
alter table public.tasks enable row level security;
alter table public.player_state enable row level security;

-- (Opcional) Forzar RLS incluso para el "table owner"
-- Útil para evitar bypass desde servicios mal configurados.
-- OJO: si tienes jobs/cron/admin scripts, revisa que usen service_role.
alter table public.tasks force row level security;
alter table public.player_state force row level security;

-- 2) Limpieza de policies antiguas (evita duplicados)
drop policy if exists "tasks_select_own"    on public.tasks;
drop policy if exists "tasks_insert_own"    on public.tasks;
drop policy if exists "tasks_update_own"    on public.tasks;
drop policy if exists "tasks_delete_own"    on public.tasks;

drop policy if exists "player_state_select_own" on public.player_state;
drop policy if exists "player_state_insert_own" on public.player_state;
drop policy if exists "player_state_update_own" on public.player_state;
drop policy if exists "player_state_delete_own" on public.player_state;

-- 3) POLICIES: tasks
create policy "tasks_select_own"
  on public.tasks
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "tasks_insert_own"
  on public.tasks
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "tasks_update_own"
  on public.tasks
  for update
  to authenticated
  using   (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "tasks_delete_own"
  on public.tasks
  for delete
  to authenticated
  using (user_id = auth.uid());

-- 4) POLICIES: player_state
create policy "player_state_select_own"
  on public.player_state
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "player_state_insert_own"
  on public.player_state
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "player_state_update_own"
  on public.player_state
  for update
  to authenticated
  using   (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "player_state_delete_own"
  on public.player_state
  for delete
  to authenticated
  using (user_id = auth.uid());

-- 5) (Recomendado) Índices para rendimiento por user_id
create index if not exists tasks_user_id_idx        on public.tasks(user_id);
create index if not exists player_state_user_id_idx on public.player_state(user_id);

-- 6) (Opcional) Sanity check rápido
--    En SQL editor como admin verás todo igualmente; valida desde el cliente.
--    select * from public.tasks;          -- debe devolver solo las filas del usuario autenticado
--    select * from public.player_state;   -- ídem
