// Única lógica de busca do app: ignora acentos e maiúsculas; com várias
// palavras, TODAS precisam aparecer (cada uma em qualquer campo). Nenhuma
// tela normaliza ou compara texto de busca por conta própria.

const MARCAS_DIACRITICAS = /[̀-ͯ]/g;

function normalizarCaractere(caractere: string): string {
  return caractere
    .normalize('NFD')
    .replace(MARCAS_DIACRITICAS, '')
    .toLowerCase();
}

// "  Corrimão   da  ESCADA " → "corrimao da escada"
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(MARCAS_DIACRITICAS, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function palavrasDoTermo(termo: string): string[] {
  const normalizado = normalizar(termo);
  return normalizado ? normalizado.split(' ') : [];
}

export type CampoBusca = {
  rotulo: string;
  valor: string | null | undefined;
};

export type ResultadoBusca = {
  corresponde: boolean;
  // Campo que explica a correspondência (o que contém mais palavras do
  // termo; empate fica com o que veio primeiro na lista). Nulo quando o
  // termo está vazio ou não houve correspondência.
  campo: { rotulo: string; valor: string } | null;
};

export function buscar(termo: string, campos: CampoBusca[]): ResultadoBusca {
  const palavras = palavrasDoTermo(termo);
  if (palavras.length === 0) {
    return { corresponde: true, campo: null };
  }

  const preenchidos = campos
    .filter((campo): campo is { rotulo: string; valor: string } =>
      Boolean(campo.valor),
    )
    .map((campo) => ({ ...campo, normalizado: normalizar(campo.valor) }));

  const todasAparecem = palavras.every((palavra) =>
    preenchidos.some((campo) => campo.normalizado.includes(palavra)),
  );
  if (!todasAparecem) {
    return { corresponde: false, campo: null };
  }

  let melhor: (typeof preenchidos)[number] | null = null;
  let melhorQuantidade = 0;
  for (const campo of preenchidos) {
    const quantidade = palavras.filter((palavra) =>
      campo.normalizado.includes(palavra),
    ).length;
    if (quantidade > melhorQuantidade) {
      melhor = campo;
      melhorQuantidade = quantidade;
    }
  }

  return {
    corresponde: true,
    campo: melhor ? { rotulo: melhor.rotulo, valor: melhor.valor } : null,
  };
}

export type TrechoDestacado = { texto: string; destaque: boolean };

// Divide `valor` (texto original, com acentos) em trechos, marcando os que
// correspondem a palavras do termo — para destacar o motivo do resultado.
export function destacar(valor: string, termo: string): TrechoDestacado[] {
  const palavras = palavrasDoTermo(termo);
  if (palavras.length === 0 || !valor) {
    return [{ texto: valor, destaque: false }];
  }

  // Versão normalizada caractere a caractere, guardando de qual caractere
  // original cada posição veio (acentos somem sem deslocar o resto).
  let normalizado = '';
  const origem: number[] = [];
  const caracteres = Array.from(valor);
  caracteres.forEach((caractere, indice) => {
    const parte = normalizarCaractere(caractere);
    for (const letra of parte) {
      normalizado += letra;
      origem.push(indice);
    }
  });

  const marcado = new Array<boolean>(caracteres.length).fill(false);
  for (const palavra of palavras) {
    let inicio = normalizado.indexOf(palavra);
    while (inicio >= 0) {
      for (let i = inicio; i < inicio + palavra.length; i++) {
        marcado[origem[i]] = true;
      }
      inicio = normalizado.indexOf(palavra, inicio + 1);
    }
  }

  const trechos: TrechoDestacado[] = [];
  caracteres.forEach((caractere, indice) => {
    const ultimo = trechos[trechos.length - 1];
    if (ultimo && ultimo.destaque === marcado[indice]) {
      ultimo.texto += caractere;
    } else {
      trechos.push({ texto: caractere, destaque: marcado[indice] });
    }
  });
  return trechos;
}
