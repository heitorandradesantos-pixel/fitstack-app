-- ===== FitStack · Buscas do EVO na madrugada (tarifa noturna da API Pro: 00h–05h59) =====
select cron.unschedule(jobid) from cron.job where jobname in ('evo-sync-diario','evo-sync-diario-2','evo-fin-semanal');
-- Painel e Contatos: 04:00, 04:15, 04:30 e 04:45 (Brasília) = 07:00–07:45 UTC. Cada chamada atualiza uma unidade.
select cron.schedule('evo-sync-diario', '0,15,30,45 7 * * *', $job$
  select net.http_post(url := 'https://bmbcdqcjeignydehwmhg.supabase.co/functions/v1/evo-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-cron',(select valor from public.sistema_segredos where nome = 'cron')),
    body := '{"todas":true}'::jsonb, timeout_milliseconds := 150000);
$job$);
-- Financeiro: segunda-feira 05:00 e 05:15 (Brasília) = 08:00 e 08:15 UTC
select cron.schedule('evo-fin-semanal', '0,15 8 * * 1', $job$
  select net.http_post(url := 'https://bmbcdqcjeignydehwmhg.supabase.co/functions/v1/evo-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-cron',(select valor from public.sistema_segredos where nome = 'cron')),
    body := '{"modo":"fin"}'::jsonb, timeout_milliseconds := 150000);
$job$);
select jobname, schedule from cron.job order by jobname;
