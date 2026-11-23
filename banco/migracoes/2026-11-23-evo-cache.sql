-- ===== FitStack · Busca do EVO em partes (academias grandes) =====
-- Guarda as páginas de alunos ativos do dia enquanto a busca não termina. Só o servidor (service_role) mexe.
create table if not exists public.evo_cache(
  academia_id uuid not null references public.academias on delete cascade,
  dia date not null,
  pagina int not null,
  itens jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  primary key (academia_id, dia, pagina)
);
alter table public.evo_cache enable row level security;
revoke all on public.evo_cache from anon, authenticated, public;
grant select, insert, update, delete on public.evo_cache to service_role;
-- Limpa sobras de dias anteriores toda madrugada
select cron.unschedule(jobid) from cron.job where jobname = 'evo-cache-limpar';
select cron.schedule('evo-cache-limpar', '0 6 * * *', $job$ delete from public.evo_cache where dia < (now() at time zone 'America/Sao_Paulo')::date $job$);
select 'ok' as pronto;
