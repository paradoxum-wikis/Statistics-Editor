export type Announcement = {
  title: string;
  date: string;
  description: string;
  link: string;
  legacy?: boolean;
};

const ANNOUNCE_URL = "https://bin.t7ru.link/fol/tdseannounce.json";
const SEEN_KEY = "tdse_announce_seen";

export function announcementId(item: Announcement): string {
  return item.link;
}

export function getSeenAnnouncementId(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(SEEN_KEY);
}

export function setSeenAnnouncementId(id: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(SEEN_KEY, id);
}

export function latestAnnouncement(
  items: Announcement[],
): Announcement | undefined {
  return items.find((item) => !item.legacy) ?? items[0];
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const res = await fetch(ANNOUNCE_URL);
  if (!res.ok) throw new Error(`Announcements ${res.status}`);
  return res.json();
}

export function formatAnnouncementDate(raw: string): string {
  const m = String(raw).trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  const d = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
