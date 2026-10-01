import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useFuncionariosAtivos } from '../lib/useFuncionariosAtivos';
import { fonts, light, radius, semantic, spacing } from '../theme';

type ResponsavelRotaProps = {
  funcionarioId: string | null;
  // Abre a escolha de responsável (SeletorResponsavel) — quem chama decide
  // onde e como gravar.
  onPress: () => void;
};

// Responsável exibido no card de rota: nome (com ícone) quando há um
// responsável ativo; selo "Definir responsável" em cor de alerta quando não
// há ninguém ou quando o responsável está inativo.
export function ResponsavelRota({
  funcionarioId,
  onPress,
}: ResponsavelRotaProps) {
  const { estado, porId } = useFuncionariosAtivos();
  const responsavel = funcionarioId ? porId.get(funcionarioId) : undefined;
  // Inatividade só é conhecida depois que a lista de usuários carregou.
  const semResponsavelAtivo =
    !funcionarioId || (estado === 'pronto' && !responsavel?.ativo);

  if (semResponsavelAtivo) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={8}
        style={({ pressed }) => [
          styles.selo,
          pressed && styles.seloPressionado,
        ]}
      >
        <Text style={styles.seloTexto}>Definir responsável</Text>
      </Pressable>
    );
  }

  const nome =
    responsavel?.nome ??
    (estado === 'carregando' ? 'Carregando…' : 'Responsável definido');

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={styles.responsavel}
      accessibilityLabel={`Responsável: ${nome}. Trocar responsável`}
    >
      <Ionicons name="person-outline" size={14} color={light.textSecondary} />
      <Text style={styles.responsavelTexto}>{nome}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  responsavel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  responsavelTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
  },
  selo: {
    borderWidth: 1,
    borderColor: semantic.pending,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: `${semantic.pending}1A`,
  },
  seloPressionado: {
    backgroundColor: `${semantic.pending}33`,
  },
  seloTexto: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: semantic.pending,
  },
});

export default ResponsavelRota;
