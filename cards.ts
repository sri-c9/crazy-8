// Card type definitions and generation logic

export type CardColor = "red" | "blue" | "green" | "yellow";

export interface NumberCard {
  type: "number";
  color: CardColor;
  value: number;
}

export interface WildCard {
  type: "wild";
  chosenColor: CardColor | null;
}

export interface Plus2Card {
  type: "plus2";
  color: CardColor;
}

export interface Plus4Card {
  type: "plus4";
}

export interface Plus20Card {
  type: "plus20";
}

export interface Plus20ColorCard {
  type: "plus20color";
  color: CardColor;
}

export interface SkipCard {
  type: "skip";
  color: CardColor;
}

export interface ReverseCard {
  type: "reverse";
  color: CardColor;
}

export interface SwapCard {
  type: "swap";
  color: CardColor;
}

export interface PickSwapCard {
  type: "pickswap";
  color: CardColor;
}

export interface WildPickSwapCard {
  type: "wildpickswap";
}

export interface NopeCard {
  type: "nope";
  color: CardColor;
}

export interface RotateCard {
  type: "rotate";
  color: CardColor;
}

export interface StealCard {
  type: "steal";
  color: CardColor;
}

export interface LuckyHandCard {
  type: "luckyhand";
  color: CardColor;
}

export interface GodModeCard {
  type: "godmode";
  color: CardColor;
}

export type GodPower = "allSeeingEye" | "bigBang" | "reincarnation";

export type Card =
  | NumberCard
  | WildCard
  | Plus2Card
  | Plus4Card
  | Plus20Card
  | Plus20ColorCard
  | SkipCard
  | ReverseCard
  | SwapCard
  | PickSwapCard
  | WildPickSwapCard
  | NopeCard
  | RotateCard
  | StealCard
  | LuckyHandCard
  | GodModeCard;

const COLORS: CardColor[] = ["red", "blue", "green", "yellow"];
const NUMBER_VALUES: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 9];

// Helper to get a random color
export function randomColor(): CardColor {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

// Helper to get a random number value
function randomNumberValue(): number {
  return NUMBER_VALUES[Math.floor(Math.random() * NUMBER_VALUES.length)];
}

export interface CardTypeConfig {
  type: Card["type"];
  weight: number;
  generate: () => Card;
}

// Weighted distribution for random card generation.
// Tweak weights here to change how often each card type appears.
export const CARD_DISTRIBUTION: CardTypeConfig[] = [
  { type: "number", weight: 0.44, generate: () => ({ type: "number", color: randomColor(), value: randomNumberValue() }) },
  { type: "wild", weight: 0.05, generate: () => ({ type: "wild", chosenColor: null }) },
  { type: "plus2", weight: 0.09, generate: () => ({ type: "plus2", color: randomColor() }) },
  { type: "plus4", weight: 0.05, generate: () => ({ type: "plus4" }) },
  { type: "plus20", weight: 0.03, generate: () => ({ type: "plus20" }) },
  { type: "plus20color", weight: 0.03, generate: () => ({ type: "plus20color", color: randomColor() }) },
  { type: "skip", weight: 0.05, generate: () => ({ type: "skip", color: randomColor() }) },
  { type: "reverse", weight: 0.04, generate: () => ({ type: "reverse", color: randomColor() }) },
  { type: "swap", weight: 0.02, generate: () => ({ type: "swap", color: randomColor() }) },
  { type: "pickswap", weight: 0.02, generate: () => ({ type: "pickswap", color: randomColor() }) },
  { type: "wildpickswap", weight: 0.02, generate: () => ({ type: "wildpickswap" }) },
  { type: "nope", weight: 0.05, generate: () => ({ type: "nope", color: randomColor() }) },
  { type: "rotate", weight: 0.04, generate: () => ({ type: "rotate", color: randomColor() }) },
  { type: "steal", weight: 0.02, generate: () => ({ type: "steal", color: randomColor() }) },
  { type: "luckyhand", weight: 0.03, generate: () => ({ type: "luckyhand", color: randomColor() }) },
  { type: "godmode", weight: 0.02, generate: () => ({ type: "godmode", color: randomColor() }) },
];

// Verify weights sum to 1.0 (catches typos when adjusting frequencies).
const totalWeight = CARD_DISTRIBUTION.reduce((sum, entry) => sum + entry.weight, 0);
if (Math.abs(totalWeight - 1.0) > 0.0001) {
  throw new Error(
    `CARD_DISTRIBUTION weights must sum to 1.0, got ${totalWeight.toFixed(4)}`
  );
}

// Lucky Hand boosted draw: ~10% plain number, ~90% special (full pool, including
// luckyhand and godmode). Derived from CARD_DISTRIBUTION so weights stay DRY.
const numberEntry = CARD_DISTRIBUTION.find((e) => e.type === "number")!;
const specialEntries = CARD_DISTRIBUTION.filter((e) => e.type !== "number");
const specialWeightSum = specialEntries.reduce((s, e) => s + e.weight, 0);
export const BOOSTED_NUMBER_CHANCE = 0.1;

export function generateBoostedCard(): Card {
  if (Math.random() < BOOSTED_NUMBER_CHANCE) {
    return numberEntry.generate();
  }
  const rand = Math.random() * specialWeightSum;
  let cumulative = 0;
  for (const entry of specialEntries) {
    cumulative += entry.weight;
    if (rand < cumulative) {
      return entry.generate();
    }
  }
  return specialEntries[specialEntries.length - 1].generate();
}

// Generate a random card using the configured weighted distribution.
export function generateCard(): Card {
  const rand = Math.random();
  let cumulative = 0;

  for (const entry of CARD_DISTRIBUTION) {
    cumulative += entry.weight;
    if (rand < cumulative) {
      return entry.generate();
    }
  }

  // Fallback for floating-point edge cases
  return CARD_DISTRIBUTION[CARD_DISTRIBUTION.length - 1].generate();
}
