-- ===== FitStack · Contador de consultas à API do EVO (por conta/DNS, por dia) =====
create table if not exists public.evo_consumo(
  dns text not null,
  dia date not null default (now() at time zone 'America/Sao_Paulo')::date,
  consultas int not null default 0,
  primary key (dns, dia)
);
alter table public.evo_consumo enable row level security;
revoke all on public.evo_consumo from anon, authenticated, public;
grant select, insert, update on public.evo_consumo to service_role;

create or replace function public.evo_somar(p_dns text, p_n int) returns void
language sql security definer set search_path = public as $$
  insert into evo_consumo(dns, dia, consultas) values (upper(p_dns), (now() at time zone 'America/Sao_Paulo')::date, greatest(p_n,0))
  on conflict (dns, dia) do update set consultas = evo_consumo.consultas + excluded.consultas;
$$;
revoke all on function public.evo_somar(text,int) from anon, authenticated, public;
grant execute on function public.evo_somar(text,int) to service_role;

-- Status mostra quanto a conta do EVO já gastou hoje e no mês
create or replace function public.evo_status(a uuid) returns json
language sql stable security definer set search_path = public as $$
  select case when public.meu_papel(a) = 'admin' then
    (select json_build_object('dns', dns, 'final', right(token, 4), 'atualizado_em', atualizado_em,
                              'ultima_sync', ultima_sync, 'ultimo_erro', ultimo_erro, 'webhook_key', webhook_key,
                              'ultimo_alerta', (select max(recebido_em) from evo_eventos e where e.academia_id = a),
                              'consultas_hoje', (select coalesce(sum(consultas),0) from evo_consumo c where c.dns = upper(i.dns) and c.dia = (now() at time zone 'America/Sao_Paulo')::date),
                              'consultas_mes', (select coalesce(sum(consultas),0) from evo_consumo c where c.dns = upper(i.dns) and c.dia >= date_trunc('month', now() at time zone 'America/Sao_Paulo')::date))
     from integracoes_evo i where academia_id = a) end
$$;

-- Financeiro passa a buscar 1x por semana (segunda-feira de manhã), para economizar consultas
select cron.unschedule(jobid) from cron.job where jobname in ('evo-fin-diario','evo-fin-diario-2');
select cron.schedule('evo-fin-semanal', '40,55 9 * * 1', $job$
  select net.http_post(url := 'https://bmbcdqcjeignydehwmhg.supabase.co/functions/v1/evo-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-cron',(select valor from public.sistema_segredos where nome = 'cron')),
    body := '{"modo":"fin"}'::jsonb, timeout_milliseconds := 150000);
$job$);
select jobname, schedule from cron.job order by jobname;
