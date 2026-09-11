import { StyleSheet, View } from 'react-native';
import { light } from '../theme';

// Fundo sólido de tela cheia — papel liso, sem gradiente.
export function ScreenBackground() {
  return <View style={styles.background} />;
}

const styles = StyleSheet.create({
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: light.bg,
  },
});

export default ScreenBackground;
