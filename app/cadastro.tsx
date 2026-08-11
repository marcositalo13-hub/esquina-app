import { useCallback, useEffect, useState } from 'react';
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
import { supabase } from '../src/lib/supabase';
import { fonts, light, radius, semantic, spacing } from '../src/theme';

type CadastroTeste = {
  id: string | number;
  nome: string;
  observacao: string | null;
  created_at: string;
};

export default function Cadastro() {
  const [nome, setNome] = useState('');
  const [observacao, setObservacao] = useState('');
  const [registros, setRegistros] = useState<CadastroTeste[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarRegistros = useCallback(async () => {
    const { data, error } = await supabase
      .from('cadastros_teste')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setErro(error.message);
      return;
    }

    setErro(null);
    setRegistros((data ?? []) as CadastroTeste[]);
  }, []);

  useEffect(() => {
    carregarRegistros();
  }, [carregarRegistros]);

  async function handleSalvar() {
    setSalvando(true);
    setErro(null);

    const { error } = await supabase
      .from('cadastros_teste')
      .insert({ nome, observacao });

    setSalvando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    setNome('');
    setObservacao('');
    carregarRegistros();
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Teste de Cadastro</Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              value={nome}
              onChangeText={setNome}
              placeholder="Nome"
              placeholderTextColor={light.textSecondary}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Observação</Text>
            <TextInput
              value={observacao}
              onChangeText={setObservacao}
              placeholder="Observação"
              placeholderTextColor={light.textSecondary}
              style={styles.input}
            />
          </View>

          <Pressable
            style={styles.button}
            onPress={handleSalvar}
            disabled={salvando}
          >
            <Text style={styles.buttonText}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Text>
          </Pressable>

          {erro ? <Text style={styles.erro}>{erro}</Text> : null}
        </View>

        <View style={styles.lista}>
          {registros.map((item) => (
            <View key={item.id} style={styles.item}>
              <Text style={styles.itemNome}>{item.nome}</Text>
              {item.observacao ? (
                <Text style={styles.itemObservacao}>{item.observacao}</Text>
              ) : null}
              <Text style={styles.itemData}>
                {formatarData(item.created_at)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatarData(iso: string) {
  const data = new Date(iso);
  return data.toLocaleString('pt-BR');
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: light.bg,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 24,
    color: light.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  form: {
    gap: spacing.md,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: light.textSecondary,
  },
  input: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: light.textPrimary,
  },
  button: {
    backgroundColor: light.textPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: light.bg,
  },
  erro: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: semantic.overdue,
    marginTop: spacing.xs,
  },
  lista: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  item: {
    backgroundColor: light.card,
    borderWidth: 1,
    borderColor: light.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs / 2,
  },
  itemNome: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: light.textPrimary,
  },
  itemObservacao: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: light.textSecondary,
  },
  itemData: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: light.textMuted,
    marginTop: spacing.xs / 2,
  },
});
