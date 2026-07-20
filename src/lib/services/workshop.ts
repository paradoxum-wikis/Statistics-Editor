export const WORKSHOP_TAGS = ["rework", "rebalance", "new"] as const;
export type WorkshopTag = (typeof WORKSHOP_TAGS)[number];
export const WORKSHOP_TAG_FEATURED = "featured" as const;
export type WorkshopListingTag = WorkshopTag | typeof WORKSHOP_TAG_FEATURED;

export type WorkshopAuthor = {
  fandom_userid: number;
  fandom_username: string;
};

export type WorkshopListing = {
  id: string;
  share_id: string;
  title: string;
  description: string;
  tags: WorkshopListingTag[];
  image?: string;
  tower_name: string;
  views: number;
  votes: number;
  voted: boolean;
  author: WorkshopAuthor;
  mine: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkshopComment = {
  id: string;
  body: string;
  author: WorkshopAuthor;
  mine: boolean;
  created_at: string;
};

export type WorkshopListParams = {
  q?: string;
  tags?: WorkshopListingTag[];
  sort?: "new" | "views" | "votes";
  page?: number;
  mine?: boolean;
};

export type WorkshopWriteInput = {
  share_id: string;
  title: string;
  description: string;
  tags: WorkshopTag[];
  image?: string;
};

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

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function listWorkshop(params: WorkshopListParams = {}) {
  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.tags) for (const t of params.tags) qs.append("tag", t);
  if (params.sort === "views" || params.sort === "votes") {
    qs.set("sort", params.sort);
  }
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  if (params.mine) qs.set("mine", "1");
  const q = qs.toString();
  return api<{
    items: WorkshopListing[];
    total: number;
    page: number;
    page_size: number;
  }>(`/aapi/workshop${q ? `?${q}` : ""}`);
}

export function getWorkshopListing(id: string) {
  return api<WorkshopListing>(`/aapi/workshop/${encodeURIComponent(id)}`);
}

export function createWorkshopListing(input: WorkshopWriteInput) {
  return api<WorkshopListing>("/aapi/workshop", json("POST", input));
}

export function updateWorkshopListing(
  id: string,
  patch: Partial<WorkshopWriteInput>,
) {
  return api<WorkshopListing>(
    `/aapi/workshop/${encodeURIComponent(id)}`,
    json("PATCH", patch),
  );
}

export function deleteWorkshopListing(id: string) {
  return api<void>(`/aapi/workshop/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function toggleWorkshopVote(id: string) {
  return api<{ votes: number; voted: boolean }>(
    `/aapi/workshop/${encodeURIComponent(id)}/vote`,
    { method: "POST" },
  );
}

export function listWorkshopComments(id: string) {
  return api<{ items: WorkshopComment[] }>(
    `/aapi/workshop/${encodeURIComponent(id)}/comments`,
  );
}

export function createWorkshopComment(id: string, body: string) {
  return api<WorkshopComment>(
    `/aapi/workshop/${encodeURIComponent(id)}/comments`,
    json("POST", { body }),
  );
}

export function deleteWorkshopComment(listingId: string, commentId: string) {
  return api<void>(
    `/aapi/workshop/${encodeURIComponent(listingId)}/comments/${encodeURIComponent(commentId)}`,
    { method: "DELETE" },
  );
}
