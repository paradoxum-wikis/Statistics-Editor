import SkinData from "./skinData";

class Tower {
  json: { [towerName: string]: any };
  name: string;
  skinNames: string[];
  skins: { [skinName: string]: SkinData };

  constructor(name: string, data: any) {
    this.json = {
      [name]: data,
    };

    this.name = this.#getName();
    this.skinNames = this.#getSkinNames();
    this.skins = this.#getSkins();
  }

  #getName(): string {
    for (const [towerName] of Object.entries(this.json)) {
      return towerName;
    }
    return "";
  }

  #getSkinNames(): string[] {
    const towerData = this.json[this.name];
    if (!towerData || typeof towerData !== "object") {
      console.warn(`Invalid tower data for ${this.name}:`, towerData);
      return [];
    }

    try {
      return Object.entries(towerData).map(([skinName]) => skinName);
    } catch (error) {
      console.error(`Error getting skin names for ${this.name}:`, error);
      return [];
    }
  }

  #getSkins(): { [skinName: string]: SkinData } {
    return this.skinNames.reduce(
      (output: { [skinName: string]: SkinData }, skinName: string) => {
        const skinData = this.json[this.name]?.[skinName];
        if (skinData && typeof skinData === "object") {
          output[skinName] = new SkinData(this, skinName, skinData);
        } else {
          console.warn(
            `Invalid skin data for ${this.name}.${skinName}:`,
            skinData,
          );
        }
        return output;
      },
      {},
    );
  }

  getSkin(skinName: string): SkinData | undefined {
    return this.skins[skinName];
  }
}

export default Tower;
