import {
  WORKSHOP_TAG_FEATURED,
  type WorkshopListing,
} from "$lib/services/workshop";

export function isAdminUser(
  user: { fandom_userid: number } | null | undefined,
) {
  return !!user && user.fandom_userid === 36243163; // mercb's adminFandomUserID
}

export type AdminListing = WorkshopListing & { published: boolean };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://tds.wiki${path}`, {
    credentials: "include",
    ...init,
  });
  if (!res.ok) {
    const text = (await res.text()).trim();
    if (text.startsWith("{")) {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) throw new Error(j.error);
    }
    throw new Error(text || `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function listAdminWorkshop(
  params: {
    q?: string;
    status?: "all" | "published" | "hidden";
    page?: number;
  } = {},
) {
  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const q = qs.toString();
  return api<{
    items: AdminListing[];
    total: number;
    page: number;
    page_size: number;
  }>(`/aapi/admin/workshop${q ? `?${q}` : ""}`);
}

export function patchAdminListing(
  id: string,
  body: { published?: boolean; featured?: boolean },
) {
  return api<void>(`/aapi/admin/workshop/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function hardDeleteAdminListing(id: string) {
  return api<void>(`/aapi/admin/workshop/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function listingIsFeatured(item: { tags: string[] }) {
  return item.tags.includes(WORKSHOP_TAG_FEATURED);
}
