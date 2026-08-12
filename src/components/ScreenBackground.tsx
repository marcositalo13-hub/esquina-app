import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

// Mesmo gradiente de tela cheia validado em app/home.tsx: fraco no topo,
// intensificando em direção à base.
export function ScreenBackground() {
  return (
    <LinearGradient
      colors={[
        'rgba(216, 220, 240, 0.12)',
        'rgba(216, 220, 240, 0.35)',
        'rgba(216, 220, 240, 0.7)',
      ]}
      locations={[0, 0.6, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    />
  );
}

const styles = StyleSheet.create({
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default ScreenBackground;
