import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fonts, light, radius, spacing } from '../theme';

function amanha(): string {
  const data = new Date();
  data.setDate(data.getDate() + 1);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

type AdiarAcaoProps = {
  onConfirmar: (novaData: string) => void | Promise<void>;
  // 'botao': gatilho em bloco com borda (uso padrão, solto no card).
  // 'menuItem': gatilho como linha de texto simples, para viver dentro de
  // um menu de 3 pontos (ex.: app/admin/preservacao.tsx).
  variant?: 'botao' | 'menuItem';
};

// Ação "Adiar" que revela, inline, um campo de data + Confirmar/Cancelar.
// Não mexe em planos_manutencao nem gera novas ordens — só delega a nova
// data_prevista para o chamador.
export function AdiarAcao({ onConfirmar, variant = 'botao' }: AdiarAcaoProps) {
  const [aberto, setAberto] = useState(false);
  const [novaData, setNovaData] = useState(amanha);

  function abrir() {
    setNovaData(amanha());
    setAberto(true);
  }

  function cancelar() {
    setAberto(false);
  }

  async function confirmar() {
    await onConfirmar(novaData);
    setAberto(false);
  }

  if (!aberto) {
    if (variant === 'menuItem') {
      return (
        <Pressable style={styles.menuItemTrigger} onPress={abrir}>
          <Text style={styles.menuItemTriggerTexto}>Adiar</Text>
        </Pressable>
      );
    }

    return (
      <Pressable style={styles.botao} onPress={abrir}>
        <Text style={styles.botaoTexto}>Adiar</Text>
      </Pressable>
    );
  }

  return (
    <View
      style={
        variant === 'menuItem' ? styles.formularioMenuItem : styles.formulario
      }
    >
      <TextInput
        value={novaData}
        onChangeText={setNovaData}
        placeholder="AAAA-MM-DD"
        placeholderTextColor={light.textSecondary}
        style={styles.input}
      />
      <View style={styles.botoesRow}>
        <Pressable style={styles.botaoCancelar} onPress={cancelar}>
          <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
        </Pressable>
        <Pressable style={styles.botaoConfirmar} onPress={confirmar}>
          <Text style={styles.botaoConfirmarTexto}>Confirmar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  botao: {
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  botaoTexto: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
  },
  menuItemTrigger: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  menuItemTriggerTexto: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textPrimary,
  },
  formulario: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  formularioMenuItem: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  input: {
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textPrimary,
  },
  botoesRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  botaoCancelar: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
  },
  botaoCancelarTexto: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: light.textSecondary,
  },
  botaoConfirmar: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: light.brand,
  },
  botaoConfirmarTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
});

export default AdiarAcao;
