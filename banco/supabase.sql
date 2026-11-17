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
