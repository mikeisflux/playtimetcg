/* Game content that is fixed by the design: die mapping, categories, rarities,
   heat levels, sample cards (from design/handoff/content/game.json). The full
   card catalog lives in the database (Admin → Cards). */

export interface DieFace { faces: number[]; category: Category; color: string; label: string }

export type Category =
  | "Soft Touch" | "Flirty Fun" | "Classic Heat" | "Turn It Up"
  | "Wild Card" | "Focus on You" | "Free Play";

export const CATEGORY_COLORS: Record<Category, string> = {
  "Soft Touch": "#3FD6C8",
  "Flirty Fun": "#5AB8F0",
  "Classic Heat": "#A68CF5",
  "Focus on You": "#E86BD8",
  "Turn It Up": "#FF5C8A",
  "Wild Card": "#FF6A3D",
  "Free Play": "#FFD23F",
};

export const CATEGORIES: Category[] = [
  "Soft Touch", "Flirty Fun", "Classic Heat", "Turn It Up", "Wild Card", "Focus on You", "Free Play",
];

/* The seven ramp colors in ramp order (cool → hot). */
export const RAMP = ["#3FD6C8", "#5AB8F0", "#A68CF5", "#E86BD8", "#FF5C8A", "#FF6A3D", "#FFD23F"];

export const DIE: DieFace[] = [
  { faces: [1, 2], category: "Soft Touch", color: "#3FD6C8", label: "1–2" },
  { faces: [3, 4], category: "Flirty Fun", color: "#5AB8F0", label: "3–4" },
  { faces: [5, 6], category: "Classic Heat", color: "#A68CF5", label: "5–6" },
  { faces: [7, 8], category: "Turn It Up", color: "#FF5C8A", label: "7–8" },
  { faces: [9, 10], category: "Wild Card", color: "#FF6A3D", label: "9–10" },
  { faces: [11], category: "Focus on You", color: "#E86BD8", label: "11" },
  { faces: [12], category: "Free Play", color: "#FFD23F", label: "12" },
];

export function categoryForRoll(n: number): DieFace {
  return DIE.find((d) => d.faces.includes(n)) ?? DIE[0];
}

export type Rarity = "Common" | "Uncommon" | "Rare";

export const RARITIES: { name: Rarity; frame: string; body: string }[] = [
  { name: "Common", frame: "rgba(255,255,255,0.28)", body: "The backbone of the deck. Reliable, repeatable, always welcome." },
  { name: "Uncommon", frame: "linear-gradient(135deg, #6f7681 0%, #e8ecf2 22%, #7d848f 48%, #dfe4ea 74%, #6f7681 100%)", body: "Metallic silver frame. A little more specific, a little more of an occasion." },
  { name: "Rare", frame: "linear-gradient(135deg, #3FD6C8, #5AB8F0, #A68CF5, #E86BD8, #FF5C8A, #FF6A3D, #FFD23F)", body: "Full holographic foil. The cards worth building a night around." },
];

export function rarityFrame(r: string): string {
  return RARITIES.find((x) => x.name === r)?.frame ?? RARITIES[0].frame;
}

export const HEAT_LEVELS = [
  { level: 1, name: "Warm", color: "#3FD6C8", body: "Touch, talk, anticipation." },
  { level: 2, name: "Playful", color: "#5AB8F0", body: "Teasing with intent." },
  { level: 3, name: "Hot", color: "#A68CF5", body: "Straightforwardly sexual." },
  { level: 4, name: "Bold", color: "#FF5C8A", body: "Asks something of you." },
  { level: 5, name: "All in", color: "#FF6A3D", body: "Rare, deliberate, never a surprise." },
];

export interface CardData {
  code: string;
  title: string;
  category: Category;
  rarity: Rarity;
  spice: number;
  time: string;
  text: string;
  set?: string;
  art?: string | null; // full-card artwork, served only to players who own it
}

export const SAMPLE_CARDS: CardData[] = [
  { category: "Soft Touch", code: "B003", title: "Feather Tease", rarity: "Common", spice: 1, time: "5 min", text: "Use a soft feather or scarf to lightly trace over your partner’s body for 5 minutes. No hands allowed." },
  { category: "Flirty Fun", code: "B010", title: "Blindfold Feed", rarity: "Common", spice: 2, time: "8 min", text: "Blindfold your partner and feed them something sweet or savory while describing how good they look." },
  { category: "Classic Heat", code: "B016", title: "Position Remix", rarity: "Common", spice: 3, time: "15 min", text: "Start in your usual favorite position, then switch to a completely different one halfway through." },
  { category: "Turn It Up", code: "B026", title: "Temperature Play", rarity: "Uncommon", spice: 3, time: "10 min", text: "Alternate between something warm and something cool on your partner’s skin." },
  { category: "Wild Card", code: "B032", title: "Dice Control", rarity: "Common", spice: 3, time: "Varies", text: "Roll the die. The number is how many minutes one partner is in complete control." },
  { category: "Focus on You", code: "B038", title: "Guided Hands", rarity: "Common", spice: 2, time: "10 min", text: "The receiving partner places their hands over the giving partner’s and shows exactly the pressure and speed they want." },
  { category: "Free Play", code: "B043", title: "Dealer’s Choice", rarity: "Common", spice: 3, time: "Varies", text: "The roller picks any card from the entire deck and you both do it." },
];

export function sampleCardFor(category: Category): CardData {
  return SAMPLE_CARDS.find((c) => c.category === category) ?? SAMPLE_CARDS[0];
}

export const HOW_STEPS = [
  { n: "01", col: "#3FD6C8", title: "Roll", body: "The 12-sided die picks one of seven categories." },
  { n: "02", col: "#A68CF5", title: "Draw", body: "Take a card from the matching pile. Want a choice? Draw two, keep one." },
  { n: "03", col: "#FF5C8A", title: "Read it out loud", body: "Every word, exactly as written. Saying it is half of it." },
  { n: "04", col: "#FFD23F", title: "Do it, tweak it, or pass", body: "Either of you can pass on any card. Then switch turns and keep going." },
];

export const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
