-- ===== FitStack · Agenda das buscas do EVO para várias academias =====
-- Painel e Contatos: a cada 2 minutos, das 05:15 às 06:59 (Brasília) = 08:15–09:59 UTC.
-- Cada chamada atualiza UMA unidade (a que está há mais tempo sem atualizar) e só começa se nenhuma outra estiver em andamento.
-- Isso dá 53 vagas por manhã; academia nova entra sozinha na fila.
-- Financeiro: segunda-feira, a cada 2 minutos das 04:00 às 04:58 (Brasília) = 07:00–07:58 UTC, antes da busca principal.
select cron.unschedule(jobid) from cron.job where jobname in ('evo-sync-diario','evo-sync-diario-2','evo-sync-diario-b','evo-fin-semanal');
select cron.schedule('evo-sync-diario', '15-59/2 8 * * *', $job$
  select net.http_post(url := 'https://bmbcdqcjeignydehwmhg.supabase.co/functions/v1/evo-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-cron',(select valor from public.sistema_segredos where nome = 'cron')),
    body := '{"todas":true}'::jsonb, timeout_milliseconds := 150000);
$job$);
select cron.schedule('evo-sync-diario-b', '1-59/2 9 * * *', $job$
  select net.http_post(url := 'https://bmbcdqcjeignydehwmhg.supabase.co/functions/v1/evo-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-cron',(select valor from public.sistema_segredos where nome = 'cron')),
    body := '{"todas":true}'::jsonb, timeout_milliseconds := 150000);
$job$);
select cron.schedule('evo-fin-semanal', '0-58/2 7 * * 1', $job$
  select net.http_post(url := 'https://bmbcdqcjeignydehwmhg.supabase.co/functions/v1/evo-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-cron',(select valor from public.sistema_segredos where nome = 'cron')),
    body := '{"modo":"fin"}'::jsonb, timeout_milliseconds := 150000);
$job$);
select string_agg(jobname||' '||schedule, ' | ' order by jobname) as agenda from cron.job where jobname like 'evo%';
