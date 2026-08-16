<script lang="ts">
	import { Avatar } from "bits-ui";
	import { CalendarClock, Eye, Pencil, ThumbsUp, Trash2 } from "@lucide/svelte";
	import avatarPlaceholder from "$lib/assets/Avatar.png";
	import { fetchFandomAvatar } from "$lib/services/fandomAuth";
	import { imageLoader } from "$lib/services/imageLoader";
	import { settingsStore } from "$lib/stores/settings.svelte";
	import {
		WORKSHOP_TAG_FEATURED,
		type WorkshopListing,
	} from "$lib/services/workshop";
	import { timeAgo } from "$lib/utils/workshop";
	import IconBtn from "../smol/IconBtn.svelte";
	import Tip from "../smol/Tip.svelte";

	let {
		listing,
		onOpen,
		onEdit,
		onUnpublish,
		compact = false,
	}: {
		listing: WorkshopListing;
		onOpen?: (listing: WorkshopListing) => void;
		onEdit?: (listing: WorkshopListing) => void;
		onUnpublish?: (listing: WorkshopListing) => void;
		compact?: boolean;
	} = $props();

	const featured = $derived(listing.tags.includes(WORKSHOP_TAG_FEATURED));

	let imageUrl = $state<string | null>(null);
	let avatarSrc = $state<string | null>(null);

	$effect(() => {
		const ref = listing.image?.trim();
		if (!ref) {
			imageUrl = null;
			return;
		}
		const cached = imageLoader.getCachedUrl(listing.id, 0, ref);
		if (cached) {
			imageUrl = cached;
			return;
		}
		let cancelled = false;
		imageLoader
			.loadImage(listing.id, 0, ref)
			.then((url) => {
				if (!cancelled) imageUrl = url;
			})
			.catch((e) => {
				if (settingsStore.debugMode) console.error("[workshop] card image", e);
				if (!cancelled) imageUrl = null;
			});
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const userId = listing.author.fandom_userid;
		avatarSrc = null;
		let cancelled = false;
		fetchFandomAvatar(userId)
			.then((url) => {
				if (!cancelled && url) avatarSrc = url;
			})
			.catch((e) => {
				if (settingsStore.debugMode) console.error("[workshop] card avatar", e);
			});
		return () => {
			cancelled = true;
		};
	});
</script>

<article class={["workshop-card", { compact }, { featured }]}>
	<button
		type="button"
		class="card-link"
		aria-label={`Open ${listing.title}`}
		onclick={() => onOpen?.(listing)}
	></button>

	<div class="media">
		{#if imageUrl}
			<img src={imageUrl} alt="" loading="lazy" />
		{:else}
			<enhanced:img src="$lib/assets/PlaceholderWide.png" alt="" />
		{/if}
		<div class="media-shade"></div>

		{#if !compact && listing.tags.length}
			<div
				class="absolute top-2 right-2 flex max-w-[calc(100%-1rem)] flex-wrap justify-end gap-1"
			>
				{#each listing.tags as tag (tag)}
					<span
						class="rounded-full border px-2 py-0.5 text-xs capitalize backdrop-blur-xs {tag ===
						WORKSHOP_TAG_FEATURED
							? 'border-(--tower-exclusive)/50 bg-(--tower-exclusive)/70 font-medium text-white'
							: 'border-border bg-card/70 text-muted-foreground'}">{tag}</span
					>
				{/each}
			</div>
		{/if}
	</div>

	<div class="body">
		<div class="title-row">
			<div>
				<h3>{listing.title}</h3>
				<p class="tower-name">{listing.tower_name}</p>
			</div>

			{#if listing.mine && (onEdit || onUnpublish)}
				<div class="actions">
					{#if onEdit}
						<IconBtn
							class="p-1.5"
							title="Edit"
							aria-label="Edit listing"
							onclick={(e: MouseEvent) => {
								e.stopPropagation();
								onEdit(listing);
							}}
						>
							<Pencil size={14} />
						</IconBtn>
					{/if}
					{#if onUnpublish}
						<IconBtn
							class="p-1.5 text-destructive"
							title="Unpublish"
							aria-label="Unpublish listing"
							onclick={(e: MouseEvent) => {
								e.stopPropagation();
								onUnpublish(listing);
							}}
						>
							<Trash2 size={14} />
						</IconBtn>
					{/if}
				</div>
			{/if}
		</div>

		{#if listing.description}
			<p class="description">{listing.description}</p>
		{/if}

		{#if compact && listing.tags.length}
			<div class="flex flex-wrap gap-1">
				{#each listing.tags as tag (tag)}
					<span
						class="rounded-full border px-1.5 py-0.5 text-[0.65rem] capitalize {tag ===
						WORKSHOP_TAG_FEATURED
							? 'border-(--tower-exclusive)/50 bg-(--tower-exclusive)/70 font-medium text-white'
							: 'border-border bg-muted/70 text-muted-foreground'}">{tag}</span
					>
				{/each}
			</div>
		{/if}

		<div class="meta">
			<span class="author">
				<Avatar.Root>
					<Avatar.Image src={avatarSrc ?? avatarPlaceholder} alt="" />
					<Avatar.Fallback>
						{listing.author.fandom_username.slice(0, 2).toUpperCase()}
					</Avatar.Fallback>
				</Avatar.Root>
				<span>{listing.author.fandom_username}</span>
			</span>

			<span class="stats">
				<Tip content={listing.voted ? "You upvoted this" : "Upvotes"}>
					{#snippet children({ props })}
						<span {...props} class:voted={listing.voted}>
							<ThumbsUp size={12} />
							{listing.votes.toLocaleString()}
						</span>
					{/snippet}
				</Tip>
				<Tip content="Views">
					{#snippet children({ props })}
						<span {...props}>
							<Eye size={12} />
							{listing.views.toLocaleString()}
						</span>
					{/snippet}
				</Tip>
				{#if !compact}
					<Tip
						content={`Updated ${new Date(listing.updated_at).toLocaleString()}`}
					>
						{#snippet children({ props })}
							<span {...props} class="updated">
								<CalendarClock size={12} />
								{timeAgo(listing.updated_at)}
							</span>
						{/snippet}
					</Tip>
				{/if}
			</span>
		</div>
	</div>
</article>

<style>
	.workshop-card {
		position: relative;
		display: flex;
		min-height: 100%;
		flex-direction: column;
		overflow: hidden;
		border: 2px solid var(--border-strong);
		border-radius: calc(var(--radius) * 1.6);
		background: var(--card);
		box-shadow: 0 0.5rem 1.5rem oklch(0 0 0 / 0.08);
		transition: border-color 0.16s ease;

		&.featured {
			border-color: var(--tower-exclusive);

			.body {
				background: color-mix(
					in oklch,
					var(--tower-exclusive) 10%,
					transparent
				);
			}
		}

		&:hover,
		&:focus-within {
			border-color: var(--primary);
		}

		&.featured:hover,
		&.featured:focus-within {
			border-color: var(--tower-exclusive);
		}

		&:focus-within {
			outline: 2px solid color-mix(in oklch, var(--ring) 65%, transparent);
			outline-offset: 2px;
		}

		&.compact {
			min-height: 9.5rem;
			flex-direction: row;

			.media {
				width: 43%;
				min-width: 8rem;
				aspect-ratio: auto;
			}

			.body {
				justify-content: center;
				padding: 0.8rem;
			}

			.description {
				line-clamp: 2;
				-webkit-line-clamp: 2;
			}

			@media (max-width: 520px) {
				min-height: 8.5rem;

				.media {
					min-width: 6.5rem;
				}

				.description,
				.author {
					display: none;
				}
			}
		}
	}

	.card-link {
		position: absolute;
		z-index: 0;
		inset: 0;
		cursor: pointer;
		border: 0;
		background: transparent;
		outline: none;
	}

	.media,
	.body {
		position: relative;
		pointer-events: none;
	}

	.media {
		overflow: hidden;
		background: var(--muted);
		aspect-ratio: 16 / 9;

		img,
		:global(picture),
		:global(picture img) {
			position: absolute;
			width: 100%;
			height: 100%;
			object-fit: cover;
			transition: scale 0.35s ease;
		}

		.workshop-card:hover & img,
		.workshop-card:hover & :global(picture img) {
			scale: 1.025;
		}
	}

	.media-shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			oklch(0 0 0 / 0.08),
			transparent 48%,
			oklch(0 0 0 / 0.32)
		);
	}

	.body {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		gap: 0.55rem;
		padding: 0.9rem 1rem 1rem;
	}

	.title-row {
		display: flex;
		min-width: 0;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;

		> div:first-child {
			min-width: 0;
		}

		h3 {
			overflow: hidden;
			color: var(--foreground);
			font-family: var(--font);
			font-size: 0.92rem;
			font-weight: 800;
			line-height: 1.25;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	.tower-name {
		margin-top: 0.15rem;
		overflow: hidden;
		color: var(--muted-foreground);
		font-size: 0.72rem;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.actions {
		position: relative;
		z-index: 7;
		display: flex;
		flex-shrink: 0;
		gap: 0.15rem;
		pointer-events: auto;
	}

	.description {
		display: -webkit-box;
		overflow: hidden;
		color: var(--muted-foreground);
		font-size: 0.75rem;
		line-height: 1.45;
		-webkit-box-orient: vertical;
		line-clamp: 2;
		-webkit-line-clamp: 2;
	}

	.meta {
		display: flex;
		min-width: 0;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
		margin-top: auto;
		padding-top: 0.25rem;
		color: var(--muted-foreground);
		font-size: 0.66rem;
	}

	.author {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.4rem;

		> span:last-child {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		:global([data-avatar-root]) {
			width: 1.15rem;
			height: 1.15rem;
			flex-shrink: 0;
			overflow: hidden;
			border: 1px solid var(--border);
			border-radius: 50%;
			background: var(--muted);
		}

		:global([data-avatar-image]) {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}

		:global([data-avatar-fallback]) {
			display: flex;
			width: 100%;
			height: 100%;
			align-items: center;
			justify-content: center;
			font-size: 0.5rem;
			font-weight: 700;
		}
	}

	.stats {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.55rem;

		> span {
			display: inline-flex;
			align-items: center;
			gap: 0.2rem;

			&.voted {
				color: var(--primary);
			}
		}
	}

	@media (max-width: 410px) {
		.updated {
			display: none !important;
		}
	}
</style>
