import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

type CorpoRequisicao = {
  nome?: string;
  cpf?: string;
  funcao?: string;
  papel?: string;
  senha?: string;
};

// Só administrador/zeladoria são criados por aqui — morador vive em
// `moradores`, prestador é módulo à parte (marketplace, ainda não
// construído). Ver CLAUDE.md: Zeladoria != Prestador.
const PAPEIS_PERMITIDOS = ['administrador', 'zeladoria'] as const;
type PapelPermitido = (typeof PAPEIS_PERMITIDOS)[number];

function ehPapelPermitido(valor: unknown): valor is PapelPermitido {
  return (
    typeof valor === 'string' &&
    (PAPEIS_PERMITIDOS as readonly string[]).includes(valor)
  );
}

function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

// Erro do GoTrue quando o e-mail sintético (derivado do CPF) já existe —
// como email = `${cpf}@login.aegis.app`, isso só acontece quando o CPF já
// foi cadastrado antes.
function ehErroEmailDuplicado(
  erro: { status?: number; code?: string } | null,
): boolean {
  if (!erro) {
    return false;
  }
  return erro.code === 'email_exists';
}

// Token de sessão de quem está chamando (enviado por app/admin/funcionarios.tsx
// via `Authorization: Bearer <access_token>`) — usado só pra descobrir o
// `condominio_id` de quem criou, nunca pra decidir se a criação é permitida
// (isso continua responsabilidade da tela/rota protegida em app/_layout.tsx).
function extrairTokenSessao(req: VercelRequest): string | null {
  const cabecalho = req.headers.authorization;
  if (!cabecalho?.startsWith('Bearer ')) {
    return null;
  }
  return cabecalho.slice('Bearer '.length).trim() || null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ erro: 'Método não permitido.' });
    return;
  }

  // process.env aqui é o ambiente do servidor (Vercel), não o do bundle do
  // cliente — precisa ser configurado separadamente lá, ver instruções de
  // deploy. Sem token só é aceito com a flag ligada; nunca o contrário.
  const modoTesteServidor = process.env.EXPO_PUBLIC_MODO_TESTE === 'true';
  const tokenSessao = extrairTokenSessao(req);
  if (!tokenSessao && !modoTesteServidor) {
    res.status(401).json({ erro: 'Sessão ausente ou expirada.' });
    return;
  }

  const corpo = (req.body ?? {}) as CorpoRequisicao;

  const nome = corpo.nome?.trim();
  const cpfDigitado = corpo.cpf?.trim();
  const funcao = corpo.funcao?.trim();
  const senha = corpo.senha;

  if (!nome || !cpfDigitado || !senha) {
    res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
    return;
  }

  if (!ehPapelPermitido(corpo.papel)) {
    res.status(400).json({ erro: 'Papel inválido.' });
    return;
  }
  const papel = corpo.papel;

  const cpf = somenteDigitos(cpfDigitado);
  if (!cpf) {
    res.status(400).json({ erro: 'CPF inválido.' });
    return;
  }

  const email = `${cpf}@login.aegis.app`;

  // Service role, nunca a anon key — só esta função (nunca o cliente) tem
  // acesso a `SUPABASE_SERVICE_ROLE_KEY`, necessária tanto para
  // auth.admin.createUser quanto para gravar em `usuarios` (RLS habilitada,
  // sem política ainda — anon key não conseguiria escrever lá).
  const supabaseAdmin = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    let condominioId: string;

    if (tokenSessao) {
      // Quem está criando decide o condomínio do novo funcionário — nunca
      // "o primeiro condomínio que existir" (bug de `limit(1)` que
      // misturava dados entre condomínios assim que houvesse mais de um).
      const { data: chamador, error: erroChamador } =
        await supabaseAdmin.auth.getUser(tokenSessao);

      if (erroChamador || !chamador?.user) {
        res.status(401).json({ erro: 'Sessão inválida.' });
        return;
      }

      const { data: usuarioChamador, error: erroUsuarioChamador } =
        await supabaseAdmin
          .from('usuarios')
          .select('condominio_id')
          .eq('id', chamador.user.id)
          .single();

      if (erroUsuarioChamador || !usuarioChamador) {
        res
          .status(403)
          .json({ erro: 'Usuário não vinculado a um condomínio.' });
        return;
      }

      condominioId = usuarioChamador.condominio_id;
    } else {
      // Sem token, só chega aqui com modoTesteServidor === true (guarda lá
      // em cima). Sem sessão real pra resolver o chamador, volta ao
      // comportamento antigo: único condomínio existente.
      const { data: condominio, error: erroCondominio } = await supabaseAdmin
        .from('condominios')
        .select('id')
        .limit(1)
        .single();

      if (erroCondominio || !condominio) {
        throw erroCondominio ?? new Error('Nenhum condomínio cadastrado.');
      }

      condominioId = condominio.id;
    }

    const { data: usuarioCriado, error: erroAuth } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
      });

    if (erroAuth || !usuarioCriado?.user) {
      if (ehErroEmailDuplicado(erroAuth)) {
        res.status(400).json({ erro: 'CPF já cadastrado.' });
        return;
      }
      if (erroAuth) {
        res.status(400).json({
          erro:
            erroAuth.message ??
            'Não foi possível criar o usuário. Verifique os dados.',
        });
        return;
      }
      throw new Error('Não foi possível criar o usuário.');
    }

    const { error: erroInsert } = await supabaseAdmin.from('usuarios').insert({
      id: usuarioCriado.user.id,
      condominio_id: condominioId,
      papel,
      nome,
      cpf,
      funcao: funcao || null,
      ativo: true,
    });

    if (erroInsert) {
      // Reverte o usuário criado no Auth: sem isso, uma falha aqui (ex.:
      // unique constraint de cpf) deixaria um login órfão sem linha em
      // `usuarios`, e o e-mail sintético ficaria preso para sempre.
      await supabaseAdmin.auth.admin.deleteUser(usuarioCriado.user.id);

      if (erroInsert.code === '23505') {
        res.status(400).json({ erro: 'CPF já cadastrado.' });
        return;
      }
      throw erroInsert;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('criar-funcionario: erro ao criar funcionário', error);
    res.status(500).json({ erro: 'Não foi possível criar o funcionário.' });
  }
}
