-- Schema para o módulo Normativos (Administrador).
-- Rode este script no SQL Editor do projeto Supabase (não foi executado
-- automaticamente: o ambiente de desenvolvimento só tem a anon key, sem
-- privilégio de DDL).

create extension if not exists pgcrypto;

create table if not exists normativos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  categoria text,
  -- Texto livre em markdown, sem qualquer processamento — só editado e
  -- exibido como texto puro por enquanto.
  conteudo_markdown text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- RLS permissiva para a fase de testes (mesma postura já usada nas demais
-- tabelas deste projeto): sem autenticação própria ainda, então libera a
-- anon key.
alter table normativos enable row level security;

create policy "normativos anon all" on normativos
  for all to anon using (true) with check (true);
