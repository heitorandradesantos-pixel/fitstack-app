-- FitStack · banco de dados v1 (academias, equipe com hierarquia, avaliações anônimas)
-- Rodar inteiro no Supabase > SQL Editor.

create extension if not exists pgcrypto;

-- ===== Tabelas =====
create table if not exists public.academias(
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cidade text,
  criado_por uuid references auth.users on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);

create table if not exists public.membros(
  academia_id uuid not null references public.academias on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  papel text not null check (papel in ('admin','gerente','colaborador')),
  nome text,
  email text,
  permissoes text[] not null default '{}',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  primary key (academia_id, user_id)
);

create table if not exists public.convites(
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references public.academias on delete cascade,
  email text not null,
  papel text not null check (papel in ('gerente','colaborador')),
  nome text,
  permissoes text[] not null default '{}',
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (academia_id, email)
);

create table if not exists public.modelos(
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references public.academias on delete cascade,
  nome text not null,
  funcao text,
  config jsonb not null,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);

create table if not exists public.rodadas(
  id text primary key,
  academia_id uuid not null references public.academias on delete cascade,
  titulo text not null,
  avaliado text,
  funcao text,
  publico text,
  restrita boolean not null default false,
  config jsonb not null,
  status text not null default 'aberta' check (status in ('aberta','encerrada')),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);

-- Respostas anônimas: só a data (sem hora), sem usuário, sem IP.
create table if not exists public.respostas(
  id uuid primary key default gen_random_uuid(),
  rodada_id text not null references public.rodadas on delete cascade,
  criado_em date not null default current_date,
  nps int,
  notas jsonb not null default '[]',
  abertas jsonb not null default '[]'
);
create index if not exists respostas_rodada_idx on public.respostas(rodada_id);

-- Avaliações de liderança e de clima: só o dono (admin) vê.
create or replace function public.forcar_restrita() returns trigger language plpgsql as $$
begin
  if new.funcao in ('gerente','coordenador','clima') then new.restrita := true; end if;
  return new;
end $$;
drop trigger if exists rodadas_restrita on public.rodadas;
create trigger rodadas_restrita before insert or update on public.rodadas
  for each row execute function public.forcar_restrita();

-- ===== Papel do usuário logado em uma academia =====
create or replace function public.meu_papel(a uuid) returns text
language sql stable security definer set search_path = public as $$
  select papel from membros where academia_id = a and user_id = auth.uid() and ativo
$$;

-- Admin pode tudo; os outros só o que estiver marcado nas permissões.
create or replace function public.pode(a uuid, p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where academia_id = a and user_id = auth.uid() and ativo
                 and (papel = 'admin' or p = any(permissoes)))
$$;

-- ===== Segurança (RLS) =====
alter table public.academias enable row level security;
alter table public.membros   enable row level security;
alter table public.convites  enable row level security;
alter table public.modelos   enable row level security;
alter table public.rodadas   enable row level security;
alter table public.respostas enable row level security;

drop policy if exists academias_ver on public.academias;
create policy academias_ver on public.academias for select using (public.meu_papel(id) is not null);
drop policy if exists academias_editar on public.academias;
create policy academias_editar on public.academias for update using (public.meu_papel(id) = 'admin');

drop policy if exists membros_ver on public.membros;
create policy membros_ver on public.membros for select using (public.meu_papel(academia_id) is not null);
drop policy if exists membros_remover on public.membros;
create policy membros_remover on public.membros for delete using (
  user_id <> auth.uid() and public.meu_papel(academia_id) = 'admin');
drop policy if exists membros_mudar on public.membros;
create policy membros_mudar on public.membros for update
  using (public.meu_papel(academia_id) = 'admin' and user_id <> auth.uid())
  with check (public.meu_papel(academia_id) = 'admin' and papel in ('gerente','colaborador'));
-- Gerente com permissão "equipe" pode desativar/reativar colaborador.
drop policy if exists membros_gerente on public.membros;
create policy membros_gerente on public.membros for update
  using (public.meu_papel(academia_id) = 'gerente' and public.pode(academia_id,'equipe') and papel = 'colaborador')
  with check (papel = 'colaborador' and permissoes <@ array['placar','comissao']::text[]);

drop policy if exists convites_tudo on public.convites;
create policy convites_tudo on public.convites for all
  using (public.meu_papel(academia_id) = 'admin'
         or (public.pode(academia_id,'equipe') and papel = 'colaborador'))
  with check (public.meu_papel(academia_id) = 'admin'
         or (public.pode(academia_id,'equipe') and papel = 'colaborador' and permissoes <@ array['placar','comissao']::text[]));

drop policy if exists modelos_tudo on public.modelos;
create policy modelos_tudo on public.modelos for all
  using (public.pode(academia_id,'avaliacoes'))
  with check (public.pode(academia_id,'avaliacoes'));

drop policy if exists rodadas_tudo on public.rodadas;
create policy rodadas_tudo on public.rodadas for all
  using (public.meu_papel(academia_id) = 'admin' or (public.pode(academia_id,'avaliacoes') and not restrita))
  with check (public.meu_papel(academia_id) = 'admin' or (public.pode(academia_id,'avaliacoes') and not restrita));

drop policy if exists respostas_ver on public.respostas;
create policy respostas_ver on public.respostas for select using (exists (
  select 1 from public.rodadas r where r.id = rodada_id and (
    public.meu_papel(r.academia_id) = 'admin'
    or (public.pode(r.academia_id,'avaliacoes') and not r.restrita))));
-- Ninguém insere direto em respostas: só pela função responder().

-- ===== Funções do app =====
create or replace function public.criar_academia(p_nome text, p_cidade text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  if coalesce(trim(p_nome),'') = '' then raise exception 'Informe o nome da academia'; end if;
  insert into academias(nome, cidade, criado_por) values (trim(p_nome), nullif(trim(p_cidade),''), auth.uid()) returning id into v;
  insert into membros(academia_id, user_id, papel, email, nome)
    values (v, auth.uid(), 'admin', auth.jwt()->>'email', coalesce(auth.jwt()->'user_metadata'->>'nome',''));
  return v;
end $$;

create or replace function public.aceitar_convites() returns int
language plpgsql security definer set search_path = public as $$
declare n int; e text := lower(auth.jwt()->>'email');
begin
  if auth.uid() is null or e is null then return 0; end if;
  insert into membros(academia_id, user_id, papel, email, nome, permissoes)
    select c.academia_id, auth.uid(), c.papel, e,
           coalesce(nullif(c.nome,''), auth.jwt()->'user_metadata'->>'nome'), c.permissoes
    from convites c where lower(c.email) = e
    on conflict do nothing;
  get diagnostics n = row_count;
  delete from convites where lower(email) = e;
  return n;
end $$;

-- Públicas (página de responder, sem login)
create or replace function public.ver_rodada(p_id text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', r.id, 'titulo', r.titulo, 'avaliado', r.avaliado, 'publico', r.publico, 'funcao', r.funcao,
         'config', r.config, 'status', r.status, 'academia', a.nome, 'cidade', a.cidade)
  from rodadas r join academias a on a.id = r.academia_id where r.id = p_id
$$;

create or replace function public.responder(p_id text, p_nps int, p_notas jsonb, p_abertas jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from rodadas where id = p_id and status = 'aberta') then
    raise exception 'Esta avaliação está encerrada';
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

revoke execute on function public.criar_academia(text,text) from anon, public;
revoke execute on function public.aceitar_convites() from anon, public;
grant execute on function public.criar_academia(text,text) to authenticated;
grant execute on function public.aceitar_convites() to authenticated;
grant execute on function public.ver_rodada(text) to anon, authenticated;
grant execute on function public.responder(text,int,jsonb,jsonb) to anon, authenticated;

-- Primeiro acesso: o app checa se o e-mail foi cadastrado pelo admin antes de deixar criar a senha.
create or replace function public.email_convidado(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from convites where lower(email) = lower(trim(p_email)))
$$;
grant execute on function public.email_convidado(text) to anon, authenticated;

-- ===== Acesso pela API (a RLS acima decide o que cada um vê) =====
grant usage on schema public to anon, authenticated;
grant select, update on public.academias to authenticated;
grant select, update, delete on public.membros to authenticated;
grant select, insert, update, delete on public.convites, public.modelos, public.rodadas to authenticated;
grant select on public.respostas to authenticated;
grant execute on function public.meu_papel(uuid), public.pode(uuid,text) to authenticated;
-- FitStack · Placar de Turnos
create table if not exists public.placar_docs(
  academia_id uuid not null references public.academias on delete cascade,
  colecao text not null,
  doc_id text not null,
  data date,
  dados jsonb not null default '{}',
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  primary key (academia_id, colecao, doc_id)
);
create index if not exists placar_docs_data_idx on public.placar_docs(academia_id, colecao, data);
alter table public.placar_docs enable row level security;

-- Quem pode ver cada parte
create or replace function public.placar_ler(a uuid, c text) returns boolean
language sql stable security definer set search_path = public as $$
  select case c
    when 'registros' then public.pode(a,'placar') or public.pode(a,'placar_gestao') or public.pode(a,'comissao')
    when 'conf'      then public.pode(a,'placar_gestao')
    when 'config'    then public.meu_papel(a) is not null
    else public.meu_papel(a) = 'admin' end
$$;
-- Quem pode gravar (no registro já existente: recepção não mexe em turno fechado ou conferido)
create or replace function public.placar_gravar(a uuid, c text, atual jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select case c
    when 'registros' then public.pode(a,'placar_gestao')
      or (public.pode(a,'placar') and coalesce((atual->>'enviado')::boolean,false) = false
                                  and coalesce((atual->>'conferido')::boolean,false) = false)
    when 'conf'      then public.pode(a,'placar_gestao')
    else public.meu_papel(a) = 'admin' end
$$;

drop policy if exists placar_ver on public.placar_docs;
create policy placar_ver on public.placar_docs for select using (public.placar_ler(academia_id, colecao));
drop policy if exists placar_criar on public.placar_docs;
create policy placar_criar on public.placar_docs for insert with check (public.placar_gravar(academia_id, colecao, null));
drop policy if exists placar_mudar on public.placar_docs;
create policy placar_mudar on public.placar_docs for update
  using (public.placar_gravar(academia_id, colecao, dados))
  with check (public.placar_gravar(academia_id, colecao, null));
drop policy if exists placar_apagar on public.placar_docs;
create policy placar_apagar on public.placar_docs for delete using (public.meu_papel(academia_id) = 'admin');

grant select, insert, update, delete on public.placar_docs to authenticated;
grant execute on function public.placar_ler(uuid,text), public.placar_gravar(uuid,text,jsonb) to authenticated;
-- FitStack · Placar: gerente edita metas + histórico de alterações (gravado pelo próprio banco)
create or replace function public.placar_pode(a uuid, c text, d text, atual jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select case c
    when 'registros' then public.pode(a,'placar_gestao')
      or (public.pode(a,'placar') and coalesce((atual->>'enviado')::boolean,false) = false
                                  and coalesce((atual->>'conferido')::boolean,false) = false)
    when 'conf'   then public.pode(a,'placar_gestao')
    when 'config' then public.meu_papel(a) = 'admin' or (d = 'metas' and public.pode(a,'placar_gestao'))
    else public.meu_papel(a) = 'admin' end
$$;
grant execute on function public.placar_pode(uuid,text,text,jsonb) to authenticated;

drop policy if exists placar_criar on public.placar_docs;
create policy placar_criar on public.placar_docs for insert with check (public.placar_pode(academia_id, colecao, doc_id, null));
drop policy if exists placar_mudar on public.placar_docs;
create policy placar_mudar on public.placar_docs for update
  using (public.placar_pode(academia_id, colecao, doc_id, dados))
  with check (public.placar_pode(academia_id, colecao, doc_id, null));

create table if not exists public.placar_historico(
  id bigint generated always as identity primary key,
  academia_id uuid not null references public.academias on delete cascade,
  quando timestamptz not null default now(),
  autor uuid,
  autor_nome text,
  autor_papel text,
  doc_id text,
  antes jsonb,
  depois jsonb
);
create index if not exists placar_historico_idx on public.placar_historico(academia_id, quando desc);
alter table public.placar_historico enable row level security;
drop policy if exists historico_ver on public.placar_historico;
create policy historico_ver on public.placar_historico for select using (public.meu_papel(academia_id) = 'admin');
grant select on public.placar_historico to authenticated;
-- Ninguém grava no histórico pela API: só o gatilho abaixo. Ninguém apaga nem edita.

create or replace function public.placar_log_config() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.colecao = 'config' and (tg_op = 'INSERT' or old.dados - 'atualizadoEm' is distinct from new.dados - 'atualizadoEm') then
    insert into placar_historico(academia_id, autor, autor_nome, autor_papel, doc_id, antes, depois)
    select new.academia_id, auth.uid(), m.nome, m.papel, new.doc_id,
           case when tg_op = 'UPDATE' then old.dados end, new.dados
    from (select 1) x
    left join membros m on m.academia_id = new.academia_id and m.user_id = auth.uid();
  end if;
  return new;
end $$;
drop trigger if exists placar_log on public.placar_docs;
create trigger placar_log after insert or update on public.placar_docs
  for each row execute function public.placar_log_config();
-- FitStack · cargo Sócio (vê e faz tudo como o dono; só o dono cria/remove sócio; ninguém mexe no dono)
alter table public.membros  drop constraint if exists membros_papel_check;
alter table public.membros  add constraint membros_papel_check  check (papel in ('admin','socio','gerente','colaborador'));
alter table public.convites drop constraint if exists convites_papel_check;
alter table public.convites add constraint convites_papel_check check (papel in ('socio','gerente','colaborador'));

-- Papel efetivo: sócio tem os mesmos poderes do dono
create or replace function public.meu_papel(a uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when papel = 'socio' then 'admin' else papel end
  from membros where academia_id = a and user_id = auth.uid() and ativo
$$;
-- Papel de verdade (para separar dono de sócio)
create or replace function public.papel_real(a uuid) returns text
language sql stable security definer set search_path = public as $$
  select papel from membros where academia_id = a and user_id = auth.uid() and ativo
$$;
grant execute on function public.papel_real(uuid) to authenticated;
create or replace function public.pode(a uuid, p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where academia_id = a and user_id = auth.uid() and ativo
                 and (papel in ('admin','socio') or p = any(permissoes)))
$$;

drop policy if exists membros_remover on public.membros;
create policy membros_remover on public.membros for delete using (
  user_id <> auth.uid() and public.meu_papel(academia_id) = 'admin' and papel <> 'admin'
  and (papel <> 'socio' or public.papel_real(academia_id) = 'admin'));
drop policy if exists membros_mudar on public.membros;
create policy membros_mudar on public.membros for update
  using (public.meu_papel(academia_id) = 'admin' and user_id <> auth.uid() and papel <> 'admin'
         and (papel <> 'socio' or public.papel_real(academia_id) = 'admin'))
  with check (public.meu_papel(academia_id) = 'admin' and papel in ('socio','gerente','colaborador')
         and (papel <> 'socio' or public.papel_real(academia_id) = 'admin'));

drop policy if exists convites_tudo on public.convites;
create policy convites_tudo on public.convites for all
  using ((public.meu_papel(academia_id) = 'admin' and (papel <> 'socio' or public.papel_real(academia_id) = 'admin'))
         or (public.pode(academia_id,'equipe') and papel = 'colaborador'))
  with check ((public.meu_papel(academia_id) = 'admin' and (papel <> 'socio' or public.papel_real(academia_id) = 'admin'))
         or (public.pode(academia_id,'equipe') and papel = 'colaborador' and permissoes <@ array['placar','comissao']::text[]));
-- FitStack · primeiro acesso com código (sem confirmação por e-mail)
create or replace function public.gerar_codigo() returns text
language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random()*31)::int, 1), '')
  from generate_series(1,6)
$$;
alter table public.convites add column if not exists codigo text not null default public.gerar_codigo();

-- Confere e-mail + código antes de criar a senha (usado na tela, sem login)
create or replace function public.convite_valido(p_email text, p_codigo text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from convites
                 where lower(email) = lower(trim(p_email)) and upper(trim(codigo)) = upper(trim(p_codigo)))
$$;
grant execute on function public.convite_valido(text,text) to anon, authenticated;
drop function if exists public.email_convidado(text);

-- Só entra na academia quem tem o código certo
drop function if exists public.aceitar_convites();
create or replace function public.aceitar_convites(p_codigo text default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int; e text := lower(auth.jwt()->>'email');
begin
  if auth.uid() is null or e is null or p_codigo is null then return 0; end if;
  insert into membros(academia_id, user_id, papel, email, nome, permissoes)
    select c.academia_id, auth.uid(), c.papel, e,
           coalesce(nullif(c.nome,''), auth.jwt()->'user_metadata'->>'nome'), c.permissoes
    from convites c where lower(c.email) = e and upper(c.codigo) = upper(trim(p_codigo))
    on conflict do nothing;
  get diagnostics n = row_count;
  delete from convites where lower(email) = e and upper(codigo) = upper(trim(p_codigo));
  return n;
end $$;
revoke execute on function public.aceitar_convites(text) from anon, public;
grant execute on function public.aceitar_convites(text) to authenticated;

-- ===== Integração EVO (W12): chave guardada só no servidor =====
create table if not exists public.integracoes_evo(
  academia_id uuid primary key references public.academias on delete cascade,
  dns text not null,
  token text not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  ultima_sync timestamptz,
  ultimo_erro text
);
alter table public.integracoes_evo enable row level security;
-- Nenhuma policy e nenhum grant: ninguém lê a tabela pela API. Só as funções abaixo e o servidor.
revoke all on public.integracoes_evo from anon, authenticated, public;

create or replace function public.evo_salvar(a uuid, p_dns text, p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.meu_papel(a) is distinct from 'admin' then raise exception 'FS: Só o dono ou um sócio pode configurar a integração.'; end if;
  if coalesce(trim(p_dns),'') = '' or coalesce(trim(p_token),'') = '' then raise exception 'FS: Preencha o DNS e o token.'; end if;
  insert into integracoes_evo(academia_id, dns, token, atualizado_por) values (a, trim(p_dns), trim(p_token), auth.uid())
  on conflict (academia_id) do update set dns = excluded.dns, token = excluded.token,
    atualizado_em = now(), atualizado_por = auth.uid(), ultimo_erro = null;
  return true;
end $$;

create or replace function public.evo_status(a uuid) returns json
language sql stable security definer set search_path = public as $$
  select case when public.meu_papel(a) = 'admin' then
    (select json_build_object('dns', dns, 'final', right(token, 4), 'atualizado_em', atualizado_em,
                              'ultima_sync', ultima_sync, 'ultimo_erro', ultimo_erro)
     from integracoes_evo where academia_id = a) end
$$;

create or replace function public.evo_remover(a uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.meu_papel(a) is distinct from 'admin' then raise exception 'FS: Só o dono ou um sócio pode desligar a integração.'; end if;
  delete from integracoes_evo where academia_id = a;
  return true;
end $$;

revoke execute on function public.evo_salvar(uuid,text,text), public.evo_status(uuid), public.evo_remover(uuid) from anon, public;
grant execute on function public.evo_salvar(uuid,text,text), public.evo_status(uuid), public.evo_remover(uuid) to authenticated;
-- ===== EVO: dados prontos, contatos do dia e agendamento =====
alter table public.integracoes_evo add column if not exists ultimas_consultas int;

create table if not exists public.evo_dados(
  academia_id uuid not null references public.academias on delete cascade,
  chave text not null,
  dados jsonb not null default '{}',
  atualizado_em timestamptz not null default now(),
  primary key (academia_id, chave)
);
alter table public.evo_dados enable row level security;
revoke all on public.evo_dados from anon, authenticated, public;
grant select on public.evo_dados to authenticated;
drop policy if exists evo_dados_ver on public.evo_dados;
create policy evo_dados_ver on public.evo_dados for select using (
  case when chave = 'resumo' then public.meu_papel(academia_id) = 'admin'
       else public.pode(academia_id,'placar') or public.pode(academia_id,'placar_gestao') end);

create table if not exists public.evo_contatos(
  id bigint generated always as identity primary key,
  academia_id uuid not null references public.academias on delete cascade,
  dia date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  lista text not null,
  id_aluno text not null,
  nome text,
  por uuid default auth.uid(),
  por_nome text,
  quando timestamptz not null default now(),
  unique (academia_id, dia, lista, id_aluno)
);
create index if not exists evo_contatos_idx on public.evo_contatos(academia_id, dia desc);
alter table public.evo_contatos enable row level security;
revoke all on public.evo_contatos from anon, authenticated, public;
grant select, insert, delete on public.evo_contatos to authenticated;
drop policy if exists evo_contatos_ver on public.evo_contatos;
create policy evo_contatos_ver on public.evo_contatos for select using (public.pode(academia_id,'placar') or public.pode(academia_id,'placar_gestao'));
drop policy if exists evo_contatos_criar on public.evo_contatos;
create policy evo_contatos_criar on public.evo_contatos for insert with check (
  (public.pode(academia_id,'placar') or public.pode(academia_id,'placar_gestao')) and por = auth.uid()
  and dia = ((now() at time zone 'America/Sao_Paulo')::date));
drop policy if exists evo_contatos_desfazer on public.evo_contatos;
create policy evo_contatos_desfazer on public.evo_contatos for delete using (
  (por = auth.uid() and dia = ((now() at time zone 'America/Sao_Paulo')::date)) or public.meu_papel(academia_id) = 'admin');

create or replace function public.evo_contato_nome() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select coalesce(nullif(nome,''), email) into new.por_nome from membros where academia_id = new.academia_id and user_id = auth.uid();
  new.por := auth.uid(); new.quando := now();
  return new;
end $$;
drop trigger if exists evo_contato_nome on public.evo_contatos;
create trigger evo_contato_nome before insert on public.evo_contatos for each row execute function public.evo_contato_nome();

-- Segredo do agendamento (só o servidor lê)
create table if not exists public.sistema_segredos(nome text primary key, valor text not null);
alter table public.sistema_segredos enable row level security;
revoke all on public.sistema_segredos from anon, authenticated, public;
insert into public.sistema_segredos(nome, valor) values ('cron', encode(gen_random_bytes(24),'hex')) on conflict (nome) do nothing;

-- Agendamento: todo dia às 05:40 (Brasília) = 08:40 UTC
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.unschedule(jobid) from cron.job where jobname = 'evo-sync-diario';
select cron.schedule('evo-sync-diario', '40 8 * * *', $job$
  select net.http_post(
    url := 'https://bmbcdqcjeignydehwmhg.supabase.co/functions/v1/evo-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-cron',(select valor from public.sistema_segredos where nome = 'cron')),
    body := '{"todas":true}'::jsonb,
    timeout_milliseconds := 150000);
$job$);
-- O servidor (service_role) precisa de acesso explícito nestas tabelas
grant select, insert, update, delete on public.integracoes_evo, public.evo_dados, public.evo_contatos, public.sistema_segredos to service_role;
-- ===== FitStack · Admin Master (dono da plataforma) =====
create table if not exists public.plataforma_admins(
  user_id uuid primary key references auth.users on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.plataforma_admins enable row level security;
revoke all on public.plataforma_admins from anon, authenticated, public;
grant select, insert, update, delete on public.plataforma_admins to service_role;

create or replace function public.sou_master() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from plataforma_admins where user_id = auth.uid())
$$;
revoke execute on function public.sou_master() from anon, public;
grant execute on function public.sou_master() to authenticated;

-- O Heitor (quem criou a Panobianco) é o master
insert into public.plataforma_admins(user_id)
  select criado_por from public.academias where criado_por is not null order by criado_em limit 1
  on conflict do nothing;

-- Academia pode ser suspensa
alter table public.academias add column if not exists ativa boolean not null default true;
alter table public.academias add column if not exists obs text;

-- Papéis só valem em academia ativa
create or replace function public.meu_papel(a uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when m.papel = 'socio' then 'admin' else m.papel end
  from membros m join academias ac on ac.id = m.academia_id
  where m.academia_id = a and m.user_id = auth.uid() and m.ativo and ac.ativa
$$;
create or replace function public.papel_real(a uuid) returns text
language sql stable security definer set search_path = public as $$
  select m.papel from membros m join academias ac on ac.id = m.academia_id
  where m.academia_id = a and m.user_id = auth.uid() and m.ativo and ac.ativa
$$;
create or replace function public.pode(a uuid, p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros m join academias ac on ac.id = m.academia_id
                 where m.academia_id = a and m.user_id = auth.uid() and m.ativo and ac.ativa
                 and (m.papel in ('admin','socio') or p = any(m.permissoes)))
$$;
create or replace function public.sou_membro(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where academia_id = a and user_id = auth.uid())
$$;
grant execute on function public.sou_membro(uuid) to authenticated;

-- Cada um sempre enxerga o próprio vínculo e o nome da academia (para mostrar "acesso suspenso")
drop policy if exists membros_ver on public.membros;
create policy membros_ver on public.membros for select using (user_id = auth.uid() or public.meu_papel(academia_id) is not null);
drop policy if exists academias_ver on public.academias;
create policy academias_ver on public.academias for select using (public.meu_papel(id) is not null or public.sou_membro(id));

-- Convite de dono (papel admin) só pelo master
alter table public.convites drop constraint if exists convites_papel_check;
alter table public.convites add constraint convites_papel_check check (papel in ('admin','socio','gerente','colaborador'));
drop policy if exists convites_tudo on public.convites;
create policy convites_tudo on public.convites for all
  using ((public.meu_papel(academia_id) = 'admin' and papel <> 'admin' and (papel <> 'socio' or public.papel_real(academia_id) = 'admin'))
         or (public.pode(academia_id,'equipe') and papel = 'colaborador'))
  with check ((public.meu_papel(academia_id) = 'admin' and papel <> 'admin' and (papel <> 'socio' or public.papel_real(academia_id) = 'admin'))
         or (public.pode(academia_id,'equipe') and papel = 'colaborador' and permissoes <@ array['placar','comissao']::text[]));

-- Criar academia: só o master ou quem já é dono (para abrir mais uma unidade)
create or replace function public.criar_academia(p_nome text, p_cidade text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if auth.uid() is null then raise exception 'FS: Faça login primeiro.'; end if;
  if not (public.sou_master() or exists (select 1 from membros m join academias ac on ac.id = m.academia_id
          where m.user_id = auth.uid() and m.papel = 'admin' and m.ativo and ac.ativa)) then
    raise exception 'FS: Para cadastrar uma academia nova, fale com a FitStack.';
  end if;
  if coalesce(trim(p_nome),'') = '' then raise exception 'FS: Informe o nome da academia.'; end if;
  insert into academias(nome, cidade, criado_por) values (trim(p_nome), nullif(trim(p_cidade),''), auth.uid()) returning id into v;
  insert into membros(academia_id, user_id, papel, email, nome)
    values (v, auth.uid(), 'admin', auth.jwt()->>'email', coalesce(auth.jwt()->'user_metadata'->>'nome',''));
  return v;
end $$;

-- ===== Funções do master =====
create or replace function public.master_academias() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.sou_master() then raise exception 'FS: Área só do administrador da FitStack.'; end if;
  return coalesce((select json_agg(x order by x.criado_em desc) from (
    select a.id, a.nome, a.cidade, a.ativa, a.obs, a.criado_em,
      (select json_agg(json_build_object('nome', m.nome, 'email', m.email)) from membros m where m.academia_id = a.id and m.papel = 'admin') as donos,
      (select count(*) from membros m where m.academia_id = a.id and m.ativo) as pessoas,
      (select json_agg(json_build_object('id', c.id, 'nome', c.nome, 'email', c.email, 'codigo', c.codigo)) from convites c where c.academia_id = a.id and c.papel = 'admin') as convite_dono,
      (select count(*) from convites c where c.academia_id = a.id) as convites,
      exists (select 1 from integracoes_evo e where e.academia_id = a.id) as evo,
      (select e.ultima_sync from integracoes_evo e where e.academia_id = a.id) as ultima_sync,
      (select max(atualizado_em) from placar_docs p where p.academia_id = a.id) as ultimo_placar
    from academias a) x), '[]'::json);
end $$;

create or replace function public.master_criar(p_nome text, p_cidade text, p_dono_nome text, p_dono_email text) returns json
language plpgsql security definer set search_path = public as $$
declare v uuid; cod text;
begin
  if not public.sou_master() then raise exception 'FS: Área só do administrador da FitStack.'; end if;
  if coalesce(trim(p_nome),'') = '' then raise exception 'FS: Informe o nome da academia.'; end if;
  if coalesce(trim(p_dono_email),'') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'FS: Confira o e-mail do dono.'; end if;
  insert into academias(nome, cidade, criado_por) values (trim(p_nome), nullif(trim(p_cidade),''), auth.uid()) returning id into v;
  insert into convites(academia_id, email, papel, nome, permissoes)
    values (v, lower(trim(p_dono_email)), 'admin', nullif(trim(p_dono_nome),''), '{}') returning codigo into cod;
  return json_build_object('academia_id', v, 'codigo', cod);
end $$;

create or replace function public.master_ativar(a uuid, p_ativa boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_master() then raise exception 'FS: Área só do administrador da FitStack.'; end if;
  update academias set ativa = p_ativa where id = a;
  return true;
end $$;

create or replace function public.master_trocar_dono(a uuid, p_dono_nome text, p_dono_email text) returns json
language plpgsql security definer set search_path = public as $$
declare cod text;
begin
  if not public.sou_master() then raise exception 'FS: Área só do administrador da FitStack.'; end if;
  delete from convites where academia_id = a and papel = 'admin';
  insert into convites(academia_id, email, papel, nome, permissoes)
    values (a, lower(trim(p_dono_email)), 'admin', nullif(trim(p_dono_nome),''), '{}')
    on conflict (academia_id, email) do update set papel = 'admin', nome = excluded.nome, permissoes = '{}'
    returning codigo into cod;
  return json_build_object('codigo', cod);
end $$;

revoke execute on function public.master_academias(), public.master_criar(text,text,text,text), public.master_ativar(uuid,boolean), public.master_trocar_dono(uuid,text,text) from anon, public;
grant execute on function public.master_academias(), public.master_criar(text,text,text,text), public.master_ativar(uuid,boolean), public.master_trocar_dono(uuid,text,text) to authenticated;

select (select count(*) from public.plataforma_admins) as masters, (select count(*) from public.academias) as academias;
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
-- ===== FitStack · Financeiro: contas a pagar (com verificador de boleto/Pix) e DRE =====
-- Só dono e sócios (meu_papel = 'admin') veem e mexem.

-- Contas lançadas no FitStack (conferidas pelo verificador ou lançadas à mão)
create table if not exists public.fin_contas(
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references public.academias on delete cascade,
  descricao text,
  fornecedor text,
  cnpj text,
  categoria text not null default 'outros',
  valor numeric(12,2) not null check (valor >= 0),
  vencimento date,
  pago_em date,
  forma text not null default 'outro' check (forma in ('boleto','pix','outro')),
  banco_codigo text,
  pix_chave text,
  codigo_hash text,
  codigo_fim text,
  risco text check (risco in ('verde','amarelo','vermelho')),
  motivos jsonb,
  confirmou_fornecedor boolean not null default false,
  obs text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists fin_contas_venc_idx on public.fin_contas(academia_id, vencimento);
create index if not exists fin_contas_pago_idx on public.fin_contas(academia_id, pago_em);
create index if not exists fin_contas_hash_idx on public.fin_contas(academia_id, codigo_hash);

-- Entradas que não passam pelo EVO (Wellhub, Totalpass, aluguel de espaço, etc.)
create table if not exists public.fin_receitas(
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references public.academias on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  descricao text not null,
  categoria text not null default 'outras',
  valor numeric(12,2) not null check (valor >= 0),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists fin_receitas_idx on public.fin_receitas(academia_id, mes);

-- Para qual linha da DRE vai cada centro de custo do EVO (o dono pode trocar)
create table if not exists public.fin_mapa(
  academia_id uuid not null references public.academias on delete cascade,
  centro text not null,
  categoria text not null,
  atualizado_em timestamptz not null default now(),
  primary key (academia_id, centro)
);

do $$ declare t text; begin
  foreach t in array array['fin_contas','fin_receitas','fin_mapa'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, public', t);
    execute format('revoke truncate, trigger, references on public.%I from authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('drop policy if exists %I on public.%I', t || '_dono', t);
    execute format('create policy %I on public.%I for all using (public.meu_papel(academia_id) = ''admin'') with check (public.meu_papel(academia_id) = ''admin'')', t || '_dono', t);
  end loop;
end $$;

-- Dados financeiros puxados do EVO ficam em evo_dados (chave 'financeiro'): só dono e sócios leem
drop policy if exists evo_dados_ver on public.evo_dados;
create policy evo_dados_ver on public.evo_dados for select using (
  case when chave in ('resumo','financeiro') then public.meu_papel(academia_id) = 'admin'
       else public.pode(academia_id,'placar') or public.pode(academia_id,'placar_gestao') end);

-- Agendamento do financeiro: todo dia às 06:10 (Brasília) = 09:10 UTC, separado da busca principal
select cron.unschedule(jobid) from cron.job where jobname = 'evo-fin-diario';
select cron.schedule('evo-fin-diario', '10 9 * * *', $job$
  select net.http_post(
    url := 'https://bmbcdqcjeignydehwmhg.supabase.co/functions/v1/evo-sync',
    headers := jsonb_build_object('Content-Type','application/json','x-cron',(select valor from public.sistema_segredos where nome = 'cron')),
    body := '{"modo":"fin"}'::jsonb,
    timeout_milliseconds := 150000);
$job$);

select 'ok' as pronto;
-- ===== FitStack · Centros de custo próprios no Financeiro =====
alter table public.fin_contas add column if not exists centro text;
alter table public.fin_mapa add column if not exists proprio boolean not null default false;
select 'ok' as pronto;
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
