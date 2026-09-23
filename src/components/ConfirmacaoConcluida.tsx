import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';
import { motion, radius, semantic } from '../theme';

type ConfirmacaoConcluidaProps = {
  // Passa a existir (é montado) já com a intenção de tocar a animação uma
  // vez — não tem "ativo: false", quem controla exibição é o pai montando/
  // desmontando este componente. Chama onFim ao terminar (ou de imediato,
  // com reduce motion ativo) pra o pai seguir o fluxo que já existia.
  onFim: () => void;
};

// Pulso de fundo em semantic.ok + check crescendo — sobreposto ao card
// (absolute fill), tocado uma vez antes do card assentar no estado
// esmaecido/concluído que já existe (ExecucaoGuiada avança de etapa,
// modo Lista já re-renderiza esmaecido por baixo). Animated nativo do
// RN — Reanimated não é dependência do projeto, decisão fixada (CLAUDE.md).
// Respeita AccessibilityInfo.isReduceMotionEnabled, pulando pro fim.
export function ConfirmacaoConcluida({ onFim }: ConfirmacaoConcluidaProps) {
  const opacidadeFundo = useRef(new Animated.Value(0)).current;
  const escalaCheck = useRef(new Animated.Value(0)).current;

  // Dispara uma vez ao montar — onFim/refs de Animated.Value não precisam
  // disparar o efeito de novo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: gatilho intencional
  useEffect(() => {
    let montado = true;

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!montado) {
        return;
      }

      if (reduceMotion) {
        onFim();
        return;
      }

      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacidadeFundo, {
            toValue: 1,
            duration: motion.duration.fast,
            easing: motion.easing,
            useNativeDriver: true,
          }),
          Animated.spring(escalaCheck, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(opacidadeFundo, {
          toValue: 0,
          duration: motion.duration.base,
          delay: 150,
          easing: motion.easing,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && montado) {
          onFim();
        }
      });
    });

    return () => {
      montado = false;
    };
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, { opacity: opacidadeFundo }]}
    >
      <Animated.View style={{ transform: [{ scale: escalaCheck }] }}>
        <Ionicons name="checkmark-circle" size={32} color="#FFFFFF" />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: semantic.ok,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ConfirmacaoConcluida;
