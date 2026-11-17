-- ===== FitStack · Risco de cancelamento, resultado dos contatos e alertas em tempo real =====

-- Contatos: foto do momento (valor, dias, vencimento) e o resultado medido depois
alter table public.evo_contatos add column if not exists info jsonb;
alter table public.evo_contatos add column if not exists resultado text;
alter table public.evo_contatos add column if not exists resultado_em date;
alter table public.evo_contatos add column if not exists resultado_valor numeric(10,2);
create index if not exists evo_contatos_aluno_idx on public.evo_contatos(academia_id, id_aluno);
grant select, insert, update, delete on public.evo_contatos to service_role;

-- Chave secreta do endereço de alertas (webhook) de cada academia
alter table public.integracoes_evo add column if not exists webhook_key text;
update public.integracoes_evo set webhook_key = encode(gen_random_bytes(16),'hex') where webhook_key is null;
alter table public.integracoes_evo alter column webhook_key set default encode(gen_random_bytes(16),'hex');

-- Alertas que chegam do EVO na hora
create table if not exists public.evo_eventos(
  id bigint generated always as identity primary key,
  academia_id uuid not null references public.academias on delete cascade,
  tipo text not null,
  id_aluno text,
  nome text,
  tel text,
  valor numeric(10,2),
  dados jsonb,
  recebido_em timestamptz not null default now()
);
create index if not exists evo_eventos_idx on public.evo_eventos(academia_id, recebido_em desc);
alter table public.evo_eventos enable row level security;
revoke all on public.evo_eventos from anon, authenticated, public;
grant select on public.evo_eventos to authenticated;
grant select, insert, update, delete on public.evo_eventos to service_role;
drop policy if exists evo_eventos_ver on public.evo_eventos;
create policy evo_eventos_ver on public.evo_eventos for select using (public.pode(academia_id,'placar') or public.pode(academia_id,'placar_gestao'));

-- Status da integração agora mostra o endereço de alertas (só dono/sócio)
create or replace function public.evo_status(a uuid) returns json
language sql stable security definer set search_path = public as $$
  select case when public.meu_papel(a) = 'admin' then
    (select json_build_object('dns', dns, 'final', right(token, 4), 'atualizado_em', atualizado_em,
                              'ultima_sync', ultima_sync, 'ultimo_erro', ultimo_erro, 'webhook_key', webhook_key,
                              'ultimo_alerta', (select max(recebido_em) from evo_eventos e where e.academia_id = a))
     from integracoes_evo where academia_id = a) end
$$;

select 'ok' as pronto;
