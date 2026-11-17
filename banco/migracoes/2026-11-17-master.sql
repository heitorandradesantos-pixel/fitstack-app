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
