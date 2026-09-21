-- Schema para multi-tenant (condominios/usuarios) e vínculo das tabelas do
-- módulo Preservação a um condomínio. Rode este script no SQL Editor do
-- projeto Supabase (não foi executado automaticamente: o ambiente de
-- desenvolvimento só tem a anon key, sem privilégio de DDL).

create extension if not exists pgcrypto;

-- 1. Tabela condominios.
create table if not exists condominios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

-- 2. Condomínio piloto (Esquina das Silvas) — guardado por nome para não
-- duplicar se o script rodar de novo.
insert into condominios (nome)
select 'Complexo Residencial Esquina das Silvas'
where not exists (select 1 from condominios);

-- 3. Tabela usuarios — id compartilhado com auth.users (Supabase Auth).
create table if not exists usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  condominio_id uuid not null references condominios (id),
  papel text not null check (
    papel in ('administrador', 'zeladoria', 'morador', 'prestador')
  ),
  nome text not null,
  cpf text not null unique,
  funcao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- 4. Vincula tipos_atividade/planos_manutencao/rotas/ordens_servico a um
-- condomínio — nullable por enquanto (preenchido no passo 5, travado como
-- not null no passo 6).
alter table tipos_atividade
  add column if not exists condominio_id uuid references condominios (id);

alter table planos_manutencao
  add column if not exists condominio_id uuid references condominios (id);

alter table rotas
  add column if not exists condominio_id uuid references condominios (id);

alter table ordens_servico
  add column if not exists condominio_id uuid references condominios (id);

-- 5. Preenche condominio_id nas linhas existentes com o condomínio piloto.
update tipos_atividade
set condominio_id = (
  select id from condominios
  where nome = 'Complexo Residencial Esquina das Silvas'
)
where condominio_id is null;

update planos_manutencao
set condominio_id = (
  select id from condominios
  where nome = 'Complexo Residencial Esquina das Silvas'
)
where condominio_id is null;

update rotas
set condominio_id = (
  select id from condominios
  where nome = 'Complexo Residencial Esquina das Silvas'
)
where condominio_id is null;

update ordens_servico
set condominio_id = (
  select id from condominios
  where nome = 'Complexo Residencial Esquina das Silvas'
)
where condominio_id is null;

-- 6. Trava condominio_id como obrigatório agora que todas as linhas têm
-- valor.
alter table tipos_atividade alter column condominio_id set not null;
alter table planos_manutencao alter column condominio_id set not null;
alter table rotas alter column condominio_id set not null;
alter table ordens_servico alter column condominio_id set not null;

-- 7. Funcionário (usuarios) responsável pela rota — nullable, não travado
-- como not null.
alter table rotas
  add column if not exists funcionario_id uuid references usuarios (id);

-- 8. Funcionário (usuarios) responsável pela ordem de serviço — nullable.
alter table ordens_servico
  add column if not exists funcionario_id uuid references usuarios (id);
