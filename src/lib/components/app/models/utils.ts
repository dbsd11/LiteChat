import { SvelteMap } from 'svelte/reactivity';
import type { ModelOption } from '$lib/types/models';
import { extractOrgName } from '$lib/utils/thinking-params';

/**
 * Resolve org name for a model option.
 * Uses parsedId.orgName first (for org/model format), falls back to
 * extractOrgName on the raw model name (for dash-separated formats).
 */
export function resolveOrgName(option: ModelOption): string | null {
	return option.parsedId?.orgName ?? extractOrgName(option.model);
}

export interface ModelItem {
	option: ModelOption;
	flatIndex: number;
}

export interface OrgGroup {
	orgName: string | null;
	items: ModelItem[];
}

export interface GroupedModelOptions {
	loaded: ModelItem[];
	favorites: ModelItem[];
	available: OrgGroup[];
}

/**
 * Unified org-based grouping: all models grouped by orgName.
 * Loaded and favorites are included within their org groups.
 */
export interface OrgGroupUnified {
	orgName: string | null;
	items: ModelItem[];
	isLoaded: boolean;   // true if ALL items are loaded
	loadedCount: number;
	favCount: number;
}

export function filterModelOptions(options: ModelOption[], searchTerm: string): ModelOption[] {
	const term = searchTerm.trim().toLowerCase();
	if (!term) return options;

	return options.filter(
		(option) =>
			option.model.toLowerCase().includes(term) ||
			option.name?.toLowerCase().includes(term) ||
			option.aliases?.some((alias: string) => alias.toLowerCase().includes(term)) ||
			option.tags?.some((tag: string) => tag.toLowerCase().includes(term))
	);
}

export function groupModelOptions(
	filteredOptions: ModelOption[],
	favoriteIds: Set<string>,
	isModelLoaded: (model: string) => boolean
): GroupedModelOptions {
	// Loaded models
	const loaded: ModelItem[] = [];
	for (let i = 0; i < filteredOptions.length; i++) {
		if (isModelLoaded(filteredOptions[i].model)) {
			loaded.push({ option: filteredOptions[i], flatIndex: i });
		}
	}

	// Favorites (excluding loaded)
	const loadedModelIds = new Set(loaded.map((item) => item.option.model));
	const favorites: ModelItem[] = [];
	for (let i = 0; i < filteredOptions.length; i++) {
		if (
			favoriteIds.has(filteredOptions[i].model) &&
			!loadedModelIds.has(filteredOptions[i].model)
		) {
			favorites.push({ option: filteredOptions[i], flatIndex: i });
		}
	}

	// Available models grouped by org (excluding loaded and favorites)
	const available: OrgGroup[] = [];
	const orgGroups = new SvelteMap<string, ModelItem[]>();
	for (let i = 0; i < filteredOptions.length; i++) {
		const option = filteredOptions[i];
		if (loadedModelIds.has(option.model) || favoriteIds.has(option.model)) continue;

		const key = resolveOrgName(option)?.toLowerCase() ?? '';
		if (!orgGroups.has(key)) orgGroups.set(key, []);
		orgGroups.get(key)!.push({ option, flatIndex: i });
	}

	for (const [orgName, items] of orgGroups) {
		available.push({ orgName: orgName || null, items });
	}

	return { loaded, favorites, available };
}

/**
 * Group ALL models by org (including loaded and favorites).
 * This is the primary grouping for the collapsible org list.
 */
export function groupAllByOrg(
	filteredOptions: ModelOption[],
	favoriteIds: Set<string>,
	isModelLoaded: (model: string) => boolean
): OrgGroupUnified[] {
	const orgMap = new SvelteMap<string, ModelItem[]>();
	for (let i = 0; i < filteredOptions.length; i++) {
		const option = filteredOptions[i];
		const orgName = resolveOrgName(option);
		const key = orgName?.toLowerCase() ?? '__none__';
		if (!orgMap.has(key)) orgMap.set(key, []);
		orgMap.get(key)!.push({ option, flatIndex: i });
	}

	const result: OrgGroupUnified[] = [];
	for (const [orgName, items] of orgMap) {
		const displayOrg = orgName === '__none__' ? null : orgName;
		let loadedCount = 0;
		let favCount = 0;
		for (const item of items) {
			if (isModelLoaded(item.option.model)) loadedCount++;
			if (favoriteIds.has(item.option.model)) favCount++;
		}
		result.push({
			orgName: displayOrg,
			items,
			isLoaded: loadedCount === items.length && items.length > 0,
			loadedCount,
			favCount
		});
	}

	// Sort: loaded orgs first, then alphabetically
	result.sort((a, b) => {
		if (a.isLoaded !== b.isLoaded) return a.isLoaded ? -1 : 1;
		if (a.favCount > 0 && b.favCount === 0) return -1;
		if (b.favCount > 0 && a.favCount === 0) return 1;
		return (a.orgName ?? '').localeCompare(b.orgName ?? '');
	});

	return result;
}
