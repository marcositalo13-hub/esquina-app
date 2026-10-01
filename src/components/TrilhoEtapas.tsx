import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, light, radius, semantic, spacing } from '../theme';

// Componente PURO de progresso por etapas ("trilho"). Não conhece ordens,
// rotas nem chamados: quem usa traduz o próprio objeto em etapas (para
// objetos do domínio, essa tradução fica numa função em src/data).

export type EstadoEtapa = 'concluida' | 'atual' | 'pendente' | 'alerta';

export type Etapa = {
  rotulo: string;
  estado: EstadoEtapa;
  detalhe?: string;
};

type TrilhoEtapasProps = {
  etapas: Etapa[];
  variante: 'horizontal' | 'vertical';
};

// Acima disso, pontos ficam ilegíveis: vira "contador + barra".
const MAXIMO_PONTOS = 6;

const ESTADO_EM_PORTUGUES: Record<EstadoEtapa, string> = {
  concluida: 'concluída',
  atual: 'atual',
  pendente: 'pendente',
  alerta: 'com alerta',
};

const TAMANHO_PONTO = 22;

function Ponto({ etapa }: { etapa: Etapa }) {
  const rotuloAcessivel = `${etapa.rotulo}, ${ESTADO_EM_PORTUGUES[etapa.estado]}`;
  if (etapa.estado === 'concluida' || etapa.estado === 'alerta') {
    return (
      <View
        accessibilityLabel={rotuloAcessivel}
        style={[
          styles.ponto,
          etapa.estado === 'concluida'
            ? styles.pontoConcluido
            : styles.pontoAlerta,
        ]}
      >
        <Ionicons
          name={etapa.estado === 'concluida' ? 'checkmark' : 'close'}
          size={14}
          color="#FFFFFF"
        />
      </View>
    );
  }
  return (
    <View
      accessibilityLabel={rotuloAcessivel}
      style={[
        styles.ponto,
        etapa.estado === 'atual' ? styles.pontoAtual : styles.pontoPendente,
      ]}
    />
  );
}

function corLinha(etapaAnterior: Etapa | undefined): string {
  return etapaAnterior?.estado === 'concluida' ? semantic.ok : light.border;
}

function estiloRotulo(estado: EstadoEtapa) {
  if (estado === 'atual') {
    return styles.rotuloAtual;
  }
  if (estado === 'pendente') {
    return styles.rotuloPendente;
  }
  return styles.rotulo;
}

// "N de M" + barra contínua — forma usada automaticamente acima de 6
// etapas, e exportada para usos que só têm números.
export function TrilhoContador({
  concluidas,
  total,
}: {
  concluidas: number;
  total: number;
}) {
  const fracao = total > 0 ? Math.min(1, Math.max(0, concluidas / total)) : 0;
  return (
    <View
      style={styles.contador}
      accessibilityLabel={`${concluidas} de ${total} etapas concluídas`}
    >
      <Text style={styles.contadorTexto}>
        {concluidas} de {total}
      </Text>
      <View style={styles.contadorTrilho}>
        <View
          style={[styles.contadorPreenchido, { width: `${fracao * 100}%` }]}
        />
      </View>
    </View>
  );
}

export function TrilhoEtapas({ etapas, variante }: TrilhoEtapasProps) {
  if (etapas.length > MAXIMO_PONTOS) {
    return (
      <TrilhoContador
        concluidas={
          etapas.filter((etapa) => etapa.estado === 'concluida').length
        }
        total={etapas.length}
      />
    );
  }

  if (variante === 'vertical') {
    return (
      <View>
        {etapas.map((etapa, indice) => {
          const ultima = indice === etapas.length - 1;
          return (
            <View key={etapa.rotulo} style={styles.vLinha}>
              <View style={styles.vColunaPonto}>
                <Ponto etapa={etapa} />
                {ultima ? null : (
                  <View
                    style={[
                      styles.vConector,
                      { backgroundColor: corLinha(etapa) },
                    ]}
                  />
                )}
              </View>
              <View style={styles.vTextos}>
                <Text style={estiloRotulo(etapa.estado)}>{etapa.rotulo}</Text>
                {etapa.detalhe ? (
                  <Text style={styles.detalhe}>{etapa.detalhe}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  const indiceAtual = etapas.findIndex(
    (etapa) => etapa.estado === 'atual' || etapa.estado === 'alerta',
  );
  const posicao =
    indiceAtual >= 0
      ? indiceAtual
      : Math.min(
          etapas.length - 1,
          etapas.filter((etapa) => etapa.estado === 'concluida').length,
        );
  const rotuloConjunto = etapas[posicao]
    ? `Passo ${posicao + 1} de ${etapas.length}: ${etapas[posicao].rotulo}`
    : '';

  return (
    <View style={styles.hContainer} accessibilityLabel={rotuloConjunto}>
      {etapas.map((etapa, indice) => {
        const primeira = indice === 0;
        const ultima = indice === etapas.length - 1;
        return (
          <View key={etapa.rotulo} style={styles.hEtapa}>
            <View style={styles.hLinhaPontos}>
              <View
                style={[
                  styles.hConector,
                  {
                    backgroundColor: primeira
                      ? 'transparent'
                      : corLinha(etapas[indice - 1]),
                  },
                ]}
              />
              <Ponto etapa={etapa} />
              <View
                style={[
                  styles.hConector,
                  {
                    backgroundColor: ultima ? 'transparent' : corLinha(etapa),
                  },
                ]}
              />
            </View>
            <Text
              style={[estiloRotulo(etapa.estado), styles.hRotulo]}
              numberOfLines={1}
            >
              {etapa.rotulo}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  ponto: {
    width: TAMANHO_PONTO,
    height: TAMANHO_PONTO,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pontoConcluido: {
    backgroundColor: semantic.ok,
  },
  pontoAlerta: {
    backgroundColor: semantic.overdue,
  },
  pontoAtual: {
    borderWidth: 2,
    borderColor: light.textPrimary,
    backgroundColor: 'transparent',
  },
  pontoPendente: {
    borderWidth: 2,
    borderColor: light.border,
    backgroundColor: 'transparent',
  },
  rotulo: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: light.textPrimary,
  },
  rotuloAtual: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: light.textPrimary,
  },
  rotuloPendente: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: light.textSecondary,
  },
  detalhe: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textSecondary,
  },
  hContainer: {
    flexDirection: 'row',
  },
  hEtapa: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  hLinhaPontos: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  hConector: {
    flex: 1,
    height: 2,
  },
  hRotulo: {
    textAlign: 'center',
  },
  vLinha: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  vColunaPonto: {
    alignItems: 'center',
  },
  vConector: {
    width: 2,
    flex: 1,
    minHeight: spacing.md,
  },
  vTextos: {
    flex: 1,
    paddingBottom: spacing.md,
    gap: 2,
  },
  contador: {
    gap: spacing.xs,
  },
  contadorTexto: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  contadorTrilho: {
    height: 4,
    borderRadius: radius.lg,
    backgroundColor: light.border,
    overflow: 'hidden',
  },
  contadorPreenchido: {
    height: 4,
    backgroundColor: semantic.ok,
  },
});

export default TrilhoEtapas;
