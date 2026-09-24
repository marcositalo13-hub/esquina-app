-- Isolamento multi-condomínio: cpf deixa de ser único globalmente (só por
-- condomínio) e o condomínio piloto vira um sandbox de testes separado do
-- condomínio "limpo" que vai receber dados reais. Rode este script no SQL
-- Editor do projeto Supabase (não foi executado automaticamente: o ambiente
-- de desenvolvimento só tem a anon key, sem privilégio de DDL).

-- 1. Troca a unicidade global de cpf por unicidade por condomínio.
-- Nome da constraint confirmado a partir de supabase/schema_multitenant.sql
-- linha 29 (`cpf text not null unique`, sem nome explícito) — Postgres nomeia
-- constraints unique de coluna única como `<tabela>_<coluna>_key` por
-- padrão, mesma convenção já usada nos outros scripts deste diretório (ver
-- `ordens_servico_plano_id_fkey`/`ordens_servico_status_check` em
-- schema_preservacao.sql, ambas também não nomeadas explicitamente na
-- criação). Não foi possível confirmar contra o banco ao vivo neste
-- ambiente — sem SUPABASE_SERVICE_ROLE_KEY nem supabase CLI configurados
-- localmente, só a anon key, que não expõe information_schema/pg_catalog
-- via REST. Confirme com a query abaixo antes de rodar, no SQL Editor:
--   select conname from pg_constraint
--   where conrelid = 'usuarios'::regclass and contype = 'u';
alter table usuarios drop constraint usuarios_cpf_key;

alter table usuarios
  add constraint usuarios_condominio_cpf_key unique (condominio_id, cpf);

-- 2. Condomínio piloto (Esquina das Silvas) vira sandbox de testes — os
-- dados de teste acumulados ficam lá, sem misturar com o condomínio "limpo"
-- criado a seguir.
update condominios
set nome = 'Sandbox de Testes — Aegis'
where nome = 'Complexo Residencial Esquina das Silvas';

insert into condominios (nome)
select 'Complexo Residencial Esquina das Silvas'
where not exists (
  select 1 from condominios
  where nome = 'Complexo Residencial Esquina das Silvas'
);
