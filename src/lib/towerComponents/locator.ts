export default class Locator {
  locations: { [attribute: string]: string[] };
  detections: { [name: string]: boolean };

  constructor() {
    this.locations = {};
    this.detections = {};
  }

  addLocation(attribute: string, location: string[] | undefined): void {
    this.locations[attribute] = location ?? [];
  }

  getLocation(attribute: string): string[] {
    return this.locations[attribute] || [];
  }

  hasLocation(attribute: string): boolean {
    return this.locations[attribute] !== undefined;
  }

  hasDetection(name: string): boolean {
    return this.detections[name] !== undefined;
  }

  addDetection(name: string, value: boolean = true): void {
    this.detections[name] = value;
    if (!this.hasLocation(name)) {
      this.addLocation(name, ["Detections"]);
    }
  }

  setDetection(name: string, value: boolean): void {
    if (!this.hasDetection(name)) {
      this.addDetection(name, value);
      return;
    }

    this.detections[name] = value;
  }

  getTargetData(data: any, location: string[]): any {
    return location.reduce((target: any, next: string) => target?.[next], data);
  }

  getOrCreateTargetData(data: any, location: string[]): any {
    return location.reduce((target: any, next: string) => {
      if (target[next] === undefined) {
        target[next] = {};
      }
      return target[next];
    }, data);
  }

  locate(data: any, attribute: string, location?: string[]): any {
    location = location ?? [];

    const targetData = this.getTargetData(data, location);

    return targetData?.[attribute];
  }
}
