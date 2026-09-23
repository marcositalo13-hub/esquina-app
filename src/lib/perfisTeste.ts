import AsyncStorage from '@react-native-async-storage/async-storage';

// Perfis de teste ficam só no dispositivo (AsyncStorage) — nunca no código
// nem no banco. Usados só pelo atalho de login em desenvolvimento (ver
// app/perfis-teste.tsx), nunca em produção real com moradores.

export type PerfilTeste = {
  id: string;
  apelido: string;
  cpf: string;
  senha: string;
};

const CHAVE_STORAGE = 'perfisTeste';

export async function listarPerfisTeste(): Promise<PerfilTeste[]> {
  const bruto = await AsyncStorage.getItem(CHAVE_STORAGE);
  if (!bruto) {
    return [];
  }
  try {
    const perfis = JSON.parse(bruto);
    return Array.isArray(perfis) ? perfis : [];
  } catch {
    return [];
  }
}

export async function adicionarPerfilTeste(
  perfil: Omit<PerfilTeste, 'id'>,
): Promise<void> {
  const perfis = await listarPerfisTeste();
  const novoPerfil: PerfilTeste = {
    ...perfil,
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
  };
  await AsyncStorage.setItem(
    CHAVE_STORAGE,
    JSON.stringify([...perfis, novoPerfil]),
  );
}

export async function removerPerfilTeste(id: string): Promise<void> {
  const perfis = await listarPerfisTeste();
  await AsyncStorage.setItem(
    CHAVE_STORAGE,
    JSON.stringify(perfis.filter((perfil) => perfil.id !== id)),
  );
}
