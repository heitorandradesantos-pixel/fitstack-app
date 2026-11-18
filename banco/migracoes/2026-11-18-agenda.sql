-- ===== FitStack · Agenda do EVO: uma unidade por vez (o limite de consultas é por conta do EVO) =====
alter table public.integracoes_evo add column if not exists ultima_tentativa timestamptz;
alter table public.integracoes_evo add column if not exists ultima_tentativa_fin timestamptz;

select cron.unschedule(jobid) from cron.job where jobname in ('evo-sync-diario','evo-sync-diario-2','evo-fin-diario','evo-fin-diario-2');
-- Busca principal: 05:40, 05:55, 06:10 e 06:25 (Brasília). Cada chamada atualiza uma unidade.
select cron.schedule('evo-sync-diario', '40,55 8 * * *', $job$
  select net.http_post(url := 'https://bmbcdqcjeignydehwmhg.supabase.co/functions/v1/evo-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-cron',(select valor from public.sistema_segredos where nome = 'cron')),
    body := '{"todas":true}'::jsonb, timeout_milliseconds := 150000);
$job$);
select cron.schedule('evo-sync-diario-2', '10,25 9 * * *', $job$
  select net.http_post(url := 'https://bmbcdqcjeignydehwmhg.supabase.co/functions/v1/evo-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-cron',(select valor from public.sistema_segredos where nome = 'cron')),
    body := '{"todas":true}'::jsonb, timeout_milliseconds := 150000);
$job$);
-- Financeiro: 06:40, 06:55 e 07:10 (Brasília)
select cron.schedule('evo-fin-diario', '40,55 9 * * *', $job$
  select net.http_post(url := 'https://bmbcdqcjeignydehwmhg.supabase.co/functions/v1/evo-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-cron',(select valor from public.sistema_segredos where nome = 'cron')),
    body := '{"modo":"fin"}'::jsonb, timeout_milliseconds := 150000);
$job$);
select cron.schedule('evo-fin-diario-2', '10 10 * * *', $job$
  select net.http_post(url := 'https://bmbcdqcjeignydehwmhg.supabase.co/functions/v1/evo-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-cron',(select valor from public.sistema_segredos where nome = 'cron')),
    body := '{"modo":"fin"}'::jsonb, timeout_milliseconds := 150000);
$job$);
select jobname, schedule from cron.job order by jobname;
