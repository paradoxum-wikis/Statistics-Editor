import SkinData from "./skinData";
import BaseStats from "./baseStats";
import Locator from "./locator";

class Defaults extends BaseStats {
  constructor(data: any, locator: Locator) {
    super(data, locator);

    this.attributes["Hidden"] = this.attributes["Hidden"] ?? false;
    this.attributes["Lead"] = this.attributes["Lead"] ?? false;
    this.attributes["Flying"] = this.attributes["Flying"] ?? false;
  }
}

export default Defaults;
