import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { hojeLocal } from '../data/manutencao';
import { fonts, light, radius, spacing } from '../theme';
import { MiniCalendar } from './MiniCalendar';

type AdiarAcaoProps = {
  onConfirmar: (novaData: string) => void | Promise<void>;
  // 'botao': gatilho em bloco com borda (uso padrão, solto no card).
  // 'menuItem': gatilho como linha de texto simples, para viver dentro de
  // um menu de 3 pontos (ex.: app/admin/preservacao.tsx).
  variant?: 'botao' | 'menuItem';
};

// Ação "Adiar": abre um popover ancorado com o MiniCalendar (dias antes de
// hoje desabilitados) + Confirmar/Cancelar. Confirmar só habilita depois de
// um dia ser tocado. Não mexe em planos_manutencao nem gera novas ordens —
// só delega a nova data_prevista para o chamador.
export function AdiarAcao({ onConfirmar, variant = 'botao' }: AdiarAcaoProps) {
  const [aberto, setAberto] = useState(false);
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);

  function alternar() {
    if (aberto) {
      setAberto(false);
      return;
    }
    setDataSelecionada(null);
    setAberto(true);
  }

  function cancelar() {
    setAberto(false);
    setDataSelecionada(null);
  }

  async function confirmar() {
    if (!dataSelecionada) {
      return;
    }
    await onConfirmar(dataSelecionada);
    setAberto(false);
    setDataSelecionada(null);
  }

  const gatilho =
    variant === 'menuItem' ? (
      <Pressable style={styles.menuItemTrigger} onPress={alternar}>
        <Text style={styles.menuItemTriggerTexto}>Adiar</Text>
      </Pressable>
    ) : (
      <Pressable style={styles.botao} onPress={alternar}>
        <Text style={styles.botaoTexto}>Adiar</Text>
      </Pressable>
    );

  return (
    <View style={aberto ? styles.wrapperAberto : undefined}>
      {gatilho}

      {aberto ? (
        <>
          <Pressable style={styles.overlay} onPress={cancelar} />
          <View style={styles.painel}>
            <MiniCalendar
              markedDates={{}}
              selectedDate={dataSelecionada}
              onSelectDay={setDataSelecionada}
              desabilitarAntesDe={hojeLocal()}
            />

            <View style={styles.botoesRow}>
              <Pressable style={styles.botaoCancelar} onPress={cancelar}>
                <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.botaoConfirmar,
                  !dataSelecionada && styles.botaoConfirmarDesabilitado,
                ]}
                onPress={confirmar}
                disabled={!dataSelecionada}
              >
                <Text style={styles.botaoConfirmarTexto}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapperAberto: {
    zIndex: 30,
    elevation: 30,
  },
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
  overlay: {
    position: 'absolute',
    top: -2000,
    left: -2000,
    width: 5000,
    height: 5000,
    backgroundColor: 'transparent',
  },
  painel: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: spacing.xs,
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
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
  botaoConfirmarDesabilitado: {
    opacity: 0.4,
  },
  botaoConfirmarTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
});

export default AdiarAcao;
