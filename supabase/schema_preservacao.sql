-- Schema para o módulo Preservação e Manutenção (Administrador + execução interna).
-- Rode este script no SQL Editor do projeto Supabase (não foi executado
-- automaticamente: o ambiente de desenvolvimento só tem a anon key, sem
-- privilégio de DDL).

create extension if not exists pgcrypto;

-- Catálogo controlado de tipos de atividade (Limpeza, Hidráulica, etc.).
create table if not exists tipos_atividade (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem integer not null default 0,
  ativo boolean not null default true
);

insert into tipos_atividade (nome, ordem, ativo)
select v.nome, v.ordem, true
from (
  values
    ('Limpeza', 1),
    ('Manutenção Preventiva', 2),
    ('Hidráulica', 3),
    ('Elétrica', 4)
) as v(nome, ordem)
where not exists (select 1 from tipos_atividade);

-- Planos de manutenção cadastrados pelo Administrador.
create table if not exists planos_manutencao (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo_id uuid not null references tipos_atividade (id),
  descricao text,
  local text,
  periodicidade text not null check (
    periodicidade in (
      'Única', 'Diária', 'Semanal', 'Mensal',
      'Trimestral', 'Semestral', 'Anual'
    )
  ),
  prioridade text not null check (prioridade in ('Baixa', 'Média', 'Alta')),
  data_inicio date not null,
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now()
);

-- Ordens de serviço geradas a partir de um plano; tipo/título vêm sempre
-- via join com planos_manutencao -> tipos_atividade, nunca duplicados aqui.
-- on delete cascade: excluir um plano remove suas ordens automaticamente
-- (usado pela ação "Excluir" do card de plano em app/admin/preservacao.tsx).
create table if not exists ordens_servico (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references planos_manutencao (id) on delete cascade,
  data_prevista date not null,
  status text not null default 'pendente' check (status in ('pendente', 'concluida')),
  concluida_em timestamptz,
  concluida_por text,
  observacao text,
  created_at timestamptz not null default now()
);

-- Se ordens_servico já existia sem "on delete cascade" (script anterior),
-- rode isto para corrigir a constraint em vez de recriar a tabela:
-- alter table ordens_servico drop constraint ordens_servico_plano_id_fkey;
-- alter table ordens_servico
--   add constraint ordens_servico_plano_id_fkey
--   foreign key (plano_id) references planos_manutencao (id) on delete cascade;

-- RLS permissiva para a fase de testes (mesma postura já usada em
-- cadastros_teste): sem autenticação própria ainda, então libera a anon key.
alter table tipos_atividade enable row level security;
alter table planos_manutencao enable row level security;
alter table ordens_servico enable row level security;

create policy "tipos_atividade anon all" on tipos_atividade
  for all to anon using (true) with check (true);

create policy "planos_manutencao anon all" on planos_manutencao
  for all to anon using (true) with check (true);

create policy "ordens_servico anon all" on ordens_servico
  for all to anon using (true) with check (true);
