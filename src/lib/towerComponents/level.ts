import Levels from "./levels";

class Level {
  Level: number;
  [key: string]: any;

  constructor(levels: Levels, data: any = {}) {
    this.Level = levels.levels.length;

    levels.attributes.forEach((attribute: string) => {
      if (this[attribute] !== undefined) return;
      if (data[attribute] !== undefined) {
        this[attribute] = data[attribute];
      } else if (this.Level > 0) {
        this[attribute] = levels.getCell(this.Level - 1, attribute);
      }
    });
  }
}

export default Level;
