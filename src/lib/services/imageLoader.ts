/**
 * Handles loading and caching images for tower upgrades from Roblox asset delivery.
 *
 * This service has two layers of caching:
 * 1) In-memory per tower/index (fast UI updates while one browses)
 * 2) Persistent Cache API for Roblox asset IDs (survives reloads)
 * This was ported from the old Statistics Editor
 */
type ImageCache = Map<string, { [key: number]: string }>;
type LoadingState = Map<number, boolean>;
type FailedRequests = Set<string>;

type CacheConfig = {
  cacheName: string;
  keyPrefix: string;
  enableDebug: boolean;
  /**
   * How long to keep an entry in the Cache API (ms). When exceeded, it will be re-fetched.
   * Because Cache API doesn't enforce TTLs so we store metadata to implement this ourselves.
   */
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
  private cache: ImageCache = new Map();
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
          // If metadata is corrupt, treat as a miss and just refetch
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

  getCachedImages(towerName: string): { [key: number]: string } | undefined {
    return this.cache.get(towerName);
  }

  isLoading(index: number): boolean {
    return this.loading.get(index) ?? false;
  }

  hasFailed(towerName: string, index: number): boolean {
    return this.failed.has(`${towerName}:${index}`);
  }

  /**
   * Clears loading and failed states, useful when switching towers.
   */
  resetState(): void {
    this.loading.clear();
    this.failed.clear();
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

    // Revoke any outstanding blob URLs we created.
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
   * Loads an image either from a direct URL or via Roblox asset delivery.
   * Uses Cache API for Roblox asset IDs by fetching the resolved location and storing the image response.
   *
   * 1) For http(s) URLs we return the URL directly (browser/http cache will handle it).
   * 2) For Roblox IDs we return a blob URL so the image is displayable without CORS issues.
   */
  async loadImage(
    towerName: string,
    index: number,
    imageId: string | number,
  ): Promise<string | null> {
    const requestKey = `${towerName}:${index}`;

    const cached = this.cache.get(towerName);
    if (cached?.[index]) {
      return cached[index];
    }

    if (this.loading.get(index) || this.failed.has(requestKey)) {
      return null;
    }

    this.loading.set(index, true);

    try {
      const imageIdStr = String(imageId);

      // Direct URL
      if (typeof imageId === "string" && imageId.startsWith("http")) {
        const existing = this.cache.get(towerName) || {};
        existing[index] = imageId;
        this.cache.set(towerName, existing);
        return imageId;
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
        const existing = this.cache.get(towerName) || {};
        existing[index] = cachedBlobUrl;
        this.cache.set(towerName, existing);
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

      const robloxUrl = `https://assetdelivery.roblox.com/v2/assetId/${assetId}`;
      const encodedUrl = encodeURIComponent(robloxUrl);

      const resolveResponse = await fetch(
        `https://api.tds-editor.com/?url=${encodedUrl}`,
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

      const existing = this.cache.get(towerName) || {};
      existing[index] = objectUrl;
      this.cache.set(towerName, existing);

      return objectUrl;
    } catch (error) {
      console.error(`Failed to fetch image ${index} for ${towerName}:`, error);
      this.failed.add(requestKey);
      return null;
    } finally {
      this.loading.set(index, false);
    }
  }

  getLoadingState(): Map<number, boolean> {
    return new Map(this.loading);
  }
}

export const imageLoader = new ImageLoaderService();
