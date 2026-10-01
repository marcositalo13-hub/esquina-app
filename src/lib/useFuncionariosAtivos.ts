import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Funcionario } from '../data/funcionarios';

// Lista de usuários via api/listar-funcionarios.ts (service role: `usuarios`
// tem RLS que bloqueia a anon key). A chamada costuma levar ~10 s a frio,
// então o resultado fica em cache de módulo durante a sessão e é
// compartilhado por todos os consumidores montados.

type Snapshot =
  | { estado: 'carregando' }
  | { estado: 'pronto'; todos: Funcionario[] }
  | { estado: 'erro' };

let snapshot: Snapshot = { estado: 'carregando' };
let emAndamento: Promise<void> | null = null;
let obsoleto = false;
const ouvintes = new Set<() => void>();

function publicar(novo: Snapshot) {
  snapshot = novo;
  for (const ouvinte of ouvintes) {
    ouvinte();
  }
}

async function buscarFuncionarios(): Promise<Funcionario[]> {
  const resposta = await fetch('/api/listar-funcionarios');
  const dados = (await resposta.json().catch(() => null)) as {
    funcionarios?: Funcionario[];
    erro?: string;
  } | null;
  if (!resposta.ok) {
    throw new Error(dados?.erro ?? 'Não foi possível carregar os usuários.');
  }
  return dados?.funcionarios ?? [];
}

function carregar(forcar: boolean) {
  if (emAndamento) {
    return;
  }
  if (!forcar && !obsoleto && snapshot.estado === 'pronto') {
    return;
  }
  obsoleto = false;
  // Com dados já em mãos, a recarga acontece por trás, sem voltar a
  // "carregando" nem apagar a lista se a nova chamada falhar.
  const anterior = snapshot;
  if (anterior.estado !== 'pronto') {
    publicar({ estado: 'carregando' });
  }
  emAndamento = buscarFuncionarios()
    .then(
      (todos) => publicar({ estado: 'pronto', todos }),
      () => {
        if (anterior.estado !== 'pronto') {
          publicar({ estado: 'erro' });
        }
      },
    )
    .finally(() => {
      emAndamento = null;
    });
}

// A tela de Funcionários já busca a lista completa (e rebusca depois de
// criar/editar/inativar): aproveita o resultado para manter o cache em dia,
// sem uma segunda chamada.
export function atualizarCacheFuncionarios(todos: Funcionario[]) {
  if (emAndamento) {
    obsoleto = true;
  }
  publicar({ estado: 'pronto', todos });
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function lerSnapshot() {
  return snapshot;
}

export function useFuncionariosAtivos() {
  const atual = useSyncExternalStore(assinar, lerSnapshot, lerSnapshot);

  useEffect(() => {
    carregar(false);
  }, []);

  const recarregar = useCallback(() => carregar(true), []);

  const { ativos, porId } = useMemo(() => {
    const todos = atual.estado === 'pronto' ? atual.todos : [];
    const mapa = new Map<string, Funcionario>();
    for (const item of todos) {
      mapa.set(item.id, item);
    }
    return { ativos: todos.filter((item) => item.ativo), porId: mapa };
  }, [atual]);

  // porId inclui inativos: serve para mostrar o nome de um responsável que
  // foi inativado e saber que ele precisa ser trocado.
  return { estado: atual.estado, ativos, porId, recarregar };
}
