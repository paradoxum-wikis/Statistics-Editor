import SkinData from "./skinData";
import Level from "./level";

class Levels {
  skinData: SkinData;
  complexValues: string[];
  complexAttributes: string[];
  attributes: string[];
  levels: Level[];

  constructor(skinData: SkinData) {
    this.skinData = skinData;
    this.complexValues = [];
    this.complexAttributes = [];
    this.attributes = this.#getAttributes();
    this.levels = [];

    this.addLevel(skinData.defaults.attributes);

    this.skinData.upgrades.forEach((upgrade: any) =>
      this.addLevel(upgrade.attributes),
    );
  }

  #getAttributes() {
    const attributes = ["Level"];
    const complexValues: string[] = [];
    const complexAttributes: string[] = [];

    const addComplex = (attribute: any, fullName: string) => {
      for (const [attributeName, attributeValue] of Object.entries(attribute)) {
        const combinedName = fullName + attributeName;
        if (attributeValue instanceof Object) {
          if (!complexAttributes.includes(combinedName))
            complexAttributes.push(combinedName);
          addComplex(attributeValue, combinedName + ".");
        } else {
          if (!complexValues.includes(combinedName))
            complexValues.push(combinedName);
        }
      }
    };

    const processAttribute = (attributeName: string, level: number) => {
      const foundStat = this.skinData.get(level, attributeName);
      if (foundStat instanceof Object) {
        if (!complexAttributes.includes(attributeName))
          complexAttributes.push(attributeName);
        addComplex(foundStat, attributeName + ".");
      } else {
        if (!attributes.includes(attributeName)) attributes.push(attributeName);
      }
    };

    this.skinData.defaults.attributeNames.forEach((name) =>
      processAttribute(name, 0),
    );

    this.skinData.upgrades.forEach((level, index) =>
      level.attributeNames.forEach((name) => processAttribute(name, index + 1)),
    );

    this.complexValues = complexValues;
    this.complexAttributes = complexAttributes;

    return attributes;
  }

  addLevel(data: any): void {
    this.levels.push(new Level(this, data));
  }

  getCell(level: number, propertyId: string): any {
    // checks if the level index is valid for the current internal levels array
    if (!this.levels || level < 0 || level >= this.levels.length) {
      console.error(
        `getCell: Invalid level index ${level} requested. Available levels: ${this.levels?.length}`,
      );
      // returns a default value/structure expected by the caller to avoid crashing :sob:
      return undefined;
    }

    const levelData = this.levels[level];

    if (!levelData) {
      console.error(
        `getCell: Level data at index ${level} is null or undefined.`,
      );
      return undefined;
    }

    return levelData[propertyId];
  }
}

export default Levels;
