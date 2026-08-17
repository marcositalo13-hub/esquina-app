import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hojeLocal } from '../data/manutencao';
import { supabase } from '../lib/supabase';
import { fonts, light, radius, semantic, spacing } from '../theme';
import { MiniCalendar } from './MiniCalendar';

type AdiarAcaoProps = {
  // Ordem sendo adiada e o plano dela — usados só para a checagem de
  // duplicidade (ver handleSelecionarDia). Não afetam onConfirmar.
  ordemId: string;
  planoId: string;
  onConfirmar: (novaData: string) => void | Promise<void>;
  // 'botao': gatilho em bloco com borda (uso padrão, solto no card).
  // 'menuItem': gatilho como linha de texto simples, para viver dentro de
  // um menu de 3 pontos (ex.: app/admin/preservacao.tsx).
  variant?: 'botao' | 'menuItem';
};

// Ação "Adiar": abre um Modal em tela cheia com o MiniCalendar (dias antes
// de hoje desabilitados) + Cancelar/Confirmar. Confirmar só habilita depois
// de um dia ser tocado E a checagem de duplicidade (mesmo plano, mesma
// data, outra ordem) não encontrar conflito. Não mexe em planos_manutencao
// nem gera novas ordens — só delega a nova data_prevista para o chamador.
export function AdiarAcao({
  ordemId,
  planoId,
  onConfirmar,
  variant = 'botao',
}: AdiarAcaoProps) {
  const insets = useSafeAreaInsets();
  const [aberto, setAberto] = useState(false);
  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [verificandoDuplicidade, setVerificandoDuplicidade] = useState(false);
  const [dataDuplicada, setDataDuplicada] = useState(false);
  const [erroChecagem, setErroChecagem] = useState<string | null>(null);
  // Descarta respostas de checagens obsoletas (usuário já trocou de data
  // antes da consulta anterior voltar).
  const checagemIdRef = useRef(0);

  function abrir() {
    setDataSelecionada(null);
    setDataDuplicada(false);
    setErroChecagem(null);
    setAberto(true);
  }

  function cancelar() {
    setAberto(false);
    setDataSelecionada(null);
    setDataDuplicada(false);
    setErroChecagem(null);
  }

  async function handleSelecionarDia(data: string) {
    setDataSelecionada(data);
    setDataDuplicada(false);
    setErroChecagem(null);
    setVerificandoDuplicidade(true);

    const idChecagem = ++checagemIdRef.current;

    const { data: conflitos, error } = await supabase
      .from('ordens_servico')
      .select('id')
      .eq('plano_id', planoId)
      .eq('data_prevista', data)
      .neq('id', ordemId);

    // Uma checagem mais recente já está em andamento (ou terminou) —
    // ignora esta resposta obsoleta.
    if (idChecagem !== checagemIdRef.current) {
      return;
    }

    setVerificandoDuplicidade(false);

    if (error) {
      setErroChecagem(error.message);
      return;
    }

    setDataDuplicada((conflitos ?? []).length > 0);
  }

  async function confirmar() {
    if (!dataSelecionada || dataDuplicada || verificandoDuplicidade) {
      return;
    }
    await onConfirmar(dataSelecionada);
    setAberto(false);
    setDataSelecionada(null);
    setDataDuplicada(false);
    setErroChecagem(null);
  }

  const confirmarDesabilitado =
    !dataSelecionada || dataDuplicada || verificandoDuplicidade;

  const gatilho =
    variant === 'menuItem' ? (
      <Pressable style={styles.menuItemTrigger} onPress={abrir}>
        <Text style={styles.menuItemTriggerTexto}>Adiar</Text>
      </Pressable>
    ) : (
      <Pressable style={styles.botao} onPress={abrir}>
        <Text style={styles.botaoTexto}>Adiar</Text>
      </Pressable>
    );

  return (
    <>
      {gatilho}

      <Modal
        visible={aberto}
        transparent={false}
        animationType="slide"
        onRequestClose={cancelar}
      >
        <View style={styles.tela}>
          <View
            style={[styles.cabecalho, { paddingTop: insets.top + spacing.md }]}
          >
            <Pressable
              style={styles.cabecalhoBotao}
              onPress={cancelar}
              hitSlop={8}
            >
              <Ionicons
                name="close-outline"
                size={26}
                color={light.textPrimary}
              />
            </Pressable>
            <Text style={styles.titulo}>Adiar atividade</Text>
            <View style={styles.cabecalhoBotao} />
          </View>

          <View style={styles.corpo}>
            <MiniCalendar
              markedDates={{}}
              selectedDate={dataSelecionada}
              onSelectDay={handleSelecionarDia}
              desabilitarAntesDe={hojeLocal()}
            />

            {dataDuplicada ? (
              <Text style={styles.aviso}>
                Já existe uma atividade programada para esta data.
              </Text>
            ) : null}

            {erroChecagem ? (
              <Text style={styles.aviso}>{erroChecagem}</Text>
            ) : null}
          </View>

          <View
            style={[
              styles.rodape,
              { paddingBottom: insets.bottom + spacing.md },
            ]}
          >
            <Pressable style={styles.botaoCancelar} onPress={cancelar}>
              <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[
                styles.botaoConfirmar,
                confirmarDesabilitado && styles.botaoConfirmarDesabilitado,
              ]}
              onPress={confirmar}
              disabled={confirmarDesabilitado}
            >
              <Text style={styles.botaoConfirmarTexto}>Confirmar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
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
  tela: {
    flex: 1,
    backgroundColor: light.bg,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  cabecalhoBotao: {
    width: 32,
    alignItems: 'center',
  },
  titulo: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: light.textPrimary,
    textAlign: 'center',
  },
  corpo: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  aviso: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: semantic.overdue,
    textAlign: 'center',
  },
  rodape: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: light.border,
  },
  botaoCancelar: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
  },
  botaoCancelarTexto: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textSecondary,
  },
  botaoConfirmar: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.md,
    backgroundColor: light.brand,
  },
  botaoConfirmarDesabilitado: {
    opacity: 0.4,
  },
  botaoConfirmarTexto: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});

export default AdiarAcao;
