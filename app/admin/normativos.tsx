import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type AnchorPosition, CardMenu } from '../../src/components/CardMenu';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { fonts, light, radius, spacing } from '../../src/theme';

type Mensagem = {
  role: 'user' | 'assistant';
  content: string;
};

const MENSAGEM_INICIAL: Mensagem = {
  role: 'assistant',
  content:
    'Olá! Sou o assistente de normativos. Pode me perguntar sobre qualquer regra do condomínio.',
};

const MENSAGEM_ERRO =
  'Não consegui processar sua pergunta agora, tente novamente.';

// Três pontos que saltam em sequência, indicando resposta pendente.
function IndicadorDigitando() {
  const valores = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    const animacoes = valores.map((valor, indice) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(indice * 150),
          Animated.timing(valor, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(valor, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay((valores.length - 1 - indice) * 150),
        ]),
      ),
    );

    for (const animacao of animacoes) {
      animacao.start();
    }
    return () => {
      for (const animacao of animacoes) {
        animacao.stop();
      }
    };
  }, [valores]);

  return (
    <View style={styles.pontosDigitando}>
      {valores.map((valor, indice) => (
        <Animated.View
          // biome-ignore lint/suspicious/noArrayIndexKey: três pontos fixos, sem reordenação
          key={indice}
          style={[
            styles.pontoDigitando,
            {
              transform: [
                {
                  translateY: valor.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -4],
                  }),
                },
              ],
              opacity: valor.interpolate({
                inputRange: [0, 1],
                outputRange: [0.4, 1],
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

// Bolha de mensagem do assistente já finalizada, com ícone de copiar.
function BolhaAssistente({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function handleCopiar() {
    await Clipboard.setStringAsync(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <View style={[styles.bolha, styles.bolhaAssistente]}>
      <Text style={styles.textoBolhaAssistente}>{texto}</Text>
      <Pressable onPress={handleCopiar} hitSlop={8} style={styles.botaoCopiar}>
        <Ionicons
          name={copiado ? 'checkmark' : 'copy-outline'}
          size={14}
          color={light.textSecondary}
        />
        <Text style={styles.botaoCopiarTexto}>
          {copiado ? 'Copiado' : 'Copiar'}
        </Text>
      </Pressable>
    </View>
  );
}

export default function AdminNormativosChat() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const menuIconRef = useRef<View>(null);

  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pergunta, setPergunta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [menuVisivel, setMenuVisivel] = useState(false);
  const [menuAncora, setMenuAncora] = useState<AnchorPosition>({ x: 0, y: 0 });

  function abrirMenu() {
    menuIconRef.current?.measureInWindow((x, y, width, height) => {
      setMenuAncora({ x: x + width - 180, y: y + height });
      setMenuVisivel(true);
    });
  }

  function irParaGerenciar() {
    setMenuVisivel(false);
    router.push('/admin/normativos-gerenciar');
  }

  async function handleEnviar() {
    const texto = pergunta.trim();
    if (!texto || enviando) {
      return;
    }

    const historico = mensagens;
    setMensagens((atual) => [...atual, { role: 'user', content: texto }]);
    setPergunta('');
    setEnviando(true);

    try {
      const resposta = await fetch('/api/normativos-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta: texto, historico }),
      });

      if (!resposta.ok) {
        throw new Error(`normativos-chat respondeu ${resposta.status}`);
      }

      const dados = (await resposta.json()) as { resposta: string };
      setMensagens((atual) => [
        ...atual,
        { role: 'assistant', content: dados.resposta },
      ]);
    } catch (error) {
      console.error('normativos-chat: falha ao enviar pergunta', error);
      setMensagens((atual) => [
        ...atual,
        { role: 'assistant', content: MENSAGEM_ERRO },
      ]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenBackground />

      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => router.push('/admin')}
          style={styles.headerButton}
        >
          <Ionicons name="chevron-back" size={22} color={light.textPrimary} />
        </Pressable>

        <Text style={styles.title}>Normativos</Text>

        <Pressable
          ref={menuIconRef}
          onPress={abrirMenu}
          style={styles.headerButton}
          hitSlop={8}
        >
          <Ionicons
            name="ellipsis-vertical"
            size={20}
            color={light.textPrimary}
          />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.corpo}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
        >
          <View style={[styles.bolha, styles.bolhaAssistente]}>
            <Text style={styles.textoBolhaAssistente}>
              {MENSAGEM_INICIAL.content}
            </Text>
          </View>

          {mensagens.map((mensagem, indice) =>
            mensagem.role === 'user' ? (
              <View
                // biome-ignore lint/suspicious/noArrayIndexKey: lista imutável só cresce no fim, sem reordenação
                key={indice}
                style={[styles.bolha, styles.bolhaUsuario]}
              >
                <Text style={styles.textoBolhaUsuario}>{mensagem.content}</Text>
              </View>
            ) : (
              <BolhaAssistente
                // biome-ignore lint/suspicious/noArrayIndexKey: lista imutável só cresce no fim, sem reordenação
                key={indice}
                texto={mensagem.content}
              />
            ),
          )}

          {enviando ? (
            <View style={[styles.bolha, styles.bolhaAssistente]}>
              <IndicadorDigitando />
            </View>
          ) : null}
        </ScrollView>

        <View
          style={[styles.rodape, { paddingBottom: insets.bottom + spacing.md }]}
        >
          <TextInput
            value={pergunta}
            onChangeText={setPergunta}
            placeholder="Pergunte sobre um normativo…"
            placeholderTextColor={light.textSecondary}
            style={styles.input}
            multiline
          />
          <Pressable
            onPress={handleEnviar}
            disabled={enviando || !pergunta.trim()}
            style={({ pressed }) => [
              styles.botaoEnviar,
              (enviando || !pergunta.trim()) && styles.botaoEnviarDesabilitado,
              pressed && styles.botaoEnviarPressionado,
            ]}
          >
            <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <CardMenu
        visible={menuVisivel}
        onClose={() => setMenuVisivel(false)}
        anchorPosition={menuAncora}
      >
        <Pressable style={styles.menuItem} onPress={irParaGerenciar}>
          <Text style={styles.menuItemTexto}>Gerenciar normativos</Text>
        </Pressable>
      </CardMenu>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: light.bg,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerButton: {
    width: 32,
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: light.textPrimary,
    textAlign: 'center',
  },
  corpo: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  bolha: {
    maxWidth: '80%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bolhaAssistente: {
    alignSelf: 'flex-start',
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
  },
  bolhaUsuario: {
    alignSelf: 'flex-end',
    backgroundColor: light.brand,
  },
  textoBolhaAssistente: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textPrimary,
  },
  textoBolhaUsuario: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: '#FFFFFF',
  },
  pontosDigitando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  pontoDigitando: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: light.textSecondary,
  },
  botaoCopiar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: spacing.xs,
  },
  botaoCopiarTexto: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: light.textSecondary,
  },
  rodape: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: light.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: light.sunken,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: light.textPrimary,
  },
  botaoEnviar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: light.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoEnviarPressionado: {
    backgroundColor: light.brandPressed,
  },
  botaoEnviarDesabilitado: {
    opacity: 0.4,
  },
  menuItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  menuItemTexto: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textPrimary,
  },
});
