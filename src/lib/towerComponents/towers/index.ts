const wikiModules = import.meta.glob("./*.wiki", {
  eager: true,
  query: "?raw",
}) as Record<string, string>;

export const towerNames: string[] = Object.keys(wikiModules)
  .map((path) => path.slice(2, -5))
  .sort();

export const towerCategoryOrder = [
  "Starter",
  "Intermediate",
  "Advanced",
  "Hardcore",
  "Evolved",
  "Golden Perks",
  "Exclusive",
  "Unavailable",
  "Custom",
] as const;

export type TowerCategory = (typeof towerCategoryOrder)[number];

const towersByCategory: Record<
  Exclude<TowerCategory, "Custom">,
  readonly string[]
> = {
  Starter: [
    "Scout",
    "Sniper",
    "Paintballer",
    "Demoman",
    "Slime Trooper",
    "Soldier",
  ],
  Intermediate: [
    "Freezer",
    "Assassin",
    "Militant",
    "Shotgunner",
    "Hunter",
    "Pyromancer",
    "Ace Pilot",
    "Medic",
    "Farm",
    "Electroshocker",
    "Rocketeer",
    "Trapper",
    "Military Base",
    "Crook Boss",
  ],
  Advanced: [
    "Commander",
    "Warden",
    "Cowboy",
    "DJ Booth",
    "Saboteur",
    "Minigunner",
    "Ranger",
    "Pursuit",
    "Gatling Gun",
    "Turret",
    "Mortar",
    "Mercenary Base",
  ],
  Hardcore: [
    "Brawler",
    "Necromancer",
    "Accelerator",
    "Engineer",
    "Hacker",
  ],
  Evolved: ["Operator", "Juggernaut"],
  "Golden Perks": [
    "Golden Minigunner",
    "Golden Pyromancer",
    "Golden Crook Boss",
    "Golden Scout",
    "Golden Cowboy",
    "Golden Soldier",
    "Golden Snowballer",
  ],
  Exclusive: [
    "Gladiator",
    "Commando",
    "Slasher",
    "Frost Blaster",
    "Archer",
    "Swarmer",
    "Toxic Gunner",
    "Sledger",
    "Executioner",
    "Elf Camp",
    "Jester",
    "Cryomancer",
    "Hallow Punk",
    "Harvester",
    "Snowballer",
    "Elementalist",
    "Firework Technician",
    "Biologist",
    "Warlock",
    "Spotlight Tech",
    "War Machine",
    "Mecha Base",
  ],
  Unavailable: [
    "Void Miner",
    "Combatant",
    "Crystallizer",
    "Sentry",
    "Twitgunner",
  ],
};

const categoryByTower = new Map<string, TowerCategory>(
  Object.entries(towersByCategory).flatMap(([category, towers]) =>
    towers.map((tower) => [tower, category as TowerCategory]),
  ),
);

export function groupedTowerNames(
  names: readonly string[],
  query: string,
): { label: TowerCategory; towers: string[] }[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? names.filter((name) => name.toLowerCase().includes(q))
    : names;

  const buckets = new Map<TowerCategory, string[]>();
  for (const name of filtered) {
    const label = categoryByTower.get(name) ?? "Custom";
    const bucket = buckets.get(label) ?? [];
    bucket.push(name);
    buckets.set(label, bucket);
  }

  return towerCategoryOrder.flatMap((label) => {
    const towers = buckets.get(label);
    if (!towers?.length) return [];
    towers.sort((a, b) => a.localeCompare(b));
    return [{ label, towers }];
  });
}
