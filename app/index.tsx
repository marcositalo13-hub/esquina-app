import { Redirect } from 'expo-router';

const modoTeste = process.env.EXPO_PUBLIC_MODO_TESTE === 'true';

export default function Index() {
  return <Redirect href={modoTeste ? '/seletor-teste' : '/login'} />;
}
