<script lang="ts">
	import { afterNavigate, goto } from "$app/navigation";
	import { resolve } from "$app/paths";
	import { page } from "$app/state";
	import { bootstrap } from "#lib/bootstrap.js";
	import { towerStore } from "#lib/stores/tower.svelte.js";
	import { parseShareRef } from "#lib/services/shareTower.js";
	import { analytics } from "#lib/services/analytics.js";

	async function syncTowerFromRoute() {
		await bootstrap();
		const name = page.params.name;
		if (!name) return;

		const shareParam = page.url.searchParams.get("share");
		const shareId = shareParam ? parseShareRef(shareParam) : null;
		const sameTower =
			towerStore.selectedName.toLowerCase() === name.trim().toLowerCase();

		if (shareId) {
			if (towerStore.sharePreviewId === shareId && sameTower) {
				return;
			}
			try {
				const ok = await towerStore.importFromShare(shareId);
				if (!ok) {
					analytics.track("share_import", {
						tower_name: shareId,
						success: false,
					});
					alert("Failed to import shared tower.");
					await goto(resolve("/"), {
						replace: true,
						reset: false,
					});
					return;
				}
				const imported = towerStore.selectedName;
				if (imported.toLowerCase() !== name.trim().toLowerCase()) {
					await goto(
						resolve(`/tower/[name]?share=${encodeURIComponent(shareId)}`, {
							name: imported,
						}),
						{ replace: true, reset: false },
					);
				}
				return;
			} catch (e) {
				analytics.track("share_import", {
					tower_name: shareId,
					success: false,
				});
				alert(
					e instanceof Error ? e.message : "Failed to import shared tower.",
				);
				await goto(resolve("/"), {
					replace: true,
					reset: false,
				});
				return;
			}
		}

		// load() clears sharePreviewId
		// hence keep an active share snapshot
		if (towerStore.sharePreviewId && sameTower) return;
		await towerStore.load(name);
	}

	afterNavigate(({ shallow, type }) => {
		if (shallow && type === "goto") return;

		void syncTowerFromRoute();
	});
</script>
