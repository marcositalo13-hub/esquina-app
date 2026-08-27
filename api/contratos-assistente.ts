import type { VercelRequest, VercelResponse } from '@vercel/node';

type Mensagem = {
  role: 'user' | 'assistant';
  content: string;
};

type CorpoRequisicao = {
  titulo?: string;
  conteudoMarkdown?: string;
  mensagens?: Mensagem[];
};

type AnthropicContentBlock = {
  type: string;
  text?: string;
};

type AnthropicResponse = {
  content?: AnthropicContentBlock[];
};

const ANTHROPIC_MODEL = 'claude-sonnet-5';
const ANTHROPIC_MAX_TOKENS = 1500;
const ANTHROPIC_VERSION = '2023-06-01';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'Método não permitido.' });
    return;
  }

  const corpo = (req.body ?? {}) as CorpoRequisicao;

  const titulo = corpo.titulo?.trim();
  const conteudoMarkdown = corpo.conteudoMarkdown?.trim();
  const mensagens = Array.isArray(corpo.mensagens) ? corpo.mensagens : [];

  if (!titulo || !conteudoMarkdown || mensagens.length === 0) {
    res.status(400).json({
      erro: 'Campos "titulo", "conteudoMarkdown" e "mensagens" são obrigatórios.',
    });
    return;
  }

  try {
    const system = [
      {
        type: 'text' as const,
        text: `Você está respondendo perguntas exclusivamente sobre o contrato: ${titulo}. Baseie-se EXCLUSIVAMENTE no conteúdo fornecido — nunca invente informações e não responda com base em nenhum outro contrato. Sempre cite a cláusula de onde tirou a resposta. Valores monetários, datas, prazos e números de cláusula devem ser citados de forma exata, nunca arredondados ou parafraseados. Se a pergunta não puder ser respondida com base no conteúdo fornecido, diga explicitamente que não há informação aplicável nesse contrato. Responda de forma natural e conversacional, sem estrutura de documento jurídico nem markdown com **.`,
      },
      {
        type: 'text' as const,
        text: conteudoMarkdown,
        cache_control: { type: 'ephemeral' as const },
      },
    ];

    const anthropicResponse = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: ANTHROPIC_MAX_TOKENS,
          system,
          messages: mensagens,
        }),
      },
    );

    if (!anthropicResponse.ok) {
      const corpoErro = await anthropicResponse.text();
      throw new Error(
        `Anthropic API respondeu ${anthropicResponse.status}: ${corpoErro}`,
      );
    }

    const dadosResposta = (await anthropicResponse.json()) as AnthropicResponse;
    const resposta = (dadosResposta.content ?? [])
      .filter(
        (bloco) => bloco.type === 'text' && typeof bloco.text === 'string',
      )
      .map((bloco) => bloco.text as string)
      .join('\n');

    res.status(200).json({ resposta });
  } catch (error) {
    console.error('contratos-assistente: erro ao processar pergunta', error);
    res
      .status(500)
      .json({ erro: 'Não foi possível processar a pergunta no momento.' });
  }
}
