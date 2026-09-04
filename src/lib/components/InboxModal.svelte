<script lang="ts">
	import { resolve } from "$app/paths";
	import { PencilSparkles, ThumbsUp } from "@lucide/svelte";
	import Modal from "$lib/components/smol/Modal.svelte";
	import { inboxStore } from "$lib/stores/inbox.svelte";
	import { timeAgo } from "$lib/utils/workshop";
	import avatarPlaceholder from "$lib/assets/Avatar.png";

	function onOpenItem() {
		inboxStore.open = false;
	}
</script>

<Modal
	bind:open={inboxStore.open}
	title="Inbox"
	class="sm:max-w-lg! max-md:pb-0"
>
	<div class="inbox-list">
		{#if inboxStore.loading && inboxStore.items.length === 0}
			<p class="text-sm text-muted-foreground">Checking comments...</p>
		{:else if inboxStore.items.length === 0}
			<p class="text-sm text-muted-foreground">
				Nothing new here, come back later.
			</p>
		{:else}
			<button
				type="button"
				class="inbox-mark-all"
				onclick={() => void inboxStore.markAllRead()}
			>
				Mark all as read
			</button>
			{#each inboxStore.items as item (item.id)}
				<a
					class="inbox-item"
					href="{resolve('/workshop')}?listing={encodeURIComponent(
						item.listing_id,
					)}"
					onclick={onOpenItem}
				>
					<span class="inbox-avatar">
						{#if item.kind === "comment"}
							<img
								src={inboxStore.avatars.get(item.author.fandom_userid) ??
									avatarPlaceholder}
								alt=""
								class="size-full object-cover"
							/>
						{:else if item.kind === "featured"}
							<PencilSparkles size={14} />
						{:else}
							<ThumbsUp size={14} />
						{/if}
					</span>
					<div class="inbox-item-main">
						<div class="inbox-item-head">
							<span class="inbox-item-title">
								{#if item.kind === "featured"}
									<span class="inbox-item-on">Your</span>
									{item.listing_title}
									<span class="inbox-item-on">was featured</span>
								{:else if item.kind === "likes"}
									{item.count === 1 ? "1 new like" : `${item.count} new likes`}
									<span class="inbox-item-on">on {item.listing_title}</span>
								{:else}
									{item.author.fandom_username}
									<span class="inbox-item-on">on {item.listing_title}</span>
								{/if}
							</span>
							<time class="inbox-item-date" datetime={item.created_at}
								>{timeAgo(item.created_at)}</time
							>
						</div>
						{#if item.kind === "comment"}
							<p class="inbox-item-body line-clamp-2">{item.body}</p>
						{/if}
					</div>
				</a>
			{/each}
		{/if}
	</div>
</Modal>

<style>
	.inbox-list {
		display: flex;
		max-height: min(70dvh, 28rem);
		flex-direction: column;
		gap: 8px;
		overflow-y: auto;
		padding-bottom: 0.75rem;
	}

	.inbox-mark-all {
		align-self: end;
		border: none;
		background: none;
		padding: 0;
		color: var(--muted-foreground);
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;

		&:hover {
			color: var(--foreground);
		}
	}

	.inbox-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--muted);
		padding: 10px 12px;
		color: inherit;
		text-decoration: none;
		transition:
			border-color 0.1s,
			background 0.1s;

		&:hover {
			border-color: var(--border-strong);
			background: var(--secondary);
		}
	}

	.inbox-avatar {
		display: flex;
		width: 1.5rem;
		height: 1.5rem;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		background: var(--muted);
		color: var(--muted-foreground);
	}

	.inbox-item-main {
		min-width: 0;
		flex: 1;
	}

	.inbox-item-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		min-height: 1.5rem;
	}

	.inbox-item-title {
		min-width: 0;
		font-size: 0.875rem;
		font-weight: 700;
		line-height: 1.25;
	}

	.inbox-item-on {
		font-weight: 500;
		color: var(--muted-foreground);
	}

	.inbox-item-date {
		flex-shrink: 0;
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--muted-foreground);
	}

	.inbox-item-body {
		margin-top: 6px;
		font-size: 0.75rem;
		line-height: 1.35;
		color: var(--muted-foreground);
	}
</style>
