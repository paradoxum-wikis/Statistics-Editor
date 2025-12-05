/**
 * Handles loading and caching images for tower upgrades from Roblox asset delivery.
 */
type ImageCache = Map<string, { [key: number]: string }>;
type LoadingState = Map<number, boolean>;
type FailedRequests = Set<string>;

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
   * Loads an image either from a direct URL or via Roblox asset delivery.
   * Handles caching, prevents duplicate requests, and tracks failures.
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
      let url: string | null = null;

      if (typeof imageId === "string" && imageId.startsWith("http")) {
        url = imageId;
      } else {
        const assetId =
          typeof imageId === "string" ? parseInt(imageId, 10) : imageId;

        if (isNaN(assetId)) {
          console.log(
            `Invalid asset ID for ${towerName} upgrade ${index}: ${imageId}`,
          );
          return null;
        }

        const robloxUrl = `https://assetdelivery.roblox.com/v2/assetId/${assetId}`;
        const encodedUrl = encodeURIComponent(robloxUrl);

        const response = await fetch(
          `https://api.tds-editor.com/?url=${encodedUrl}`,
        );
        const data = await response.json();
        url = data.locations?.[0]?.location || null;
      }

      if (url) {
        const existing = this.cache.get(towerName) || {};
        existing[index] = url;
        this.cache.set(towerName, existing);
        return url;
      } else {
        this.failed.add(requestKey);
        return null;
      }
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

// Export singleton instance
export const imageLoader = new ImageLoaderService();
