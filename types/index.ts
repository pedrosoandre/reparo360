export type CarPart =
  | "front_bumper"
  | "hood"
  | "grille"
  | "headlight_left"
  | "headlight_right"
  | "fender_left"
  | "fender_right"
  | "door_front_left"
  | "door_front_right"
  | "door_rear_left"
  | "door_rear_right"
  | "mirror_left"
  | "mirror_right"
  | "rear_bumper"
  | "trunk"
  | "taillight_left"
  | "taillight_right"
  | "roof"
  | "wheel_fl"
  | "wheel_fr"
  | "wheel_rl"
  | "wheel_rr";

export type DamageType =
  | "scratch_light"
  | "scratch_deep"
  | "dent_light"
  | "dent_medium"
  | "break"
  | "misalignment"
  | "other";

export type DamageSeverity = "low" | "medium" | "high";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  /**
   * Cidade base do cliente. Alimenta o default do bloco "Enviar para oficina"
   * quando o orçamento não tem `location` — evita todo mundo cair em POA.
   */
  city?: string;
  /** Hash simples client-side — não é segurança de verdade. */
  passwordHash: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  userId: string;
  brand: string;
  model: string;
  year: number;
  glb: string;
  category: string;
  nickname?: string;
  color?: string;
  plate?: string;
  mileage?: number;
  fuel?: string;
  /** Franquia da apólice em BRL, informada pelo usuário. Metade da conta de "vale acionar o seguro?". */
  deductible?: number;
  createdAt: string;
}

/**
 * Dano cadastrado num veículo. Custo é calculado (não persistido) via
 * pricing.estimate() pra sempre refletir a tabela atual.
 */
export interface DamageRecord {
  id: string;
  vehicleId: string;
  part: CarPart;
  damages: DamageType[];
  photos: string[];
  notes?: string;
  location?: string;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DamageItem {
  id: string;
  part: CarPart;
  partLabel: string;
  damages: DamageType[];
  severity: DamageSeverity;
  notes?: string;
  photos?: string[];
  estimatedCost: number;
}

export type BudgetStatus =
  | "draft"
  | "sent"
  | "reviewing"
  | "approved"
  | "rejected"
  | "completed";

export type BudgetExtraKind = "oil_change" | "wheel_alignment";

export interface BudgetExtra {
  id: string;
  kind: BudgetExtraKind;
  label: string;
  price: number;
  addedAt: string;
}

export interface Budget {
  id: string;
  code: string;
  userId: string;
  vehicleId: string;
  vehicleSnapshot: {
    brand: string;
    model: string;
    year: number;
    glb: string;
    category: string;
    color?: string;
  };
  customerName: string;
  customerPhone?: string;
  items: DamageItem[];
  /** Serviços extras adicionados após o orçamento inicial (troca de óleo, alinhamento, etc). */
  extras?: BudgetExtra[];
  photos: string[];
  location?: string;
  notes?: string;
  subtotal: number;
  laborTotal: number;
  paintTotal: number;
  partsTotal: number;
  materialsTotal: number;
  marginTotal: number;
  total: number;
  confidence: number;
  /** Versão da tabela de preços que produziu estes valores — necessário pra auditoria. */
  pricingVersion: string;
  status: BudgetStatus;
  source: "dashboard" | "wizard";
  /**
   * Oficinas que o cliente já contactou por este orçamento. Registrado no
   * clique de "Enviar por WhatsApp" — não confirma resposta, só tentativa.
   */
  contactedOficinas?: ContactedOficina[];
  createdAt: string;
  updatedAt: string;
}

export interface ContactedOficina {
  nome: string;
  cidade: string;
  waId?: string | null;
  sentAt: string;
}

export interface StoredDocument {
  id: string;
  userId: string;
  name: string;
  category: "crlv" | "seguro" | "cnh" | "outro";
  mime: string;
  /** Data URL (base64) — mora todo no localStorage. */
  data: string;
  size: number;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body?: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

export interface DashboardStat {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
}
