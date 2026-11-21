-- ===== FitStack · Metas do mês (matrículas e receita), por unidade. Só dono e sócios. =====
create table if not exists public.metas(
  academia_id uuid primary key references public.academias on delete cascade,
  matriculas int check (matriculas is null or matriculas >= 0),
  receita numeric(12,2) check (receita is null or receita >= 0),
  atualizado_em timestamptz not null default now()
);
alter table public.metas enable row level security;
revoke all on public.metas from anon, public;
revoke truncate, trigger, references on public.metas from authenticated;
grant select, insert, update, delete on public.metas to authenticated;
grant select, insert, update, delete on public.metas to service_role;
drop policy if exists metas_dono on public.metas;
create policy metas_dono on public.metas for all using (public.meu_papel(academia_id) = 'admin') with check (public.meu_papel(academia_id) = 'admin');

select 'ok' as pronto;
