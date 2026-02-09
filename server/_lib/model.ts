import type { Pet, Tutor } from "./types";

export function toPetResponse(pet: Pet) {
  return {
    id: pet.id,
    nome: pet.nome,
    raca: pet.raca,
    idade: pet.idade,
    foto: pet.foto,
  };
}

export function toTutorResponse(tutor: Tutor) {
  return {
    id: tutor.id,
    nome: tutor.nome,
    email: tutor.email,
    telefone: tutor.telefone,
    endereco: tutor.endereco,
    cpf: tutor.cpf,
    foto: tutor.foto,
  };
}
