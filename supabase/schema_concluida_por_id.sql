-- Adiciona `concluida_por_id` a ordens_servico: retrato congelado (FK pra
-- usuarios) de quem concluiu a ordem, ao lado do texto livre `concluida_por`
-- já existente (nunca removido/alterado). Rode este script no SQL Editor do
-- projeto Supabase (não foi executado automaticamente: o ambiente de
-- desenvolvimento só tem a anon key, sem privilégio de DDL — mesmo padrão
-- de todos os outros scripts deste diretório).

alter table ordens_servico
  add column if not exists concluida_por_id uuid references usuarios (id);
