import { list, put } from "@vercel/blob";
import type { Store } from "./types";

const DATA_KEY = "data.json";

const DEFAULT_STORE: Store = {
  nextPetId: 3,
  nextTutorId: 3,
  nextFotoId: 1,
  pets: [
    {
      id: 1,
      nome: "Rex",
      raca: "Labrador Retriever",
      idade: 3,
      foto: undefined,
      tutores: [1],
    },
    {
      id: 2,
      nome: "Maya",
      raca: "Vira-lata",
      idade: 2,
      foto: undefined,
      tutores: [2],
    },
  ],
  tutores: [
    {
      id: 1,
      nome: "Joao da Silva",
      email: "joao.silva@email.com",
      telefone: "(11) 91234-5678",
      endereco: "Rua das Flores, 123",
      cpf: 12345678901,
      foto: undefined,
      pets: [1],
    },
    {
      id: 2,
      nome: "Maria Santos",
      email: "maria.santos@email.com",
      telefone: "(21) 98765-4321",
      endereco: "Av. Central, 500",
      cpf: 98765432100,
      foto: undefined,
      pets: [2],
    },
  ],
};

export async function loadStore(): Promise<Store> {
  try {
    const blob = await findDataBlob();
    if (!blob) {
      return cloneDefaultStore();
    }

    const response = await fetch(blob.url);
    if (!response.ok) {
      return cloneDefaultStore();
    }

    const data = (await response.json()) as Partial<Store>;
    return {
      ...cloneDefaultStore(),
      ...data,
      pets: data.pets ?? [],
      tutores: data.tutores ?? [],
    };
  } catch {
    return cloneDefaultStore();
  }
}

export async function saveStore(store: Store) {
  await put(DATA_KEY, JSON.stringify(store, null, 2), {
    contentType: "application/json",
    addRandomSuffix: false,
    access: "public",
  });
}

function cloneDefaultStore() {
  return {
    nextPetId: DEFAULT_STORE.nextPetId,
    nextTutorId: DEFAULT_STORE.nextTutorId,
    nextFotoId: DEFAULT_STORE.nextFotoId,
    pets: DEFAULT_STORE.pets.map((pet) => ({
      ...pet,
      tutores: [...pet.tutores],
    })),
    tutores: DEFAULT_STORE.tutores.map((tutor) => ({
      ...tutor,
      pets: [...tutor.pets],
    })),
  };
}

async function findDataBlob() {
  const { blobs } = await list({ prefix: DATA_KEY, limit: 1 });
  const exact = blobs.find((blob) => blob.pathname === DATA_KEY);
  return exact ?? blobs[0] ?? null;
}
