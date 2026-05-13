<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Table from '$lib/components/ui/table';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import {
		BadgesModality,
		ActionIconCopyToClipboard,
		ModelId,
		DropdownMenuSearchable,
		ModelsSelectorList,
		ModelsSelectorOption
	} from '$lib/components/app';
	import { serverStore } from '$lib/stores/server.svelte';
	import { modelsStore, modelOptions, modelsLoading } from '$lib/stores/models.svelte';
	import { formatFileSize, formatParameters, formatNumber } from '$lib/utils';
	import { PropsService, ModelsService } from '$lib/services';
	import type { ApiLlamaCppServerProps, ModelOption } from '$lib/types';
	import { Package, ChevronDown, ChevronRight } from '@lucide/svelte';
	import { KeyboardKey } from '$lib/enums';
	import { filterModelOptions, groupAllByOrg, type OrgGroupUnified, type ModelItem } from '$lib/components/app/models/utils';
	import { extractOrgName } from '$lib/utils/thinking-params';
	import { SvelteSet } from 'svelte/reactivity';

	interface Props {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		// when set, fetch props from the child process (router mode)
		modelId?: string | null;
	}

	let { open = $bindable(), onOpenChange, modelId = null }: Props = $props();

	let isRouter = $derived(serverStore.isRouterMode);

	// per-model props fetched from the child process
	let routerModelProps = $state<ApiLlamaCppServerProps | null>(null);
	let isLoadingRouterProps = $state(false);

	// local model name state — starts from modelId prop but can be changed via the switcher
	let activeModelName = $state<string | null>(null);

	// props fetched for the currently displayed model (both router and non-router modes)
	let displayedModelProps = $state<ApiLlamaCppServerProps | null>(null);

	// Use props from the selected model when available, otherwise fall back to global server props
	let serverProps = $derived(
		displayedModelProps ?? (isRouter && activeModelName ? routerModelProps : serverStore.props)
	);

	let currentModelName = $derived(
		(activeModelName ?? modelsStore.selectedModelName ?? (isRouter && modelId ? modelId : modelsStore.singleModelName)) || ''
	);

	// Org name of the currently selected model — used to highlight matching group header
	// Uses extractOrgName for consistency with groupAllByOrg (supports both org/model and dash formats)
	// Returns lowercase to match the grouping key used by groupAllByOrg
	let selectedModelOrgName = $derived(
		currentModelName ? (extractOrgName(currentModelName)?.toLowerCase() ?? null) : null
	);
	let models = $derived(modelOptions());
	let isLoadingModels = $derived(modelsLoading());

	// Find the model option matching the displayed model name
	// Non-router mode: use selected model if set, otherwise first model
	// Router mode: use activeModelName
	let firstModel = $derived.by(() => {
		if (isRouter && activeModelName) {
			return models.find((m) => m.model === activeModelName) ?? null;
		}
		// Non-router: prefer the user's selected model
		const nameToMatch = activeModelName ?? modelsStore.selectedModelName;
		if (nameToMatch) {
			return models.find((m) => m.model === nameToMatch) ?? null;
		}
		return models[0] ?? null;
	});

	// Get modalities from modelStore using the model ID from the first model
	let modalities = $derived.by(() => {
		if (!firstModel?.id) return [];
		return modelsStore.getModelModalitiesArray(firstModel.id);
	});

	// Model switcher dropdown state
	let isSwitcherOpen = $state(false);
	let switcherSearchTerm = $state('');
	let switcherHighlightedIndex = $state(-1);
	const switcherExpandedOrgs = new SvelteSet<string>();

	// Include all models except those explicitly hidden (webui === false)
	// Models without cached props are included (default to visible)
	const switcherOptions = $derived(
		models.filter((m) => {
			const props = modelsStore.getModelProps(m.model);
			return props === null || props.webui !== false;
		})
	);

	const filteredSwitcherOptions = $derived(
		filterModelOptions(switcherOptions, switcherSearchTerm)
	);

	const groupedSwitcherOptions = $derived(
		groupAllByOrg(filteredSwitcherOptions, modelsStore.favoriteModelIds, (m) =>
			modelsStore.isModelLoaded(m)
		)
	);

	// Build visible items for keyboard navigation
	type SwitcherVisibleItem =
		| { type: 'model'; item: ModelItem }
		| { type: 'org-header'; group: OrgGroupUnified };

	const switcherVisibleItems = $derived.by(() => {
		const items: SwitcherVisibleItem[] = [];
		for (const group of groupedSwitcherOptions) {
			if (group.orgName) {
				items.push({ type: 'org-header', group });
				if (switcherExpandedOrgs.has(group.orgName)) {
					for (const item of group.items) {
						items.push({ type: 'model', item });
					}
				}
			} else {
				for (const item of group.items) {
					items.push({ type: 'model', item });
				}
			}
		}
		return items;
	});

	const switcherHighlightedOptionId = $derived.by(() => {
		if (switcherHighlightedIndex < 0 || switcherHighlightedIndex >= switcherVisibleItems.length) return null;
		const v = switcherVisibleItems[switcherHighlightedIndex];
		return v.type === 'model' ? v.item.option.id : null;
	});

	// Ensure models are fetched and activeModelName is synced when dialog opens
	$effect(() => {
		if (open) {
			if (models.length === 0) {
				modelsStore.fetch();
			}
			if (isRouter) {
				modelsStore.fetchRouterModels();
			}
			activeModelName = isRouter && modelId ? modelId : (modelsStore.selectedModelName ?? null);
		} else {
			activeModelName = null;
		}
	});

	// fetch per-model props when the displayed model changes
	// Uses the store's fetchModelProps with forceRefresh to ensure
	// we always get fresh data for the displayed model in the dialog.
	$effect(() => {
		const nameToFetch = activeModelName ?? (isRouter && modelId ? modelId : null);

		if (open && nameToFetch) {
			isLoadingRouterProps = true;
			modelsStore.fetchModelProps(nameToFetch, true)
				.then((props) => {
					if (isRouter) {
						routerModelProps = props;
					} else {
						displayedModelProps = props;
					}
				})
				.catch(() => {
					if (isRouter) {
						routerModelProps = null;
					} else {
						displayedModelProps = null;
					}
				})
				.finally(() => {
					isLoadingRouterProps = false;
				});
			if (isRouter) {
				displayedModelProps = null;
			} else {
				routerModelProps = null;
			}
		}

		if (!open) {
			routerModelProps = null;
			displayedModelProps = null;
		}
	});

	// Reset switcher state when dropdown opens/closes
	$effect(() => {
		if (!isSwitcherOpen) {
			switcherSearchTerm = '';
			switcherHighlightedIndex = -1;
			switcherExpandedOrgs.clear();
		}
	});

	async function handleSwitcherSelect(m: ModelOption) {
		await modelsStore.selectModelById(m.id);
		activeModelName = m.model;
		isSwitcherOpen = false;
	}

	function handleSwitcherKeyDown(event: KeyboardEvent) {
		if (event.isComposing) return;

		if (event.key === KeyboardKey.ARROW_DOWN) {
			event.preventDefault();
			if (switcherVisibleItems.length === 0) return;
			if (switcherHighlightedIndex === -1 || switcherHighlightedIndex === switcherVisibleItems.length - 1) {
				switcherHighlightedIndex = 0;
			} else {
				switcherHighlightedIndex += 1;
			}
		} else if (event.key === KeyboardKey.ARROW_UP) {
			event.preventDefault();
			if (switcherVisibleItems.length === 0) return;
			if (switcherHighlightedIndex === -1 || switcherHighlightedIndex === 0) {
				switcherHighlightedIndex = switcherVisibleItems.length - 1;
			} else {
				switcherHighlightedIndex -= 1;
			}
		} else if (event.key === KeyboardKey.ENTER) {
			event.preventDefault();
			if (switcherHighlightedIndex >= 0 && switcherHighlightedIndex < switcherVisibleItems.length) {
				const item = switcherVisibleItems[switcherHighlightedIndex];
				if (item.type === 'org-header' && item.group.orgName) {
					// Toggle org expand/collapse
					if (switcherExpandedOrgs.has(item.group.orgName)) {
						switcherExpandedOrgs.delete(item.group.orgName);
					} else {
						switcherExpandedOrgs.add(item.group.orgName);
					}
				} else if (item.type === 'model') {
					handleSwitcherSelect(item.item.option);
				}
			} else if (switcherVisibleItems.length > 0) {
				// Find first model item
				const firstModel = switcherVisibleItems.findIndex((v) => v.type === 'model');
				if (firstModel >= 0) {
					switcherHighlightedIndex = firstModel;
				}
			}
		}
	}
</script>

<Dialog.Root bind:open {onOpenChange}>
	<Dialog.Content class="@container z-9999 !max-h-[80dvh] !max-w-[60rem] max-w-full">
		<style>
			@container (max-width: 56rem) {
				.resizable-text-container {
					max-width: calc(100vw - var(--threshold));
				}
			}
		</style>

		<Dialog.Header>
			<div class="flex items-center justify-between">
				<Dialog.Title>Model Information</Dialog.Title>

				{#if switcherOptions.length > 0}
					<DropdownMenu.Root bind:open={isSwitcherOpen}>
						<DropdownMenu.Trigger
							class="inline-flex items-center gap-1.5 rounded-md border bg-transparent px-2 py-1 text-sm font-medium hover:bg-accent"
							onkeydown={handleSwitcherKeyDown}
						>
							<Package class="h-4 w-4" />
							<span class="max-w-[12rem] truncate">{currentModelName}</span>
							<ChevronDown class="h-3.5 w-3.5 opacity-60" />
						</DropdownMenu.Trigger>

						<DropdownMenu.Content
							class="p-0 z-[10000]"
							side="bottom"
							align="end"
							onInteractOutside={(e) => {
								// Prevent closing when clicking on org header buttons
								const target = e.target as Element | null;
								if (target?.closest('[data-org-header]')) {
									e.preventDefault();
								}
							}}
						>
							<DropdownMenuSearchable
								searchValue={switcherSearchTerm}
								onSearchChange={(v) => switcherSearchTerm = v}
								onSearchKeyDown={handleSwitcherKeyDown}
								placeholder="Search models..."
								emptyMessage="No models found."
							>
								{#snippet children()}
									<div class="py-1">
										{#each groupedSwitcherOptions as group}
											{#if group.orgName}
												{@const orgName = group.orgName}
												{@const isExpanded = switcherExpandedOrgs.has(orgName)}
												{@const is_selected_org = orgName === selectedModelOrgName}
												{@const btnBaseClass = is_selected_org
													? 'bg-primary/10 hover:bg-primary/15'
													: isExpanded
														? 'bg-muted/30 hover:bg-muted/50'
														: 'hover:bg-muted/50'}
												{@const textClass = is_selected_org ? 'text-primary' : (isExpanded ? 'text-foreground' : 'text-muted-foreground/70')}
												{@const chevronClass = is_selected_org ? 'text-primary' : 'text-muted-foreground'}
												{@const counterClass = is_selected_org ? 'text-primary/70' : 'text-muted-foreground/50'}
												<button
													type="button"
													data-org-header
													class={["flex w-full cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-sm transition", btnBaseClass]}
													onclick={(e: MouseEvent) => {
														e.preventDefault();
														e.stopPropagation();
														if (isExpanded) {
															switcherExpandedOrgs.delete(orgName);
														} else {
															switcherExpandedOrgs.add(orgName);
														}
													}}
													onpointerdown={(e: PointerEvent) => e.stopPropagation()}
												>
													{#if isExpanded}
														<ChevronDown class={["h-3.5 w-3.5 shrink-0", chevronClass]} />
													{:else}
														<ChevronRight class={["h-3.5 w-3.5 shrink-0", chevronClass]} />
													{/if}
													<span
														class={["min-w-0 flex-1 truncate text-xs font-semibold", textClass]}
													>
														{orgName}
													</span>
													<div
														class={["flex shrink-0 items-center gap-1 text-[10px]", counterClass]}
													>
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
												{#if switcherExpandedOrgs.has(orgName)}
													{#each group.items as item}
														<DropdownMenu.Item
															class="cursor-pointer pl-6"
															onclick={() => handleSwitcherSelect(item.option)}
														>
															<span class="truncate">{item.option.name || item.option.model}</span>
														</DropdownMenu.Item>
													{/each}
												{/if}
											{:else}
												{#each group.items as item}
													<DropdownMenu.Item
														class="cursor-pointer"
														onclick={() => handleSwitcherSelect(item.option)}
													>
														<span class="truncate">{item.option.name || item.option.model}</span>
													</DropdownMenu.Item>
												{/each}
											{/if}
										{/each}
									</div>
								{/snippet}
							</DropdownMenuSearchable>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				{/if}
			</div>

			<Dialog.Description>Current model details and capabilities</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-6 py-4">
			{#if isLoadingModels || isLoadingRouterProps}
				<div class="flex items-center justify-center py-8">
					<div class="text-sm text-muted-foreground">Loading model information...</div>
				</div>
			{:else if firstModel}
				{@const modelMeta = firstModel.meta}

				{#if serverProps}
					<Table.Root>
						<Table.Body>
							<!-- Model Path -->
							<Table.Row>
								<Table.Cell class="h-10 align-middle font-medium">File Path</Table.Cell>

								<Table.Cell
									class="inline-flex h-10 items-center gap-2 align-middle font-mono text-xs"
								>
									<span
										class="resizable-text-container min-w-0 flex-1 truncate"
										style:--threshold="14rem"
									>
										{serverProps.model_path}
									</span>

									<ActionIconCopyToClipboard
										text={serverProps.model_path}
										ariaLabel="Copy model path to clipboard"
									/>
								</Table.Cell>
							</Table.Row>

							<!-- Context Size -->
							{#if serverProps?.default_generation_settings?.n_ctx}
								<Table.Row>
									<Table.Cell class="h-10 align-middle font-medium">Context Size</Table.Cell>

									<Table.Cell
										>{formatNumber(serverProps.default_generation_settings.n_ctx)} tokens</Table.Cell
									>
								</Table.Row>
							{:else}
								<Table.Row>
									<Table.Cell class="h-10 align-middle font-medium text-red-500"
										>Context Size</Table.Cell
									>

									<Table.Cell class="text-red-500">Not available</Table.Cell>
								</Table.Row>
							{/if}

							<!-- Training Context -->
							{#if modelMeta?.n_ctx_train}
								<Table.Row>
									<Table.Cell class="h-10 align-middle font-medium">Training Context</Table.Cell>

									<Table.Cell>{formatNumber(modelMeta.n_ctx_train)} tokens</Table.Cell>
								</Table.Row>
							{/if}

							<!-- Model Size -->
							{#if modelMeta?.size}
								<Table.Row>
									<Table.Cell class="h-10 align-middle font-medium">Model Size</Table.Cell>

									<Table.Cell>{formatFileSize(modelMeta.size)}</Table.Cell>
								</Table.Row>
							{/if}

							<!-- Parameters -->
							{#if modelMeta?.n_params}
								<Table.Row>
									<Table.Cell class="h-10 align-middle font-medium">Parameters</Table.Cell>

									<Table.Cell>{formatParameters(modelMeta.n_params)}</Table.Cell>
								</Table.Row>
							{/if}

							<!-- Embedding Size -->
							{#if modelMeta?.n_embd}
								<Table.Row>
									<Table.Cell class="align-middle font-medium">Embedding Size</Table.Cell>

									<Table.Cell>{formatNumber(modelMeta.n_embd)}</Table.Cell>
								</Table.Row>
							{/if}

							<!-- Vocabulary Size -->
							{#if modelMeta?.n_vocab}
								<Table.Row>
									<Table.Cell class="align-middle font-medium">Vocabulary Size</Table.Cell>

									<Table.Cell>{formatNumber(modelMeta.n_vocab)} tokens</Table.Cell>
								</Table.Row>
							{/if}

							<!-- Vocabulary Type -->
							{#if modelMeta?.vocab_type}
								<Table.Row>
									<Table.Cell class="align-middle font-medium">Vocabulary Type</Table.Cell>
									<Table.Cell class="align-middle capitalize">{modelMeta.vocab_type}</Table.Cell>
								</Table.Row>
							{/if}

							<!-- Total Slots -->
							<Table.Row>
								<Table.Cell class="align-middle font-medium">Parallel Slots</Table.Cell>

								<Table.Cell>{serverProps.total_slots}</Table.Cell>
							</Table.Row>

							<!-- Modalities -->
							{#if modalities.length > 0}
								<Table.Row>
									<Table.Cell class="align-middle font-medium">Modalities</Table.Cell>

									<Table.Cell>
										<div class="flex flex-wrap gap-1">
											<BadgesModality {modalities} />
										</div>
									</Table.Cell>
								</Table.Row>
							{/if}

							<!-- Build Info -->
							<Table.Row>
								<Table.Cell class="align-middle font-medium">Build Info</Table.Cell>

								<Table.Cell class="align-middle font-mono text-xs"
									>{serverProps.build_info}</Table.Cell
								>
							</Table.Row>

							<!-- Chat Template -->
							{#if serverProps.chat_template}
								<Table.Row>
									<Table.Cell class="align-middle font-medium">Chat Template</Table.Cell>

									<Table.Cell class="py-10">
										<div class="rounded-md bg-muted p-4">
											<pre
												class="font-mono text-xs whitespace-pre-wrap">{serverProps.chat_template}</pre>
										</div>
									</Table.Cell>
								</Table.Row>
							{/if}
						</Table.Body>
					</Table.Root>
				{/if}
			{:else if !isLoadingModels}
				<div class="flex items-center justify-center py-8">
					<div class="text-sm text-muted-foreground">No model information available</div>
				</div>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
