<script lang="ts">
	import { ChevronDown, ChevronRight } from '@lucide/svelte';
	import { modelsStore } from '$lib/stores/models.svelte';
	import { ModelsSelectorOption } from '$lib/components/app';
	import type { OrgGroupUnified, ModelItem } from './utils';
import { resolveOrgName } from './utils';

	interface Props {
		groups: OrgGroupUnified[];
		currentModel: string | null;
		activeId: string | null;
		sectionHeaderClass?: string;
		onSelect: (modelId: string) => void;
		onInfoClick: (modelName: string) => void;
		expandedOrgs?: Set<string>;
		onOrgToggle?: (orgName: string) => void;
		renderOption?: import('svelte').Snippet<[ModelItem, boolean]>;
	}

	let {
		groups,
		currentModel,
		activeId,
		sectionHeaderClass = 'my-1 px-2 py-2 text-[13px] font-semibold text-muted-foreground/70 select-none',
		onSelect,
		onInfoClick,
		expandedOrgs,
		onOrgToggle,
		renderOption
	}: Props = $props();
	let render = $derived(renderOption ?? defaultOption);

	function handleOrgClick(orgName: string) {
		onOrgToggle?.(orgName);
	}

	function isOrgExpanded(orgName: string): boolean {
		return expandedOrgs?.has(orgName) ?? false;
	}

	// Get the org key used for tracking (null orgs use a sentinel)
	function orgKey(group: OrgGroupUnified): string {
		return group.orgName ?? '__none__';
	}

	// Determine the org key of the currently selected model
	// Uses the same resolveOrgName logic as grouping to ensure consistent matching
	const selectedOrgKey = $derived.by(() => {
		const allOptions = groups.flatMap((g) => g.items);
		const selected = allOptions.find(
			(item) => item.option.model === currentModel || item.option.id === activeId
		);
		if (!selected) return null;
		const orgName = resolveOrgName(selected.option);
		return orgName?.toLowerCase() ?? '__none__';
	});

	function isCurrentOrgGroup(group: OrgGroupUnified): boolean {
		const key = orgKey(group);
		return selectedOrgKey !== null && key === selectedOrgKey;
	}
</script>

{#snippet defaultOption(item: ModelItem, hideOrgName: boolean)}
	{@const { option } = item}
	{@const isSelected = currentModel === option.model || activeId === option.id}
	{@const isFav = modelsStore.favoriteModelIds.has(option.model)}

	<ModelsSelectorOption
		{option}
		{isSelected}
		isHighlighted={false}
		{isFav}
		{hideOrgName}
		{onSelect}
		{onInfoClick}
		onMouseEnter={() => {}}
		onKeyDown={() => {}}
	/>
{/snippet}

{#each groups as group (orgKey(group))}
	{#if group.orgName}
		{@const key = orgKey(group)}
		{@const isCurrentOrg = isCurrentOrgGroup(group)}
		{@const orgTextClass = isCurrentOrg ? 'text-primary' : 'text-muted-foreground/70'}
		{@const orgCounterClass = isCurrentOrg ? 'text-primary/70' : 'text-muted-foreground/50'}
		<button
			type="button"
			class={[
				'flex w-full cursor-pointer items-center gap-1.5 rounded-sm px-2 py-2 text-left transition [&:not(:first-child)]:mt-1',
				isCurrentOrg
					? 'bg-primary/10 hover:bg-primary/15'
					: isOrgExpanded(key)
						? 'bg-muted/30'
						: 'hover:bg-muted/50'
			]}
			onclick={() => handleOrgClick(key)}
		>
			{#if onOrgToggle}
				{#if isOrgExpanded(key)}
					<ChevronDown class={['h-3.5 w-3.5 shrink-0', isCurrentOrg ? 'text-primary' : 'text-muted-foreground']} />
				{:else}
					<ChevronRight class={['h-3.5 w-3.5 shrink-0', isCurrentOrg ? 'text-primary' : 'text-muted-foreground']} />
				{/if}
			{/if}
			<span class={['min-w-0 flex-1 truncate text-[12px] font-semibold', orgTextClass]}>
				{group.orgName}
			</span>
			<div class={['flex shrink-0 items-center gap-1 text-[10px]', orgCounterClass]}>
				{#if group.loadedCount > 0}
					<span class="rounded-sm bg-green-500/10 px-1 py-0.5 text-green-500">
						{group.loadedCount}
					</span>
				{/if}
				{#if group.favCount > 0}
					<span class="rounded-sm bg-amber-500/10 px-1 py-0.5 text-amber-500">
						{group.favCount}
					</span>
				{/if}
				<span>{group.items.length}</span>
			</div>
		</button>
		{#if isOrgExpanded(key)}
			{#each group.items as item (item.option.id)}
				{@render render(item, false)}
			{/each}
		{/if}
	{:else}
		{#each group.items as item (item.option.id)}
			{@render render(item, true)}
		{/each}
	{/if}
{/each}
