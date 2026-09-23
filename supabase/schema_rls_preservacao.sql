-- RLS real para o módulo Preservação (tipos_atividade, planos_manutencao,
-- rotas, ordens_servico) — essas 4 tabelas hoje têm RLS desabilitada (fase
-- de testes). Rode este script no SQL Editor do projeto Supabase (não foi
-- executado automaticamente: o ambiente de desenvolvimento só tem a anon
-- key, sem privilégio de DDL).

-- 1. Funções auxiliares — leem o papel e o condominio_id do usuário
-- autenticado a partir de auth.uid(), pra não repetir esse subselect em
-- toda política abaixo.
create or replace function auth_papel() returns text
language sql stable security definer set search_path = public
as $$ select papel from usuarios where id = auth.uid() $$;

create or replace function auth_condominio_id() returns uuid
language sql stable security definer set search_path = public
as $$ select condominio_id from usuarios where id = auth.uid() $$;

-- 2. Habilita RLS nas 4 tabelas.
alter table tipos_atividade enable row level security;
alter table planos_manutencao enable row level security;
alter table rotas enable row level security;
alter table ordens_servico enable row level security;

-- 3. tipos_atividade, planos_manutencao, rotas — mesmo padrão nas três:
-- administrador e zeladoria leem; só administrador escreve.

create policy "admin e zeladoria leem tipos_atividade" on tipos_atividade
  for select
  to authenticated
  using (
    auth_papel() in ('administrador', 'zeladoria')
    and condominio_id = auth_condominio_id()
  );

create policy "admin insere tipos_atividade" on tipos_atividade
  for insert
  to authenticated
  with check (
    auth_papel() = 'administrador'
    and condominio_id = auth_condominio_id()
  );

create policy "admin atualiza tipos_atividade" on tipos_atividade
  for update
  to authenticated
  using (
    auth_papel() = 'administrador'
    and condominio_id = auth_condominio_id()
  )
  with check (
    auth_papel() = 'administrador'
    and condominio_id = auth_condominio_id()
  );

create policy "admin exclui tipos_atividade" on tipos_atividade
  for delete
  to authenticated
  using (
    auth_papel() = 'administrador'
    and condominio_id = auth_condominio_id()
  );

create policy "admin e zeladoria leem planos_manutencao" on planos_manutencao
  for select
  to authenticated
  using (
    auth_papel() in ('administrador', 'zeladoria')
    and condominio_id = auth_condominio_id()
  );

create policy "admin insere planos_manutencao" on planos_manutencao
  for insert
  to authenticated
  with check (
    auth_papel() = 'administrador'
    and condominio_id = auth_condominio_id()
  );

create policy "admin atualiza planos_manutencao" on planos_manutencao
  for update
  to authenticated
  using (
    auth_papel() = 'administrador'
    and condominio_id = auth_condominio_id()
  )
  with check (
    auth_papel() = 'administrador'
    and condominio_id = auth_condominio_id()
  );

create policy "admin exclui planos_manutencao" on planos_manutencao
  for delete
  to authenticated
  using (
    auth_papel() = 'administrador'
    and condominio_id = auth_condominio_id()
  );

create policy "admin e zeladoria leem rotas" on rotas
  for select
  to authenticated
  using (
    auth_papel() in ('administrador', 'zeladoria')
    and condominio_id = auth_condominio_id()
  );

create policy "admin insere rotas" on rotas
  for insert
  to authenticated
  with check (
    auth_papel() = 'administrador'
    and condominio_id = auth_condominio_id()
  );

create policy "admin atualiza rotas" on rotas
  for update
  to authenticated
  using (
    auth_papel() = 'administrador'
    and condominio_id = auth_condominio_id()
  )
  with check (
    auth_papel() = 'administrador'
    and condominio_id = auth_condominio_id()
  );

create policy "admin exclui rotas" on rotas
  for delete
  to authenticated
  using (
    auth_papel() = 'administrador'
    and condominio_id = auth_condominio_id()
  );

-- 4. ordens_servico — administrador e zeladoria leem e atualizam (a
-- zeladoria executa: inicia, pausa, conclui); só administrador cria e
-- exclui.

create policy "admin e zeladoria leem ordens_servico" on ordens_servico
  for select
  to authenticated
  using (
    auth_papel() in ('administrador', 'zeladoria')
    and condominio_id = auth_condominio_id()
  );

create policy "admin insere ordens_servico" on ordens_servico
  for insert
  to authenticated
  with check (
    auth_papel() = 'administrador'
    and condominio_id = auth_condominio_id()
  );

create policy "admin e zeladoria atualizam ordens_servico" on ordens_servico
  for update
  to authenticated
  using (
    auth_papel() in ('administrador', 'zeladoria')
    and condominio_id = auth_condominio_id()
  )
  with check (
    auth_papel() in ('administrador', 'zeladoria')
    and condominio_id = auth_condominio_id()
  );

create policy "admin exclui ordens_servico" on ordens_servico
  for delete
  to authenticated
  using (
    auth_papel() = 'administrador'
    and condominio_id = auth_condominio_id()
  );
