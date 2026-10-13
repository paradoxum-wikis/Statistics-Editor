type EventParams = Record<string, string | number | boolean>;

declare global {
	interface Window {
		dataLayer: IArguments[];
		gtag: (...args: unknown[]) => void;
	}
}

const CONSENT_KEY = "analyticsConsent";
const TRACKING_ID = "G-D48H2PL948";

let initialized = false;
let resizeTimer: ReturnType<typeof setTimeout> | null = null;

function loadGtagScript() {
	const script = document.createElement("script");
	script.async = true;
	script.src = `https://www.googletagmanager.com/gtag/js?id=${TRACKING_ID}`;
	document.head.appendChild(script);
}

export const analytics = {
	init() {
		if (initialized) return;
		initialized = true;

		window.dataLayer = window.dataLayer || [];
		window.gtag = function gtag() {
			window.dataLayer.push(arguments);
		};

		window.gtag("consent", "default", {
			analytics_storage: "granted",
		});

		if (typeof requestIdleCallback !== "undefined") {
			requestIdleCallback(() => loadGtagScript(), { timeout: 3000 });
		} else {
			setTimeout(loadGtagScript, 0);
		}

		window.gtag("js", new Date());
		window.gtag("config", TRACKING_ID, {
			allow_google_signals: false,
			allow_ad_personalization_signals: false,
			cookie_expires: 0,
		});

		analytics.setConsent(localStorage.getItem(CONSENT_KEY) !== "false");
		analytics.setLayout();
		window.addEventListener("resize", () => {
			if (resizeTimer) clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => analytics.setLayout(), 200);
		});
	},

	setConsent(granted: boolean) {
		localStorage.setItem(CONSENT_KEY, String(granted));
		window.gtag("consent", "update", {
			analytics_storage: granted ? "granted" : "denied",
		});
		document.dispatchEvent(
			new CustomEvent("analyticsConsentChanged", { detail: { granted } }),
		);
	},

	track(name: string, params?: EventParams) {
		window.gtag("event", name, params);
	},

	setLayout() {
		window.gtag("set", "user_properties", {
			app_layout: window.matchMedia("(min-width: 768px)").matches
				? "desktop"
				: "mobile",
		});
	},
};
