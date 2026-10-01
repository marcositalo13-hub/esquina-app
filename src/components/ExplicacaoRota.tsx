import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts, light, spacing } from '../theme';

// Único lugar com o texto que explica o que é uma rota — usado nos fluxos
// guiados de nova rota e de nova atividade.
const LINHAS_COMO_FUNCIONA = [
  'Só o responsável vê as atividades da rota dele.',
  'A ordem das atividades é o caminho que ele percorre.',
  'Se ele faltar, troque o responsável: tudo passa para o substituto.',
];

export function ExplicacaoRota() {
  const [aberto, setAberto] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.subtitulo}>
        A rota organiza o dia de um responsável.
      </Text>
      <Pressable
        onPress={() => setAberto((valor) => !valor)}
        hitSlop={8}
        style={styles.gatilho}
        aria-expanded={aberto}
      >
        <Text style={styles.gatilhoTexto}>Como funciona</Text>
        <Ionicons
          name={aberto ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={light.textSecondary}
        />
      </Pressable>
      {aberto ? (
        <View style={styles.lista}>
          {LINHAS_COMO_FUNCIONA.map((linha) => (
            <Text key={linha} style={styles.linha}>
              {linha}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  subtitulo: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textSecondary,
  },
  gatilho: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 2,
  },
  gatilhoTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
    textDecorationLine: 'underline',
  },
  lista: {
    gap: spacing.xs,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: light.border,
  },
  linha: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
});

export default ExplicacaoRota;
