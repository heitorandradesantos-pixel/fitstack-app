-- Meta de ponto de equilíbrio (quantos alunos de plano direto a academia precisa para se pagar)
alter table public.metas add column if not exists equilibrio integer;
