export type Normativo = {
  id: string;
  titulo: string;
  categoria: string | null;
  // Texto livre em markdown — nunca processado/renderizado como markdown
  // nesta etapa, só editado e exibido como texto puro.
  conteudo_markdown: string;
  criado_em: string;
  atualizado_em: string;
};
