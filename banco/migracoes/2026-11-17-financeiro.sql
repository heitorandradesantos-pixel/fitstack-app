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
