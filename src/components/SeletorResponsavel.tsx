import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFuncionariosAtivos } from '../lib/useFuncionariosAtivos';
import { fonts, light, semantic, spacing } from '../theme';

type SeletorResponsavelProps = {
  selecionadoId: string | null;
  onSelecionar: (id: string | null) => void;
  erro?: string;
  // Mostra "Sem responsável" como opção (só onde é permitido deixar a rota
  // sem ninguém, como em "Editar rota").
  opcaoNenhum?: boolean;
  desabilitado?: boolean;
};

// Única lista de escolha de responsável do app: todos os usuários ATIVOS,
// de qualquer papel (decisão de produto), com nome e função.
export function SeletorResponsavel({
  selecionadoId,
  onSelecionar,
  erro,
  opcaoNenhum = false,
  desabilitado = false,
}: SeletorResponsavelProps) {
  const { estado, ativos, porId, recarregar } = useFuncionariosAtivos();

  const atualInativo =
    selecionadoId && estado === 'pronto' ? porId.get(selecionadoId) : undefined;

  return (
    <View>
      {estado === 'carregando' ? (
        <Text style={styles.textoAuxiliar}>Carregando usuários…</Text>
      ) : estado === 'erro' ? (
        <View style={styles.falha}>
          <Text style={styles.erro}>
            Não foi possível carregar os usuários.
          </Text>
          <Pressable onPress={recarregar} hitSlop={8}>
            <Text style={styles.link}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {atualInativo && !atualInativo.ativo ? (
            <Text style={styles.aviso}>
              {atualInativo.nome} está inativo. Escolha outro responsável.
            </Text>
          ) : null}

          <View style={styles.pauta}>
            {opcaoNenhum ? (
              <Linha
                titulo="Sem responsável"
                selecionada={selecionadoId === null}
                desabilitado={desabilitado}
                onPress={() => onSelecionar(null)}
              />
            ) : null}
            {ativos.map((funcionario) => (
              <Linha
                key={funcionario.id}
                titulo={funcionario.nome}
                detalhe={funcionario.funcao ?? undefined}
                selecionada={selecionadoId === funcionario.id}
                desabilitado={desabilitado}
                onPress={() => onSelecionar(funcionario.id)}
              />
            ))}
          </View>

          {ativos.length === 0 ? (
            <Text style={styles.textoAuxiliar}>
              Nenhum usuário ativo cadastrado.
            </Text>
          ) : null}

          <Pressable onPress={recarregar} hitSlop={8} style={styles.atualizar}>
            <Text style={styles.link}>Atualizar lista</Text>
          </Pressable>
        </>
      )}

      {erro ? <Text style={styles.erroCampo}>{erro}</Text> : null}
    </View>
  );
}

function Linha({
  titulo,
  detalhe,
  selecionada,
  desabilitado,
  onPress,
}: {
  titulo: string;
  detalhe?: string;
  selecionada: boolean;
  desabilitado: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      role="radio"
      aria-checked={selecionada}
      style={({ pressed }) => [
        styles.linha,
        pressed && styles.linhaPressionada,
      ]}
    >
      <View style={styles.linhaTextos}>
        <Text style={styles.linhaTitulo}>{titulo}</Text>
        {detalhe ? <Text style={styles.linhaDetalhe}>{detalhe}</Text> : null}
      </View>
      <View style={[styles.radio, selecionada && styles.radioSelecionado]}>
        {selecionada ? (
          <Ionicons name="checkmark" size={14} color={light.bg} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pauta: {
    marginTop: spacing.sm,
    borderTopWidth: 2,
    borderTopColor: light.inkAction,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: light.border,
  },
  linhaPressionada: {
    backgroundColor: light.sunken,
  },
  linhaTextos: {
    flex: 1,
    gap: 2,
  },
  linhaTitulo: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  linhaDetalhe: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: light.textSecondary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: light.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelecionado: {
    backgroundColor: light.inkAction,
    borderColor: light.inkAction,
  },
  textoAuxiliar: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textSecondary,
    paddingVertical: spacing.md,
  },
  aviso: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: semantic.pending,
    marginTop: spacing.sm,
  },
  falha: {
    gap: spacing.xs,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  erro: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: semantic.overdue,
  },
  erroCampo: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: semantic.overdue,
    marginTop: spacing.sm,
  },
  atualizar: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },
  link: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.inkAction,
    textDecorationLine: 'underline',
  },
});

export default SeletorResponsavel;
