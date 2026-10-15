import type { CarPart } from "@/types";

export const PART_LABELS: Record<CarPart, string> = {
  front_bumper: "Para-choque dianteiro",
  hood: "Capô",
  grille: "Grade frontal",
  headlight_left: "Farol esquerdo",
  headlight_right: "Farol direito",
  fender_left: "Paralama esquerdo",
  fender_right: "Paralama direito",
  door_front_left: "Porta dianteira esquerda",
  door_front_right: "Porta dianteira direita",
  door_rear_left: "Porta traseira esquerda",
  door_rear_right: "Porta traseira direita",
  mirror_left: "Retrovisor esquerdo",
  mirror_right: "Retrovisor direito",
  rear_bumper: "Para-choque traseiro",
  trunk: "Tampa do porta-malas",
  taillight_left: "Lanterna esquerda",
  taillight_right: "Lanterna direita",
  roof: "Teto",
  wheel_fl: "Roda dianteira esquerda",
  wheel_fr: "Roda dianteira direita",
  wheel_rl: "Roda traseira esquerda",
  wheel_rr: "Roda traseira direita",
};

export const DAMAGE_LABELS = {
  scratch_light: "Arranhão leve",
  scratch_deep: "Arranhão profundo",
  dent_light: "Amassado leve",
  dent_medium: "Amassado médio",
  break: "Quebra",
  misalignment: "Desalinhamento",
  other: "Outro",
} as const;

export const VEHICLE_BRANDS = [
  "Audi",
  "BMW",
  "Chevrolet",
  "Fiat",
  "Ford",
  "Honda",
  "Hyundai",
  "Jeep",
  "Mercedes-Benz",
  "Nissan",
  "Peugeot",
  "Renault",
  "Toyota",
  "Volkswagen",
];
