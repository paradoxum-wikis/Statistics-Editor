<script lang="ts">
	import type { Attachment } from "svelte/attachments";
	import { mount, unmount } from "svelte";
	import WikiTemplate from "$lib/wikiTemplates/WikiTemplate.svelte";
	import type { WikiTplSlot } from "$lib/neowtext/render";

	let {
		wiki,
		block,
	}: {
		wiki: { html: string; slots: WikiTplSlot[] };
		block?: boolean;
	} = $props();

	const renderHtml: Attachment<HTMLElement> = (node) => {
		node.innerHTML = wiki.html;
		const apps = [...node.querySelectorAll("[data-wiki-tpl]")].map((el) =>
			mount(WikiTemplate, {
				target: el,
				props: wiki.slots[Number((el as HTMLElement).dataset.wikiTpl)],
			}),
		);
		return () => {
			for (const app of apps) unmount(app);
		};
	};
</script>

{#if block}
	<div {@attach renderHtml}></div>
{:else}
	<span {@attach renderHtml}></span>
{/if}
