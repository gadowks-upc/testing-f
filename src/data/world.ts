export type RoleId = "explorador" | "comprador" | "banquero" | "dueno_banco";

export interface FinancialRole {
  id: RoleId;
  title: string;
  shortTitle: string;
  minLevelCompleted: number; // 0 = start, 1 = after level 1, etc.
  minLifetimeCoins: number;
  perkLabel: string;
  description: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
}

export const FINANCIAL_ROLES: FinancialRole[] = [
  {
    id: "explorador",
    title: "Explorador Ahorrador",
    shortTitle: "Explorador",
    minLevelCompleted: 0,
    minLifetimeCoins: 0,
    perkLabel: "Alcancía inicial lista",
    description:
      "Das tus primeros pasos distinguiendo necesidades reales de antojos y guardando monedas en tu alcancía.",
    accentBg: "bg-teal-50",
    accentText: "text-teal-800",
    accentBorder: "border-teal-300",
  },
  {
    id: "comprador",
    title: "Comprador Inteligente",
    shortTitle: "Comprador",
    minLevelCompleted: 1,
    minLifetimeCoins: 120,
    perkLabel: "10% descuento en Tienda OXXO y Aliados",
    description:
      "Comparas precios antes de pagar y aprovechas descuentos reales en tus productos favoritos.",
    accentBg: "bg-amber-50",
    accentText: "text-amber-800",
    accentBorder: "border-amber-300",
  },
  {
    id: "banquero",
    title: "Banquero Junior",
    shortTitle: "Banquero Jr.",
    minLevelCompleted: 2,
    minLifetimeCoins: 350,
    perkLabel: "Abre tu Bóveda Bancaria (+10% interés por ruta)",
    description:
      "Administras ahorros en tu propio banco infantil y haces crecer las monedas guardadas en tu bóveda.",
    accentBg: "bg-sky-50",
    accentText: "text-sky-800",
    accentBorder: "border-sky-300",
  },
  {
    id: "dueno_banco",
    title: "Dueño de Tu Propio Banco",
    shortTitle: "Dueño de Banco",
    minLevelCompleted: 3,
    minLifetimeCoins: 650,
    perkLabel: "Banco propio completo (+15% interés + 15% dto. en tiendas)",
    description:
      "¡Tienes tu propio banco! Recibes clientes amigables, multiplicas tus ahorros con responsabilidad y ayudas a tu comunidad.",
    accentBg: "bg-emerald-50",
    accentText: "text-emerald-800",
    accentBorder: "border-emerald-300",
  },
];

export type BrandId = "oxxo" | "porrua" | "lumen" | "cinepolis" | "juguetilandia";

export interface BrandPartner {
  id: BrandId;
  name: string;
  tagline: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  stripeColor: string;
}

export const BRAND_PARTNERS: Record<BrandId, BrandPartner> = {
  oxxo: {
    id: "oxxo",
    name: "OXXO",
    tagline: "A la vuelta de tu ahorro",
    badgeBg: "bg-[#D92323]",
    badgeText: "text-[#FACC15]",
    badgeBorder: "border-[#FACC15]",
    stripeColor: "#FACC15",
  },
  porrua: {
    id: "porrua",
    name: "Porrúa Kids",
    tagline: "Lectura y grandes ideas",
    badgeBg: "bg-[#0F766E]",
    badgeText: "text-white",
    badgeBorder: "border-teal-300",
    stripeColor: "#5EEAD4",
  },
  lumen: {
    id: "lumen",
    name: "Lumen",
    tagline: "Arte y útiles escolares",
    badgeBg: "bg-[#EA580C]",
    badgeText: "text-white",
    badgeBorder: "border-orange-300",
    stripeColor: "#FDBA74",
  },
  cinepolis: {
    id: "cinepolis",
    name: "Cinépolis Jr.",
    tagline: "Diversión en pantalla grande",
    badgeBg: "bg-[#1D4ED8]",
    badgeText: "text-white",
    badgeBorder: "border-sky-300",
    stripeColor: "#93C5FD",
  },
  juguetilandia: {
    id: "juguetilandia",
    name: "Juguetilandia",
    tagline: "Juega y construye metas",
    badgeBg: "bg-[#6D28D9]",
    badgeText: "text-white",
    badgeBorder: "border-violet-300",
    stripeColor: "#DDD6FE",
  },
};

export interface RealStoreProduct {
  id: string;
  brandId: BrandId;
  name: string;
  description: string;
  category: "Merienda" | "Escuela" | "Lectura" | "Diversión";
  priceCoins: number;
  realWorldNote: string;
}

export const REAL_WORLD_PRODUCTS: RealStoreProduct[] = [
  {
    id: "oxxo-snack-sano",
    brandId: "oxxo",
    name: "Jugo Natural + Manzana OXXO",
    description: "Merienda energética para recargar pilas después de clases.",
    category: "Merienda",
    priceCoins: 60,
    realWorldNote: "Vale canjeable por merienda saludable en OXXO con mamá o papá.",
  },
  {
    id: "oxxo-helado",
    brandId: "oxxo",
    name: "Paleta o Helado OXXO",
    description: "Un premio refrescante que planeaste sin gastar tus ahorros principales.",
    category: "Merienda",
    priceCoins: 85,
    realWorldNote: "Vale válido por 1 paleta o helado individual en OXXO.",
  },
  {
    id: "oxxo-combo-escolar",
    brandId: "oxxo",
    name: "Combo Escolar OXXO (Cuaderno + Agua)",
    description: "Útiles básicos y agua fresca listos para tus misiones escolares.",
    category: "Escuela",
    priceCoins: 120,
    realWorldNote: "Vale por paquete escolar básico en tienda OXXO participante.",
  },
  {
    id: "lumen-colores",
    brandId: "lumen",
    name: "Set de 12 Colores + Libreta Lumen",
    description: "Herramientas creativas para dibujar tus metas de ahorro.",
    category: "Escuela",
    priceCoins: 150,
    realWorldNote: "Vale para canjear en papelería Lumen por set escolar.",
  },
  {
    id: "porrua-comic",
    brandId: "porrua",
    name: "Libro Aventura de Pequeños Tesoreros",
    description: "Historias ilustradas sobre dinero, inventos y trabajo en equipo.",
    category: "Lectura",
    priceCoins: 180,
    realWorldNote: "Vale válido por libro infantil seleccionado en Porrúa.",
  },
  {
    id: "cinepolis-junior",
    brandId: "cinepolis",
    name: "Entrada Cinépolis Junior + Palomitas",
    description: "Una tarde de película increíble pagada con tu propio esfuerzo.",
    category: "Diversión",
    priceCoins: 260,
    realWorldNote: "Cupón familiar para 1 entrada infantil + combo chico en Cinépolis.",
  },
  {
    id: "juguetilandia-set",
    brandId: "juguetilandia",
    name: "Set Constructor Mini o Balón",
    description: "Meta grande de ahorro para jugar al aire libre o construir.",
    category: "Diversión",
    priceCoins: 340,
    realWorldNote: "Vale de recompensa para juguete de meta grande en Juguetilandia.",
  },
];

export interface PurchasedVoucher {
  voucherId: string;
  code: string;
  productId: string;
  productName: string;
  brandId: BrandId;
  paidCoins: number;
  purchasedAt: string;
  realWorldNote: string;
}

export type BankThemeColor = "emerald" | "amber" | "blue" | "violet";

export interface BankCustomerCase {
  id: string;
  customerName: string;
  question: string;
  goodChoice: string;
  badChoice: string;
  goodReply: string;
  badReply: string;
  rewardCoins: number;
}

export const BANK_CUSTOMER_CASES: BankCustomerCase[] = [
  {
    id: "case-tito-bici",
    customerName: "Tito Alcancía",
    question:
      "¡Hola banquero! Tengo 100 monedas para mi bici, pero me ofrecieron gastarlas hoy en dulces. ¿Qué me recomiendas hacer en tu banco?",
    goodChoice: "Guardarlas en la Bóveda de Ahorro para ganar intereses",
    badChoice: "Sacar todo hoy y gastarlo en dulces",
    goodReply:
      "¡Excelente consejo de banquero! Tu cliente guardó sus monedas y tu banco ganó buena reputación.",
    badReply:
      "¡Uy! Si gasta todo hoy, no juntará para su bici. Prueba aconsejarle ahorrar en la bóveda.",
    rewardCoins: 20,
  },
  {
    id: "case-ardilla-utiles",
    customerName: "Ardilla Sofía",
    question:
      "Quiero abrir una cuenta para mis útiles escolares del próximo mes. ¿Por qué conviene guardar monedas en el banco en vez de llevarlas todas sueltas?",
    goodChoice: "Porque están seguras y crecen poco a poco para su meta",
    badChoice: "Porque así desaparecen más rápido sin darte cuenta",
    goodReply:
      "¡Súper claro! Sofía abrió su cuenta infantil feliz y tu banco creció.",
    badReply:
      "Casi: en un banco responsable el dinero se cuida seguro para cumplir metas.",
    rewardCoins: 20,
  },
];

export function isRoleUnlocked(
  role: FinancialRole,
  completedLevels: number[],
  lifetimeCoinsEarned: number
): boolean {
  if (role.minLevelCompleted === 0) return true;
  return (
    completedLevels.length >= role.minLevelCompleted ||
    lifetimeCoinsEarned >= role.minLifetimeCoins
  );
}

export function getStoreDiscountRate(roleId: RoleId): number {
  if (roleId === "dueno_banco") return 0.15;
  if (roleId === "comprador" || roleId === "banquero") return 0.1;
  return 0;
}

export function getBankInterestRate(roleId: RoleId): number {
  if (roleId === "dueno_banco") return 0.15;
  if (roleId === "banquero") return 0.1;
  return 0.05;
}
