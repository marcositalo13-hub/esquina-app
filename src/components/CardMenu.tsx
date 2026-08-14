import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  type LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { light, radius } from '../theme';

export type AnchorPosition = { x: number; y: number };

type CardMenuProps = {
  visible: boolean;
  onClose: () => void;
  // Ponto de ancoragem (ex.: canto do ícone de 3 pontos tocado, já com o
  // deslocamento desejado embutido pelo chamador). O painel é posicionado
  // aqui, ajustando automaticamente se vazar pela borda direita/inferior.
  anchorPosition: AnchorPosition;
  children: ReactNode;
};

const LARGURA_ESTIMADA = 180;
const MARGEM_TELA = 12;

// Menu de contexto renderizado via Modal (transparent) — fica SEMPRE acima
// de qualquer outro elemento da tela, independente de zIndex/elevation dos
// cards vizinhos, já que Modal usa uma camada nativa própria.
export function CardMenu({
  visible,
  onClose,
  anchorPosition,
  children,
}: CardMenuProps) {
  const { width, height } = useWindowDimensions();
  const [tamanho, setTamanho] = useState({ width: 0, height: 0 });

  if (!visible) {
    return null;
  }

  const larguraPainel = tamanho.width || LARGURA_ESTIMADA;
  const alturaPainel = tamanho.height;

  let left = anchorPosition.x;
  let top = anchorPosition.y;

  if (left + larguraPainel + MARGEM_TELA > width) {
    left = width - larguraPainel - MARGEM_TELA;
  }
  if (left < MARGEM_TELA) {
    left = MARGEM_TELA;
  }

  if (top + alturaPainel + MARGEM_TELA > height) {
    top = height - alturaPainel - MARGEM_TELA;
  }
  if (top < MARGEM_TELA) {
    top = MARGEM_TELA;
  }

  function handleLayout(event: LayoutChangeEvent) {
    const { width: w, height: h } = event.nativeEvent.layout;
    setTamanho((atual) =>
      atual.width === w && atual.height === h ? atual : { width: w, height: h },
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={[styles.painel, { left, top }]} onLayout={handleLayout}>
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  painel: {
    position: 'absolute',
    minWidth: 160,
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md - 2,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});

export default CardMenu;
