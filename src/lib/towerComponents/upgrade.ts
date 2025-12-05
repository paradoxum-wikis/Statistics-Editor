import BaseStats from "./baseStats";
import Locator from "./locator";

/**
 * Represents a single upgrade level for a tower.
 */
class Upgrade extends BaseStats {
  upgradeData: any;

  /**
   * Sets up the upgrade stats and patches `Extras` if it's mistakenly an object.
   */
  constructor(data: any, locator: Locator) {
    super(data.Stats, locator);
    this.upgradeData = data;

    this.addAttributeValue("Cost", data.Cost);

    if (
      data.Stats.Extras !== undefined &&
      !(data.Stats.Extras instanceof Array)
    ) {
      data.Stats.Extras = [];
    }
  }

  /**
   * Updates an attribute. Handles "Detections" specially and keeps `upgradeData` in sync.
   */
  set(attribute: string, value: any): void {
    if (attribute === "Detections") {
      this.data.Detections = value;
      return;
    }

    super.set(attribute, value);

    if (this.upgradeData && this.upgradeData[attribute] !== undefined) {
      this.upgradeData[attribute] = value;
    }
  }

  /**
   * Gets an attribute, checking `upgradeData` if the base stats come up empty.
   */
  get(attribute: string): any {
    if (attribute === "Detections") {
      return this.data?.Detections;
    }

    const value = super.get(attribute);

    if (value == null) {
      return this.upgradeData?.[attribute];
    }

    return value;
  }

  /**
   * Adds a detection type if it's missing.
   */
  addDetection(name: string, value: boolean = true) {
    if (!this.locator.hasDetection(name)) {
      this.locator.addDetection(name);
    }

    let detections = this.get("Detections");
    if (!detections) {
      detections = {};
      this.set("Detections", detections);
    }

    if (detections[name] === undefined) {
      detections[name] = value;
    }
  }

  /**
   * Forces a detection type to a specific value.
   */
  setDetection(name: string, value: boolean) {
    if (!this.locator.hasDetection(name)) {
      this.locator.addDetection(name);
    }

    let detections = this.get("Detections");
    if (!detections) {
      detections = {};
      this.set("Detections", detections);
    }

    detections[name] = value;
    this.locator.setDetection(name, value);
  }
}

export default Upgrade;
