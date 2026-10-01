import { StyleSheet, Text, type TextStyle } from 'react-native';
import { destacar } from '../lib/busca';
import { fonts, light } from '../theme';

type TextoDestacadoProps = {
  valor: string;
  termo: string;
  style?: TextStyle | TextStyle[];
};

// Texto com as palavras do termo de busca em destaque (motivo do
// resultado). A correspondência vem de src/lib/busca.ts.
export function TextoDestacado({ valor, termo, style }: TextoDestacadoProps) {
  return (
    <Text style={style}>
      {destacar(valor, termo).map((trecho, indice) =>
        trecho.destaque ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: trechos não têm id e a ordem é estável
          <Text key={indice} style={styles.destaque}>
            {trecho.texto}
          </Text>
        ) : (
          trecho.texto
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  destaque: {
    fontFamily: fonts.semiBold,
    color: light.textPrimary,
    backgroundColor: light.sunken,
  },
});

export default TextoDestacado;
