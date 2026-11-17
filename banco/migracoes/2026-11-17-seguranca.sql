-- ===== FitStack · Auditoria de segurança (17/11/2026) =====

-- 1) Ninguém de fora (anon) nem usuário logado pode apagar tabela inteira (TRUNCATE),
--    criar gatilhos ou referências. Só leitura/escrita normal, sempre filtrada pelas regras (RLS).
do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated, public', t);
  end loop;
end $$;
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated, public;

-- 2) Funções internas: visitante sem login não chama mais (só quem está logado)
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname in ('meu_papel','pode','papel_real','sou_membro','placar_ler','placar_gravar','placar_pode') loop
    execute format('revoke execute on function %s from anon, public', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- Funções de gatilho: ninguém chama direto
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('placar_log_config','evo_contato_nome','forcar_restrita') loop
    execute format('revoke execute on function %s from anon, authenticated, public', f);
  end loop;
  -- gerar_codigo é usado ao criar convite (logado); visitante não precisa
  revoke execute on function public.gerar_codigo() from anon, public;
  grant execute on function public.gerar_codigo() to authenticated;
end $$;

-- 3) search_path fixo nas duas funções que faltavam
alter function public.forcar_restrita() set search_path = public;
alter function public.gerar_codigo() set search_path = public;

-- 4) Pesquisa pública: limite contra enxurrada de respostas falsas (máx. 2000 por dia por avaliação)
create or replace function public.responder(p_id text, p_nps int, p_notas jsonb, p_abertas jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from rodadas where id = p_id and status = 'aberta') then
    raise exception 'Esta avaliação está encerrada';
  end if;
  if (select count(*) from respostas where rodada_id = p_id and criado_em = current_date) >= 2000 then
    raise exception 'Muitas respostas agora. Tente de novo mais tarde.';
  end if;
  if jsonb_typeof(p_notas) <> 'array' or jsonb_array_length(p_notas) > 200
     or jsonb_typeof(p_abertas) <> 'array' or jsonb_array_length(p_abertas) > 30
     or length(p_abertas::text) > 40000 then
    raise exception 'Resposta inválida';
  end if;
  if exists (select 1 from jsonb_array_elements(p_notas) x where (x->>'n')::int not between 1 and 5) then
    raise exception 'Nota inválida';
  end if;
  if p_nps is not null and (p_nps < 0 or p_nps > 10) then raise exception 'Nota inválida'; end if;
  insert into respostas(rodada_id, nps, notas, abertas) values (p_id, p_nps, p_notas, p_abertas);
  return true;
end $$;

select 'ok' as pronto;
