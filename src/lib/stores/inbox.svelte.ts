import {
	listInbox,
	markInboxRead,
	markInboxReadAll,
	type InboxItem,
} from "$lib/services/workshop";
import { fetchFandomAvatars } from "$lib/services/fandomAuth";
import { settingsStore } from "$lib/stores/settings.svelte";

class InboxStore {
	items = $state.raw<InboxItem[]>([]);
	avatars = $state.raw(new Map<number, string>());
	unread = $state(0);
	loading = $state(false);
	open = $state(false);

	private seq = 0;

	async refresh() {
		const seq = ++this.seq;
		this.loading = true;
		try {
			const res = await listInbox();
			if (seq !== this.seq) return;
			this.items = res.items;
			this.unread = res.unread;
			void this.fillAvatars(seq, res.items);
		} catch (e) {
			if (seq !== this.seq) return;
			if (settingsStore.debugMode) console.error("[inbox]", e);
			this.items = [];
			this.unread = 0;
		} finally {
			if (seq === this.seq) this.loading = false;
		}
	}

	private async fillAvatars(seq: number, items: InboxItem[]) {
		const ids = items.flatMap((i) =>
			i.kind === "comment" ? [i.author.fandom_userid] : [],
		);
		if (!ids.length) return;
		try {
			const m = await fetchFandomAvatars(ids);
			if (seq !== this.seq) return;
			const next = new Map(this.avatars);
			for (const [id, url] of m) if (url) next.set(id, url);
			this.avatars = next;
		} catch (e) {
			if (settingsStore.debugMode) console.error("[inbox] avatars", e);
		}
	}

	openInbox() {
		this.open = true;
		void this.refresh();
	}

	async markListingRead(listingId: string) {
		const n = this.items.filter((i) => i.listing_id === listingId).length;
		this.items = this.items.filter((i) => i.listing_id !== listingId);
		this.unread -= n;
		try {
			await markInboxRead(listingId);
		} catch (e) {
			if (settingsStore.debugMode) console.error("[inbox] read", e);
			void this.refresh();
		}
	}

	async markAllRead() {
		this.items = [];
		this.unread = 0;
		try {
			await markInboxReadAll();
		} catch (e) {
			if (settingsStore.debugMode) console.error("[inbox] read all", e);
			void this.refresh();
		}
	}

	reset() {
		this.seq++;
		this.items = [];
		this.avatars = new Map();
		this.unread = 0;
		this.loading = false;
		this.open = false;
	}
}

export const inboxStore = new InboxStore();
