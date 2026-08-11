import {
  announcementId,
  fetchAnnouncements,
  getSeenAnnouncementId,
  latestAnnouncement,
  setSeenAnnouncementId,
  type Announcement,
} from "$lib/services/announcements";
import { toast } from "$lib/toast";

class AnnouncementsStore {
  items = $state.raw<Announcement[]>([]);
  loaded = $state(false);
  open = $state(false);

  async init(): Promise<void> {
    if (this.loaded) return;
    this.items = await fetchAnnouncements();
    this.loaded = true;
    this.maybeToast();
  }

  markSeen(item?: Announcement): void {
    const target = item ?? latestAnnouncement(this.items);
    if (!target) return;
    setSeenAnnouncementId(announcementId(target));
  }

  openList(): void {
    this.open = true;
    this.markSeen();
  }

  private maybeToast(): void {
    const latest = latestAnnouncement(this.items);
    if (!latest) return;
    const id = announcementId(latest);
    if (getSeenAnnouncementId() === id) return;

    toast.info(latest.title, {
      description: latest.description,
      duration: 8000,
      action: {
        label: "View",
        onClick: () => window.open(latest.link, "_blank", "noopener,noreferrer"),
      },
      onDismiss: () => setSeenAnnouncementId(id),
    });
  }
}

export const announcementsStore = new AnnouncementsStore();
