-- ===== FitStack · Painel admin: assinaturas e cobrança das academias clientes =====

-- Configurações da plataforma (chave Pix, dias para sugerir suspensão)
create table if not exists public.plataforma_config(
  id int primary key default 1 check (id = 1),
  pix_chave text,
  pix_nome text,
  dias_suspender int not null default 10,
  atualizado_em timestamptz not null default now()
);
insert into public.plataforma_config(id) values (1) on conflict do nothing;

-- Plano de cada academia
create table if not exists public.assinaturas(
  academia_id uuid primary key references public.academias on delete cascade,
  plano text not null default 'Mensal',
  valor numeric(10,2) not null default 0,
  dia_venc int not null default 10 check (dia_venc between 1 and 28),
  inicio date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  teste_ate date,
  status text not null default 'ativa' check (status in ('teste','ativa','cancelada')),
  cobranca_nome text,
  cobranca_whats text,
  obs text,
  atualizado_em timestamptz not null default now()
);

-- Cobranças (uma por mês por academia)
create table if not exists public.cobrancas(
  id bigint generated always as identity primary key,
  academia_id uuid not null references public.academias on delete cascade,
  competencia date not null,
  vencimento date not null,
  valor numeric(10,2) not null,
  status text not null default 'aberta' check (status in ('aberta','paga','cancelada')),
  pago_em date,
  forma text,
  obs text,
  criado_em timestamptz not null default now(),
  unique (academia_id, competencia)
);
create index if not exists cobrancas_venc_idx on public.cobrancas(status, vencimento);

-- Código para criar o login master (uso único)
create table if not exists public.plataforma_convites(
  codigo text primary key,
  criado_em timestamptz not null default now(),
  usado_em timestamptz
);

do $$ declare t text; begin
  foreach t in array array['plataforma_config','assinaturas','cobrancas','plataforma_convites'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated, public', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
  end loop;
end $$;

-- Código master de uso único (aparece no resultado desta consulta)
insert into public.plataforma_convites(codigo)
  select upper(substr(encode(gen_random_bytes(6),'hex'),1,8))
  where not exists (select 1 from public.plataforma_convites where usado_em is null);

-- ===== Criar o login master com o código =====
create or replace function public.master_aceitar(p_codigo text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'FS: Faça login primeiro.'; end if;
  update plataforma_convites set usado_em = now() where codigo = upper(trim(p_codigo)) and usado_em is null;
  if not found then raise exception 'FS: Código inválido ou já usado.'; end if;
  insert into plataforma_admins(user_id) values (auth.uid()) on conflict do nothing;
  return true;
end $$;
revoke execute on function public.master_aceitar(text) from anon, public;
grant execute on function public.master_aceitar(text) to authenticated;

-- ===== Gerar as cobranças do mês (todas as assinaturas ativas) =====
create or replace function public.gerar_cobrancas(p_mes date) returns int
language plpgsql security definer set search_path = public as $$
declare n int; comp date := date_trunc('month', p_mes)::date;
begin
  insert into cobrancas(academia_id, competencia, vencimento, valor)
    select s.academia_id, comp, comp + (s.dia_venc - 1), s.valor
    from assinaturas s join academias a on a.id = s.academia_id
    where s.status = 'ativa' and s.valor > 0
      and (s.teste_ate is null or s.teste_ate < comp + (s.dia_venc - 1))
      and date_trunc('month', s.inicio) <= comp
  on conflict (academia_id, competencia) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.gerar_cobrancas(date) from anon, authenticated, public;

-- Todo dia 1º às 06:10 (Brasília) gera as cobranças do mês
select cron.unschedule(jobid) from cron.job where jobname = 'fitstack-cobrancas';
select cron.schedule('fitstack-cobrancas', '10 9 1 * *', $job$ select public.gerar_cobrancas((now() at time zone 'America/Sao_Paulo')::date); $job$);

-- ===== Leitura do painel =====
create or replace function public.master_painel() returns json
language plpgsql stable security definer set search_path = public as $$
declare hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.sou_master() then raise exception 'FS: Área só do administrador da FitStack.'; end if;
  return json_build_object(
    'hoje', hoje,
    'config', (select row_to_json(c) from plataforma_config c where id = 1),
    'academias', coalesce((select json_agg(x order by x.nome) from (
      select a.id, a.nome, a.cidade, a.ativa, a.criado_em,
        (select json_agg(json_build_object('nome', m.nome, 'email', m.email)) from membros m where m.academia_id = a.id and m.papel = 'admin') as donos,
        (select count(*) from membros m where m.academia_id = a.id and m.ativo) as pessoas,
        (select json_agg(json_build_object('id', c.id, 'nome', c.nome, 'email', c.email, 'codigo', c.codigo)) from convites c where c.academia_id = a.id and c.papel = 'admin') as convite_dono,
        exists (select 1 from integracoes_evo e where e.academia_id = a.id) as evo,
        (select e.ultima_sync from integracoes_evo e where e.academia_id = a.id) as ultima_sync,
        (select max(atualizado_em) from placar_docs p where p.academia_id = a.id) as ultimo_placar,
        (select row_to_json(s) from assinaturas s where s.academia_id = a.id) as assinatura
      from academias a) x), '[]'::json),
    'cobrancas', coalesce((select json_agg(c order by c.vencimento desc) from cobrancas c
                  where c.competencia >= (date_trunc('month', hoje) - interval '12 months')::date), '[]'::json)
  );
end $$;

-- ===== Ações =====
create or replace function public.master_salvar_assinatura(a uuid, p jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_master() then raise exception 'FS: Área só do administrador da FitStack.'; end if;
  insert into assinaturas(academia_id, plano, valor, dia_venc, inicio, teste_ate, status, cobranca_nome, cobranca_whats, obs, atualizado_em)
  values (a, coalesce(nullif(p->>'plano',''),'Mensal'), coalesce((p->>'valor')::numeric,0), coalesce((p->>'dia_venc')::int,10),
          coalesce((p->>'inicio')::date,(now() at time zone 'America/Sao_Paulo')::date), nullif(p->>'teste_ate','')::date,
          coalesce(nullif(p->>'status',''),'ativa'), nullif(p->>'cobranca_nome',''), nullif(regexp_replace(coalesce(p->>'cobranca_whats',''),'\D','','g'),''), nullif(p->>'obs',''), now())
  on conflict (academia_id) do update set plano = excluded.plano, valor = excluded.valor, dia_venc = excluded.dia_venc, inicio = excluded.inicio,
    teste_ate = excluded.teste_ate, status = excluded.status, cobranca_nome = excluded.cobranca_nome, cobranca_whats = excluded.cobranca_whats,
    obs = excluded.obs, atualizado_em = now();
  -- já cria a cobrança do mês atual, se couber
  perform public.gerar_cobrancas((now() at time zone 'America/Sao_Paulo')::date);
  return true;
end $$;

create or replace function public.master_pagamento(p_id bigint, p_pago boolean, p_data date, p_forma text, p_obs text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_master() then raise exception 'FS: Área só do administrador da FitStack.'; end if;
  if p_pago then
    update cobrancas set status = 'paga', pago_em = coalesce(p_data,(now() at time zone 'America/Sao_Paulo')::date), forma = nullif(p_forma,''), obs = nullif(p_obs,'') where id = p_id;
  else
    update cobrancas set status = 'aberta', pago_em = null, forma = null where id = p_id;
  end if;
  return true;
end $$;

create or replace function public.master_cobranca_cancelar(p_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_master() then raise exception 'FS: Área só do administrador da FitStack.'; end if;
  update cobrancas set status = 'cancelada' where id = p_id;
  return true;
end $$;

create or replace function public.master_cobranca_avulsa(a uuid, p_venc date, p_valor numeric, p_obs text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_master() then raise exception 'FS: Área só do administrador da FitStack.'; end if;
  insert into cobrancas(academia_id, competencia, vencimento, valor, obs)
    values (a, date_trunc('month', p_venc)::date, p_venc, p_valor, nullif(p_obs,''))
  on conflict (academia_id, competencia) do update set vencimento = excluded.vencimento, valor = excluded.valor, obs = excluded.obs, status = 'aberta', pago_em = null;
  return true;
end $$;

create or replace function public.master_config(p jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_master() then raise exception 'FS: Área só do administrador da FitStack.'; end if;
  update plataforma_config set pix_chave = nullif(p->>'pix_chave',''), pix_nome = nullif(p->>'pix_nome',''),
    dias_suspender = coalesce((p->>'dias_suspender')::int, 10), atualizado_em = now() where id = 1;
  return true;
end $$;

do $$ declare f text; begin
  foreach f in array array['master_painel()','master_salvar_assinatura(uuid,jsonb)','master_pagamento(bigint,boolean,date,text,text)',
    'master_cobranca_cancelar(bigint)','master_cobranca_avulsa(uuid,date,numeric,text)','master_config(jsonb)'] loop
    execute format('revoke execute on function public.%s from anon, public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- A Panobianco é da casa: fica cadastrada sem cobrança
insert into public.assinaturas(academia_id, plano, valor, status, obs)
  select id, 'Casa (sem cobrança)', 0, 'ativa', 'Academia do Heitor' from public.academias
  on conflict do nothing;


create or replace function public.master_gerar() returns int
language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_master() then raise exception 'FS: Área só do administrador da FitStack.'; end if;
  return public.gerar_cobrancas((now() at time zone 'America/Sao_Paulo')::date);
end $$;
revoke execute on function public.master_gerar() from anon, public;
grant execute on function public.master_gerar() to authenticated;

select codigo as codigo_master from public.plataforma_convites where usado_em is null;
