import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
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

          {mensagens.map((mensagem, indice) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: lista imutável só cresce no fim, sem reordenação
              key={indice}
              style={[
                styles.bolha,
                mensagem.role === 'user'
                  ? styles.bolhaUsuario
                  : styles.bolhaAssistente,
              ]}
            >
              <Text
                style={
                  mensagem.role === 'user'
                    ? styles.textoBolhaUsuario
                    : styles.textoBolhaAssistente
                }
              >
                {mensagem.content}
              </Text>
            </View>
          ))}

          {enviando ? (
            <View style={[styles.bolha, styles.bolhaAssistente]}>
              <Text style={styles.textoBolhaAssistente}>Digitando…</Text>
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
