import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../src/lib/supabase';

type HistoricoMensagem = {
  role: 'user' | 'assistant';
  content: string;
};

type CorpoRequisicao = {
  pergunta?: string;
  historico?: HistoricoMensagem[];
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
  console.log('1. handler iniciado, method:', req.method);

  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'Método não permitido.' });
    return;
  }

  const corpo = (req.body ?? {}) as CorpoRequisicao;

  const pergunta = corpo.pergunta?.trim();
  if (!pergunta) {
    res.status(400).json({ erro: 'Campo "pergunta" é obrigatório.' });
    return;
  }

  const historico = Array.isArray(corpo.historico) ? corpo.historico : [];

  try {
    console.log('2. antes da consulta supabase');

    const { data: normativos, error: erroSupabase } = await supabase
      .from('normativos')
      .select('titulo, categoria, conteudo_markdown');

    console.log('3. supabase retornou', {
      erro: erroSupabase,
      quantidadeRegistros: normativos?.length,
    });

    if (erroSupabase) {
      throw erroSupabase;
    }

    const blocoDados = (normativos ?? [])
      .map(
        (normativo) =>
          `## ${normativo.titulo}\n\n${normativo.conteudo_markdown}`,
      )
      .join('\n\n---\n\n');

    const system = [
      {
        type: 'text' as const,
        text: 'Você é um assistente que responde dúvidas sobre os normativos internos de um condomínio. Baseie-se EXCLUSIVAMENTE no conteúdo fornecido no bloco de dados a seguir — nunca invente informações. Ao responder, sempre cite o título do normativo e o artigo ou seção de onde tirou a resposta. Se a pergunta não puder ser respondida com base nos documentos fornecidos, diga explicitamente que não há normativo aplicável. Responda de forma natural e conversacional, como se estivesse explicando a regra para o síndico verbalmente — não estruture a resposta como um documento jurídico: sem cabeçalhos de capítulo em ##, sem listas longas de incisos um por linha quando puderem ser resumidos em uma frase corrida. Mesmo assim, sempre que citar uma regra, mencione claramente o normativo e o número do artigo — isso continua obrigatório, só a forma de apresentar a citação deve ficar mais direta e menos formal.',
      },
      {
        type: 'text' as const,
        text: blocoDados,
        cache_control: { type: 'ephemeral' as const },
      },
    ];

    const messages = [
      ...historico.map((mensagem) => ({
        role: mensagem.role,
        content: mensagem.content,
      })),
      { role: 'user' as const, content: pergunta },
    ];

    console.log('4. antes da chamada anthropic');

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
          messages,
        }),
      },
    );

    console.log('5. anthropic retornou, status:', anthropicResponse.status);

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

    console.log('6. enviando resposta');

    res.status(200).json({ resposta });
  } catch (error) {
    console.error('normativos-chat: erro ao processar pergunta', error);
    res
      .status(500)
      .json({ erro: 'Não foi possível processar a pergunta no momento.' });
  }
}
