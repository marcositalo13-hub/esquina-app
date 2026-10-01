import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatarDiaCurto, resumoDasRotas } from '../data/agendaZeladoria';
import type { PlanoManutencao, Rota } from '../data/manutencao';
import { fonts, light, spacing } from '../theme';
import { type AnchorPosition, CardMenu } from './CardMenu';
import { ResponsavelRota } from './ResponsavelRota';

type TelaRotaProps = {
  rota: Rota;
  // Atividades (planos ativos) da rota, já na ordem de exibição — a tela
  // não decide filtro nem ordem.
  planos: PlanoManutencao[];
  onFechar: () => void;
  onEditarAtividade: (plano: PlanoManutencao) => void;
  onAdicionarAtividade: (rotaId: string) => void;
  // Ações que abrem os Modals da tela-mãe (seletor de responsável com
  // confirmação, "Editar rota") — eles aparecem por cima deste painel.
  onAbrirResponsavel: (rota: Rota) => void;
  onEditarRota: (rota: Rota) => void;
};

// Painel de detalhe da rota (padrão lista-detalhe da seção "Rotas"). Não é
// Modal nem rota de URL: substitui o conteúdo da aba, para que os Modals
// existentes abram por cima sem conflito de empilhamento.
export function TelaRota({
  rota,
  planos,
  onFechar,
  onEditarAtividade,
  onAdicionarAtividade,
  onAbrirResponsavel,
  onEditarRota,
}: TelaRotaProps) {
  const insets = useSafeAreaInsets();
  const [proximaPorPlano, setProximaPorPlano] = useState<Map<
    string,
    string | null
  > | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [ancoraMenu, setAncoraMenu] = useState<AnchorPosition>({ x: 0, y: 0 });
  const botaoMenuRef = useRef<View | null>(null);

  // Recalcula sempre que a lista muda (edição salva, atividade criada): a
  // mesma função de "hoje/próxima" usada pela seção "Rotas".
  // biome-ignore lint/correctness/useExhaustiveDependencies: `planos` é o gatilho de recarga após editar/criar atividade
  useEffect(() => {
    let ativo = true;
    resumoDasRotas([rota.id]).then(
      (resumo) => {
        if (ativo) {
          setProximaPorPlano(resumo.get(rota.id)?.proximaPorPlano ?? new Map());
        }
      },
      (falha) => {
        console.error('Falha ao carregar próximas datas da rota', falha);
        if (ativo) {
          setProximaPorPlano(new Map());
        }
      },
    );
    return () => {
      ativo = false;
    };
  }, [rota.id, planos]);

  function abrirMenu() {
    botaoMenuRef.current?.measureInWindow((x, y, _largura, altura) => {
      setAncoraMenu({ x, y: y + altura });
      setMenuAberto(true);
    });
  }

  function textoProxima(planoId: string): string {
    if (!proximaPorPlano) {
      return '…';
    }
    const data = proximaPorPlano.get(planoId);
    return data ? `próx. ${formatarDiaCurto(data)}` : 'sem próximas';
  }

  return (
    <View style={styles.tela}>
      <View style={[styles.topo, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={onFechar}
          hitSlop={8}
          style={styles.voltar}
          accessibilityLabel="Voltar para Rotas"
        >
          <Ionicons name="chevron-back" size={20} color={light.textPrimary} />
          <Text style={styles.voltarTexto}>Rotas</Text>
        </Pressable>
        <Pressable
          ref={botaoMenuRef}
          onPress={abrirMenu}
          hitSlop={10}
          accessibilityLabel={`Opções da rota ${rota.nome}`}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={light.textSecondary}
          />
        </Pressable>
      </View>

      <CardMenu
        visible={menuAberto}
        onClose={() => setMenuAberto(false)}
        anchorPosition={ancoraMenu}
      >
        <Pressable
          style={styles.menuItem}
          onPress={() => {
            setMenuAberto(false);
            onEditarRota(rota);
          }}
        >
          <Text style={styles.menuItemTexto}>Editar rota</Text>
        </Pressable>
      </CardMenu>

      <ScrollView contentContainerStyle={styles.corpo}>
        <Text style={styles.titulo}>{rota.nome}</Text>

        <View style={styles.linhaResponsavel}>
          <Text style={styles.rotulo}>Responsável</Text>
          <ResponsavelRota
            funcionarioId={rota.funcionario_id}
            onPress={() => onAbrirResponsavel(rota)}
          />
        </View>

        {planos.length === 0 ? (
          <Text style={styles.vazio}>Esta rota ainda não tem atividades.</Text>
        ) : (
          <>
            <Text style={styles.contagem}>
              {planos.length} {planos.length === 1 ? 'atividade' : 'atividades'}
            </Text>
            <View style={styles.pauta}>
              {planos.map((plano) => {
                const local = plano.locais?.nome ?? plano.local ?? null;
                return (
                  <Pressable
                    key={plano.id}
                    onPress={() => onEditarAtividade(plano)}
                    style={({ pressed }) => [
                      styles.atividade,
                      pressed && styles.atividadePressionada,
                    ]}
                    accessibilityLabel={`Editar ${plano.titulo}`}
                  >
                    <View style={styles.atividadeTextos}>
                      <Text style={styles.atividadeTitulo}>{plano.titulo}</Text>
                      <Text style={styles.atividadeDetalhe}>
                        {[local, plano.periodicidade]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <Text style={styles.atividadeProxima}>
                      {textoProxima(plano.id)}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={light.textMuted}
                    />
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <Pressable
          onPress={() => onAdicionarAtividade(rota.id)}
          hitSlop={8}
          style={styles.adicionar}
        >
          <Ionicons name="add" size={18} color={light.inkAction} />
          <Text style={styles.adicionarTexto}>Adicionar atividade</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: light.bg,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  voltar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  voltarTexto: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  menuItem: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  menuItemTexto: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.textPrimary,
  },
  corpo: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  titulo: {
    fontFamily: fonts.headline,
    fontSize: 20,
    color: light.textPrimary,
  },
  linhaResponsavel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rotulo: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
  },
  contagem: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
    marginTop: spacing.sm,
  },
  vazio: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textSecondary,
    marginTop: spacing.md,
  },
  pauta: {
    borderTopWidth: 2,
    borderTopColor: light.inkAction,
  },
  atividade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: light.border,
  },
  atividadePressionada: {
    backgroundColor: light.sunken,
  },
  atividadeTextos: {
    flex: 1,
    gap: 2,
  },
  atividadeTitulo: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  atividadeDetalhe: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: light.textSecondary,
  },
  atividadeProxima: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  adicionar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: spacing.md,
  },
  adicionarTexto: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: light.inkAction,
    textDecorationLine: 'underline',
  },
});

export default TelaRota;
