export class AnalyticsService {
  private consentKey = "analyticsConsent";
  private trackingId = "G-D48H2PL948";
  private initialized = false;

  constructor() {
    if (typeof window === "undefined") return;
  }

  public async init() {
    if (typeof window === "undefined" || this.initialized) return;
    this.initialized = true;
    this.setupGtag();

    const storedConsent = localStorage.getItem(this.consentKey);
    if (storedConsent === null) {
      this.setConsent(true);
    } else {
      this.updateConsentMode(storedConsent === "true");
    }

    this.setupEventListeners();
  }

  private setupGtag() {
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).gtag = function () {
      (window as any).dataLayer.push(arguments);
    };

    (window as any).gtag("consent", "default", {
      analytics_storage: "granted",
    });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.trackingId}`;
    document.head.appendChild(script);

    (window as any).gtag("js", new Date());
    (window as any).gtag("config", this.trackingId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: 0,
    });
  }

  private updateConsentMode(granted: boolean) {
    if (typeof (window as any).gtag === "function") {
      (window as any).gtag("consent", "update", {
        analytics_storage: granted ? "granted" : "denied",
      });
    }
  }

  public setConsent(granted: boolean) {
    localStorage.setItem(this.consentKey, granted ? "true" : "false");
    this.updateConsentMode(granted);
    document.dispatchEvent(
      new CustomEvent("analyticsConsentChanged", {
        detail: { granted },
      }),
    );
  }

  public trackEvent(
    category: string,
    action: string,
    label?: string,
    value?: number,
  ) {
    if (typeof (window as any).gtag === "function") {
      (window as any).gtag("event", action, {
        event_category: category,
        event_label: label,
        value: value,
      });
    }
  }

  private setupEventListeners() {
    (window as any).trackEvent = this.trackEvent.bind(this);

    document.addEventListener("towerSelected", (e: any) => {
      if (e.detail?.towerName) {
        this.trackEvent("Tower", "Selected", e.detail.towerName);
      }
    });

    document.addEventListener("calculationSystemChanged", (e: any) => {
      if (e.detail?.tower?.calculationSystem) {
        this.trackEvent(
          "Settings",
          "CalculationSystemChanged",
          e.detail.tower.calculationSystem,
        );
      }
    });
  }
}

export const analytics = new AnalyticsService();
