import Locator from "./locator";
// import TowerManager from "./towerManager";

class BaseStats {
  #baseAttributes = [
    "Damage",
    "Cooldown",
    "Range",
    "Attributes",
    "Detections",
    "Price",
    "Extras",
  ];

  attributeNames = [
    "Damage",
    "Cooldown",
    "Range",
    "Hidden",
    "Flying",
    "Lead",
    "Cost",
  ];
  data: any;
  locator: Locator;
  special: any;
  attributes: { [key: string]: any };

  constructor(data: any, locator: Locator) {
    this.data = data || {};
    this.locator = locator;

    this.special = {};
    this.attributes = {};

    this.addAttribute("Damage");
    this.addAttribute("Cooldown");
    this.addAttribute("Range");

    this.#initDetection("Hidden");
    this.#initDetection("Flying");
    this.#initDetection("Lead");

    this.attributes.Cost = this.data.Cost || this.data.Price || 0;

    if (this.data && typeof this.data === "object") {
      for (let key of Object.keys(this.data)) {
        if (this.#baseAttributes.includes(key)) continue;
        this.addAttribute(key);
      }

      const attributesObj = this.data.Attributes;
      if (attributesObj && typeof attributesObj === "object") {
        for (let key of Object.keys(attributesObj)) {
          if (this.#baseAttributes.includes(key)) continue;
          this.addAttribute(key, ["Attributes"]);
        }
      }
    }
  }

  addAttribute(name: string, location?: string[]): void {
    const value = this.locator.locate(this.data, name, location);
    if (value === undefined) return;

    this.locator.addLocation(name, location);
    this.addAttributeValue(name, value);
  }

  addAttributeValue(name: string, value: any): void {
    this.attributeNames.push(name);
    this.attributes[name] = value;
  }

  addDetection(name: string): void {
    this.#initDetection(name);
  }

  #initDetection(name: string): void {
    const value = this.locator.locate(this.data, name, ["Detections"]);
    if (value === undefined) return;

    this.locator.addDetection(name, value);

    this.addAttributeValue(name, value);
  }

  setDetection(name: string, value: boolean): void {
    if (!this.locator.hasDetection(name)) {
      this.locator.addDetection(name);
    }

    if (this.data.Detections === undefined) {
      this.data.Detections = {};
    }

    this.data.Detections[name] = value;
    this.locator.setDetection(name, value);
  }

  set(attribute: string, value: any): void {
    if (["Hidden", "Flying", "Lead"].includes(attribute)) {
      if (this.data.Detections == undefined) {
        this.data.Detections = {};
      }

      this.data.Detections[attribute] = value;
    } else if (this.locator.hasLocation(attribute)) {
      const targetData = this.locator.getOrCreateTargetData(
        this.data,
        this.locator.getLocation(attribute),
      );

      targetData[attribute] = value;
    } else if (attribute === "Cost" && this.data.Price !== undefined) {
      this.data.Price = value;
    } else if (attribute.includes(".")) {
      const propertyChain = attribute.split(".");

      const targetData = this.locator.getOrCreateTargetData(
        this.data,
        this.locator.getLocation(propertyChain[0]),
      );

      let currentValue = targetData;
      for (let i = 0; i < propertyChain.length - 1; i++) {
        let key = propertyChain[i];

        if (currentValue?.[key] === undefined) {
          currentValue[key] = {};
        }

        currentValue = currentValue[key];
      }

      let lastKey = propertyChain[propertyChain.length - 1];
      if (["__proto__", "prototype", "constructor"].includes(lastKey)) {
        throw new Error("Invalid attribute name: prototype pollution attempt");
      }
      currentValue[lastKey] = value;
    }
  }

  get(attribute: string): any {
    if (["Hidden", "Flying", "Lead"].includes(attribute)) {
      return this.data.Detections?.[attribute];
    } else if (this.locator.hasLocation(attribute)) {
      const targetData = this.locator.getTargetData(
        this.data,
        this.locator.getLocation(attribute),
      );

      return targetData[attribute];
    } else if (attribute === "Cost" && this.data.Price !== undefined) {
      return this.data.Price;
    }
  }
}

export default BaseStats;
