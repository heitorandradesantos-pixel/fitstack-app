-- ===== FitStack · Comprovantes de pagamento (PDF) guardados junto do lançamento =====
alter table public.fin_contas add column if not exists comprovante text;
alter table public.fin_contas add column if not exists comprovante_nome text;

-- Pasta privada no armazenamento: comprovantes/<academia>/<AAAA-MM>/<arquivo>.pdf
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

create or replace function public.comprovante_dono(nome text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when split_part(nome, '/', 1) ~ '^[0-9a-f-]{36}$'
    then public.meu_papel(split_part(nome, '/', 1)::uuid) = 'admin' else false end
$$;
revoke all on function public.comprovante_dono(text) from anon, public;
grant execute on function public.comprovante_dono(text) to authenticated;

drop policy if exists comprovantes_ver on storage.objects;
drop policy if exists comprovantes_enviar on storage.objects;
drop policy if exists comprovantes_apagar on storage.objects;
create policy comprovantes_ver on storage.objects for select to authenticated using (bucket_id = 'comprovantes' and public.comprovante_dono(name));
create policy comprovantes_enviar on storage.objects for insert to authenticated with check (bucket_id = 'comprovantes' and public.comprovante_dono(name));
create policy comprovantes_apagar on storage.objects for delete to authenticated using (bucket_id = 'comprovantes' and public.comprovante_dono(name));

select 'ok' as pronto;
