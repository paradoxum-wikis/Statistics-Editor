import Tower from "./tower";
import Defaults from "./defaults";
import Upgrade from "./upgrade";
import Levels from "./levels";
// import BaseStats from "./baseStats";
import Locator from "./locator";

class SkinData {
  tower: Tower;
  name: string;
  data: any;
  locator!: Locator;
  defaults!: Defaults;
  upgrades!: Upgrade[];
  levels!: Levels;
  headers: string[] = [];
  rawRows: any[] = [];
  readOnlyAttributes: string[] = [];

  /**
   *
   * @param {Tower} tower
   * @param {{
   * 	Defaults: {any},
   * 	Upgrades: [any]}} data
   */
  constructor(tower: Tower, name: string, data: any) {
    this.tower = tower;
    this.name = name;
    this.data = data;

    if (!data || typeof data !== "object") {
      console.error(
        `Invalid skin data structure for ${tower.name}.${name}:`,
        data,
      );
      this.data = {
        Defaults: {},
        Upgrades: [],
      };
    }

    // Unwrap inconsistent JSON structures
    while (
      Object.keys(this.data).length === 1 &&
      !this.data.Defaults &&
      !this.data.Upgrades
    ) {
      this.data = this.data[Object.keys(this.data)[0]];
    }

    if (!this.data.Defaults) {
      this.data.Defaults = {};
    }
    if (!this.data.Upgrades || !Array.isArray(this.data.Upgrades)) {
      this.data.Upgrades = [];
    }

    if (this.data.Headers) {
      this.headers = this.data.Headers;
    }
    if (this.data.RawRows) {
      this.rawRows = this.data.RawRows;
    }

    if (this.data.ReadOnly) {
      this.readOnlyAttributes = this.data.ReadOnly;
    }

    this.createData();
  }

  createData() {
    this.locator = new Locator();

    this.defaults = new Defaults(this.data.Defaults, this.locator);

    this.upgrades = this.data.Upgrades.map(
      (upgrade: any) => new Upgrade(upgrade, this.locator),
    );

    this.levels = new Levels(this);
  }

  set(level: number, attribute: string, newValue: any) {
    if (level === 0) {
      this.defaults.set(attribute, newValue);
    } else {
      this.upgrades[level - 1].set(attribute, newValue);
    }

    this.createData();
  }

  get(level: number, attribute: string) {
    if (level === 0) {
      return this.defaults.get(attribute);
    } else {
      return this.upgrades[level - 1].get(attribute);
    }
  }

  setDetection(
    level: number,
    name: string,
    value: boolean,
    rebuild: boolean = true,
  ) {
    if (level === 0) {
      this.defaults.setDetection(name, value);
    } else {
      this.upgrades[level - 1].setDetection(name, value);
    }

    if (rebuild) this.createData();
  }
}
export default SkinData;
