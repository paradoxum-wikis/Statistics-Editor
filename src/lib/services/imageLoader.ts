/**
 * Handles loading and caching images for tower upgrades from Roblox asset delivery.
 *
 * This service has two layers of caching:
 * 1) In-memory per tower/index
 * 2) Persistent Cache API for Roblox asset IDs
 * This was ported from the old Statistics Editor
 */
import { mwWikiFileUrl, mwSetBaseUrl } from "mediawiki-file-url";

mwSetBaseUrl("https://static.wikia.nocookie.net/tower-defense-sim/images/");

export const IMAGE_EXT = "jpe?g|png|gif|webp|svg|bmp|avif";
const RE_IMAGE_EXT = new RegExp(`\\.(${IMAGE_EXT})([/?#]|$)`, "i");

// $wgAllowExternalImagesFrom
const EXTERNAL_IMAGE_PREFIXES = [
  "https://images.wikia.com",
  "https://static.wikia.com",
  "https://static.wikia.nocookie.net",
  "https://img.wikia.nocookie.net",
  "https://img1.wikia.nocookie.net",
  "https://img2.wikia.nocookie.net",
  "https://img3.wikia.nocookie.net",
  "https://img4.wikia.nocookie.net",
  "https://img5.wikia.nocookie.net",
  "https://images.wikia.nocookie.net",
  "https://images1.wikia.nocookie.net",
  "https://images2.wikia.nocookie.net",
  "https://images3.wikia.nocookie.net",
  "https://images4.wikia.nocookie.net",
  "https://images5.wikia.nocookie.net",
  "https://vignette.wikia.nocookie.net",
  "https://vignette1.wikia.nocookie.net",
  "https://vignette2.wikia.nocookie.net",
  "https://vignette3.wikia.nocookie.net",
  "https://vignette4.wikia.nocookie.net",
  "https://vignette5.wikia.nocookie.net",
];

export function resolveWikiFileUrl(imageIdStr: string): string | null {
  const s = imageIdStr.trim();
  if (!s || !/^((File|Image)\s*:)/i.test(s)) return null;

  try {
    return mwWikiFileUrl(s);
  } catch {
    return null;
  }
}

export function isDirectImageUrl(url: string): boolean {
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) return false;
  try {
    return RE_IMAGE_EXT.test(new URL(u).pathname);
  } catch {
    return RE_IMAGE_EXT.test(u);
  }
}

export function isAllowedExternalImageUrl(url: string): boolean {
  if (!isDirectImageUrl(url)) return false;
  const normalized = url.trim().toLowerCase();
  return EXTERNAL_IMAGE_PREFIXES.some((prefix) =>
    normalized.startsWith(
      prefix.endsWith("/") ? prefix.toLowerCase() : `${prefix.toLowerCase()}/`,
    ),
  );
}

export function proxyImageUrl(url: string): string {
  return `https://api.tds-editor.com/?url=${encodeURIComponent(url)}`;
}

type LoadingState = Map<string, boolean>;
type FailedRequests = Set<string>;

type CacheConfig = {
  cacheName: string;
  keyPrefix: string;
  enableDebug: boolean;
  ttlMs: number;
};

const DEFAULT_CONFIG: CacheConfig = {
  cacheName: "tdse-image-cache-v2",
  keyPrefix: "image-",
  enableDebug: false,
  ttlMs: 1000 * 60 * 60 * 24 * 30, // 30 days
};

/**
 * Represents the current state of the image loader.
 */
export interface ImageLoaderState {
  images: { [key: number]: string };
  loading: LoadingState;
  failed: FailedRequests;
}

/**
 * Service for loading and caching tower upgrade images.
 */
class ImageLoaderService {
  private cache: Map<string, string> = new Map();
  private loading: LoadingState = new Map();
  private failed: FailedRequests = new Set();

  private config: CacheConfig = { ...DEFAULT_CONFIG };

  /**
   * Track generated blob URLs so we can revoke them if desired.
   * We do NOT automatically revoke because the UI may still be using the URL.
   */
  private objectUrlsByKey: Map<string, string> = new Map();

  private log(...args: unknown[]) {
    if (this.config.enableDebug) {
      console.log("[ImageLoader]", ...args);
    }
  }

  private warn(...args: unknown[]) {
    if (this.config.enableDebug) {
      console.warn("[ImageLoader]", ...args);
    }
  }

  private canUseCacheApi(): boolean {
    return typeof window !== "undefined" && "caches" in window;
  }

  private isRobloxAssetId(imageIdStr: string): boolean {
    return !imageIdStr.startsWith("http") && /^\d+$/.test(imageIdStr);
  }

  private cacheKeyForAssetId(assetId: string): string {
    return `${this.config.keyPrefix}${assetId}`;
  }

  private metaKeyForAssetId(assetId: string): string {
    return `${this.config.keyPrefix}${assetId}-meta`;
  }

  private async cacheGetFreshBlobUrl(assetId: string): Promise<string | null> {
    if (!this.canUseCacheApi()) return null;

    const cacheKey = this.cacheKeyForAssetId(assetId);
    const metaKey = this.metaKeyForAssetId(assetId);

    try {
      const cache = await caches.open(this.config.cacheName);

      // Validate TTL via stored metadata
      const metaResp = await cache.match(metaKey);
      if (metaResp?.ok) {
        try {
          const meta = (await metaResp.json()) as { storedAt?: number } | null;
          const storedAt = meta?.storedAt ?? 0;
          const age = Date.now() - storedAt;

          if (storedAt > 0 && age > this.config.ttlMs) {
            this.log(`Cache entry expired for ${assetId} (${age}ms old)`);
            await cache.delete(cacheKey);
            await cache.delete(metaKey);
            return null;
          }
        } catch {
          await cache.delete(cacheKey);
          await cache.delete(metaKey);
          return null;
        }
      }

      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse?.ok) {
        const blob = await cachedResponse.blob();
        const objectUrl = URL.createObjectURL(blob);
        this.objectUrlsByKey.set(cacheKey, objectUrl);
        this.log(`Loaded asset ${assetId} from Cache API`);
        return objectUrl;
      }

      return null;
    } catch (err) {
      this.warn("Cache API error (get):", err);
      return null;
    }
  }

  private async cachePutBlob(
    assetId: string,
    response: Response,
  ): Promise<void> {
    if (!this.canUseCacheApi()) return;

    const cacheKey = this.cacheKeyForAssetId(assetId);
    const metaKey = this.metaKeyForAssetId(assetId);

    try {
      const cache = await caches.open(this.config.cacheName);
      await cache.put(cacheKey, response.clone());
      await cache.put(
        metaKey,
        new Response(JSON.stringify({ storedAt: Date.now() }), {
          headers: { "Content-Type": "application/json" },
        }),
      );
      this.log(`Stored asset ${assetId} in Cache API`);
    } catch (err) {
      this.warn(`Failed to cache asset ${assetId}:`, err);
    }
  }

  private requestKey(
    towerName: string,
    index: number,
    imageId: string | number,
  ): string {
    return `${towerName}:${index}:${String(imageId)}`;
  }

  getCachedUrl(
    towerName: string,
    index: number,
    imageId: string | number,
  ): string | undefined {
    return this.cache.get(this.requestKey(towerName, index, imageId));
  }

  isLoading(
    towerName: string,
    index: number,
    imageId: string | number,
  ): boolean {
    return (
      this.loading.get(this.requestKey(towerName, index, imageId)) ?? false
    );
  }

  hasFailed(
    towerName: string,
    index: number,
    imageId: string | number,
  ): boolean {
    return this.failed.has(this.requestKey(towerName, index, imageId));
  }

  /**
   * Clears loading and failed states, useful when switching towers.
   */
  resetState(): void {
    this.loading.clear();
    this.failed.clear();
  }

  /**
   * Clears the in-memory cache entry for a specific upgrade index on a tower.
   * Use when an upgrade's image ID changes so the new image is refetched.
   */
  clearUpgradeImageCache(towerName: string, index: number): void {
    const prefix = `${towerName}:${index}:`;
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
    for (const key of [...this.failed]) {
      if (key.startsWith(prefix)) this.failed.delete(key);
    }
    for (const key of [...this.loading.keys()]) {
      if (key.startsWith(prefix)) this.loading.delete(key);
    }
  }

  /**
   * Clears the entire in-memory image cache for a tower.
   * Use when the tower is reloaded so stale images are refetched.
   */
  clearTowerImageCache(towerName: string): void {
    const prefix = `${towerName}:`;
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
    for (const key of [...this.failed]) {
      if (key.startsWith(prefix)) this.failed.delete(key);
    }
    for (const key of [...this.loading.keys()]) {
      if (key.startsWith(prefix)) this.loading.delete(key);
    }
  }

  /**
   * Enable/disable debug logging for the loader.
   */
  setDebugMode(enabled: boolean): void {
    this.config.enableDebug = enabled;
  }

  /**
   * Configure cache behavior, duh.
   */
  configure(partial: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /**
   * Clears a single cached asset ID entry from the Cache API and revokes any object URL generated for it.
   */
  async clearCacheEntry(imageId: string | number): Promise<void> {
    const imageIdStr = String(imageId);
    if (!this.isRobloxAssetId(imageIdStr)) return;
    if (!this.canUseCacheApi()) return;

    const cacheKey = this.cacheKeyForAssetId(imageIdStr);
    const metaKey = this.metaKeyForAssetId(imageIdStr);

    const maybeUrl = this.objectUrlsByKey.get(cacheKey);
    if (maybeUrl) {
      URL.revokeObjectURL(maybeUrl);
      this.objectUrlsByKey.delete(cacheKey);
    }

    try {
      const cache = await caches.open(this.config.cacheName);
      await cache.delete(cacheKey);
      await cache.delete(metaKey);
      this.log(`Deleted cached asset ${imageIdStr}`);
    } catch (err) {
      this.warn(`Failed to delete cached asset ${imageIdStr}:`, err);
    }
  }

  /**
   * Clears all cached image responses from the Cache API and revokes any object URLs issued by this service.
   */
  async clearAllCache(): Promise<void> {
    if (!this.canUseCacheApi()) return;

    for (const url of this.objectUrlsByKey.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectUrlsByKey.clear();

    try {
      await caches.delete(this.config.cacheName);
      this.log("All cached images deleted successfully");
    } catch (err) {
      this.warn("Failed to clear Cache API:", err);
    }
  }

  /**
   * Loads an image either from a direct URL, a MediaWiki filename, or via Roblox asset delivery.
   * Uses Cache API for Roblox asset IDs by fetching the resolved location and storing the image response.
   *
   * 1) For http(s) URLs we return the URL directly (browser/http cache will handle it).
   * 2) For MediaWiki File: syntax we return the computed hashed upload URL.
   * 3) For Roblox IDs we return a blob URL.
   */
  async loadImage(
    towerName: string,
    index: number,
    imageId: string | number,
  ): Promise<string | null> {
    const requestKey = this.requestKey(towerName, index, imageId);

    const cached = this.cache.get(requestKey);
    if (cached) {
      return cached;
    }

    if (this.loading.get(requestKey) || this.failed.has(requestKey)) {
      return null;
    }

    this.loading.set(requestKey, true);

    try {
      const imageIdStr = String(imageId);

      // Direct URL
      if (typeof imageId === "string" && imageId.startsWith("http")) {
        this.cache.set(requestKey, imageId);
        return imageId;
      }

      // MediaWiki filename
      if (typeof imageId === "string") {
        const mwUrl = resolveWikiFileUrl(imageIdStr);
        if (mwUrl) {
          const proxied = proxyImageUrl(mwUrl);
          this.cache.set(requestKey, proxied);
          return proxied;
        }
      }

      // Roblox asset ID
      if (!this.isRobloxAssetId(imageIdStr)) {
        console.log(
          `Invalid/unsupported imageId for ${towerName} upgrade ${index}: ${imageIdStr}`,
        );
        this.failed.add(requestKey);
        return null;
      }

      const cachedBlobUrl = await this.cacheGetFreshBlobUrl(imageIdStr);
      if (cachedBlobUrl) {
        this.cache.set(requestKey, cachedBlobUrl);
        return cachedBlobUrl;
      }

      const assetId = parseInt(imageIdStr, 10);
      if (isNaN(assetId)) {
        console.log(
          `Invalid asset ID for ${towerName} upgrade ${index}: ${imageIdStr}`,
        );
        this.failed.add(requestKey);
        return null;
      }

      const resolveResponse = await fetch(
        proxyImageUrl(`https://assetdelivery.roblox.com/v2/assetId/${assetId}`),
      );
      const resolveData = await resolveResponse.json();
      const finalUrl: string | null =
        resolveData?.locations?.[0]?.location || null;

      if (!finalUrl) {
        this.failed.add(requestKey);
        return null;
      }

      // Fetch the actual image and cache it
      const imageResponse = await fetch(finalUrl, { mode: "cors" });
      if (!imageResponse.ok) {
        throw new Error(`Image fetch failed: ${imageResponse.status}`);
      }

      await this.cachePutBlob(imageIdStr, imageResponse);

      const blob = await imageResponse.blob();
      const objectUrl = URL.createObjectURL(blob);
      this.objectUrlsByKey.set(this.cacheKeyForAssetId(imageIdStr), objectUrl);

      this.cache.set(requestKey, objectUrl);

      return objectUrl;
    } catch (error) {
      console.error(`Failed to fetch image ${index} for ${towerName}:`, error);
      this.failed.add(requestKey);
      return null;
    } finally {
      this.loading.delete(requestKey);
    }
  }

  getLoadingState(): Map<string, boolean> {
    return new Map(this.loading);
  }
}

export const imageLoader = new ImageLoaderService();
