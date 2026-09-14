<script lang="ts">
	import { Popover } from "bits-ui";
	import { BookOpenText, Inbox, LogOut } from "@lucide/svelte";
	import { authStore } from "$lib/stores/auth.svelte";
	import { inboxStore } from "$lib/stores/inbox.svelte";
	import { wikiUserPage, formatProfileStats } from "$lib/services/wikiAuth";
	import Alert from "./Alert.svelte";
	import Modal from "./Modal.svelte";
	import Separator from "./Separator.svelte";
	import avatarPlaceholder from "$lib/assets/Avatar.png";
	import { toast } from "$lib/toast";

	const avatarBtn =
		"relative inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted transition-colors hover:bg-muted/80";

	let accountOpen = $state(false);
	let logoutOpen = $state(false);
	let loginOpen = $state(false);

	const avatarSrc = $derived(authStore.user?.avatar || avatarPlaceholder);

	function requestLogin() {
		loginOpen = false;
		authStore.login();
	}

	function requestLogout() {
		accountOpen = false;
		logoutOpen = true;
	}

	async function confirmLogout() {
		logoutOpen = false;
		await authStore.logout();
		if (authStore.error) {
			toast.error(authStore.error);
			return;
		}
		toast.success("Signed out.");
		inboxStore.reset();
	}

	function openInbox() {
		accountOpen = false;
		inboxStore.openInbox();
	}
</script>

{#snippet avatarImg()}
	<img
		src={avatarSrc}
		alt={authStore.user?.fandom_username ?? ""}
		class="size-full rounded-full object-cover"
	/>
{/snippet}

{#if authStore.user}
	{@const user = authStore.user}
	<Popover.Root bind:open={accountOpen}>
		<Popover.Trigger
			class={avatarBtn}
			aria-label={inboxStore.unread ? "Account, unread inbox" : "Account"}
		>
			{@render avatarImg()}
			{#if inboxStore.unread}
				<span class="status-dot abs" aria-hidden="true"></span>
			{/if}
		</Popover.Trigger>
		<Popover.Portal>
			<Popover.Content
				class="dropdown-content w-auto! min-w-42"
				align="end"
				sideOffset={6}
			>
				<h4 class="mb-1 px-2 pt-1 text-sm font-medium">
					{user.fandom_username}
				</h4>
				<p class="mb-1 px-2 text-xs text-muted-foreground">
					{formatProfileStats(user)}
				</p>
				<Separator class="my-2" />
				<div class="grid gap-0.5">
					<a
						class="dropdown-item"
						href={wikiUserPage(user.fandom_username)}
						target="_blank"
						rel="noopener noreferrer"
					>
						<BookOpenText />
						<span>Wiki profile</span>
					</a>
					<button type="button" class="dropdown-item" onclick={openInbox}>
						<Inbox />
						<span>Inbox</span>
						{#if inboxStore.unread}
							<span class="status-dot ms-auto" aria-hidden="true"></span>
						{/if}
					</button>
					<button type="button" class="dropdown-item" onclick={requestLogout}>
						<LogOut />
						<span>Sign out</span>
					</button>
				</div>
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>

	{#snippet logoutBody()}
		Sign out of your wiki account
		<span class="font-bold">{user.fandom_username}</span>? You can sign back in
		anytime with the wiki.
	{/snippet}

	<Alert
		bind:open={logoutOpen}
		title="Sign out?"
		body={logoutBody}
		confirmLabel="Let me out!"
		confirmClass="btn destructive-fill text-white"
		onConfirm={confirmLogout}
	/>
{:else}
	<Modal
		bind:open={loginOpen}
		title="Sign in with the Wiki"
		description="Authorize the Statistics Editor with your Tower Defense Simulator Wiki account."
		class="max-w-md"
		onOpenChange={(next) => {
			if (!next) authStore.error = null;
		}}
	>
		{#snippet trigger({ props })}
			<button
				type="button"
				class={avatarBtn}
				aria-label="Sign in with your wiki account"
				{...props}
			>
				{@render avatarImg()}
			</button>
		{/snippet}

		<div class="space-y-3 text-sm">
			<p>
				You'll be sent to <span class="font-medium">tds.wiki</span> to approve access,
				then brought right back here.
			</p>
			<ul class="list-disc space-y-1 ps-5 text-muted-foreground">
				<li>Publish towers to the Workshop</li>
				<li>Upvote and comment on people's creations</li>
				<li>Own the share links you create</li>
				<li>And more..!</li>
			</ul>
			<p class="text-xs text-muted-foreground">
				The editor only receives your wiki username and ID, never sensitive info
				such as passwords. You can revoke access anytime from your wiki
				preferences.
			</p>
		</div>

		{#if authStore.error}
			<p class="mt-3 text-sm text-destructive">{authStore.error}</p>
		{/if}

		{#snippet footer()}
			<div class="mt-4 flex justify-end gap-2">
				<button
					type="button"
					class="btn outline"
					onclick={() => (loginOpen = false)}
				>
					Cancel
				</button>
				<button type="button" class="btn primary" onclick={requestLogin}>
					Continue
				</button>
			</div>
		{/snippet}
	</Modal>
{/if}

<style>
	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: var(--radius-full);
		background: var(--destructive);
		pointer-events: none;

		&.abs {
			position: absolute;
			top: 1px;
			right: 1px;
			z-index: 7;
		}
	}
</style>
