export type Condo = {
  id: string;
  nome: string;
  imagem: ReturnType<typeof require>;
};

export const condos: Condo[] = [
  {
    id: 'esquina-das-silvas',
    nome: 'Complexo Residencial Esquina das Silvas',
    imagem: require('../assets/condos/esquina-das-silvas/building.png'),
  },
];

export default condos;
