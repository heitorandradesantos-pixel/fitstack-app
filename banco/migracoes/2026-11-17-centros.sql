-- ===== FitStack · Centros de custo próprios no Financeiro =====
alter table public.fin_contas add column if not exists centro text;
alter table public.fin_mapa add column if not exists proprio boolean not null default false;
select 'ok' as pronto;
