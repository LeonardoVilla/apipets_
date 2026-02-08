export type Anexo = {
  id: number;
  nome: string;
  contentType: string;
  url: string;
};

export type Pet = {
  id: number;
  nome: string;
  raca?: string;
  idade?: number;
  foto?: Anexo;
  tutores: number[];
};

export type Tutor = {
  id: number;
  nome: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cpf?: number;
  foto?: Anexo;
  pets: number[];
};

export type Store = {
  nextPetId: number;
  nextTutorId: number;
  nextFotoId: number;
  pets: Pet[];
  tutores: Tutor[];
};
