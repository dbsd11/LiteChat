import { MODEL_ID_ORG_SEPARATOR, MODEL_ID_SEGMENT_SEPARATOR } from '$lib/constants/model-id';

/**
 * 思考模式参数格式枚举
 */
export enum ThinkingParamFormat {
	Deepseek = 'deepseek',
	Generic = 'generic'
}

/**
 * Extract org/prefix name from a model identifier.
 * Returns null when no org separator is found.
 *
 * Handles both `org/model` and `prefix-name-version` formats.
 *
 * Examples:
 *   "deepseek/deepseek-v3" → "deepseek"
 *   "Qwen/Qwen3-30B" → "Qwen"
 *   "deepseek-v3-0324" → "deepseek"
 *   "Qwen2-30b-a3b" → "Qwen2"
 *   "modelname" → null
 *
 * @param lowercase - When true, return org name in lowercase (for display/grouping).
 *                    Defaults to false to preserve original case.
 */
export function extractOrgName(modelName: string, lowercase = false): string | null {
	// 1. Try org/model format first (e.g. "deepseek/deepseek-v3" → "deepseek")
	const slashIdx = modelName.indexOf(MODEL_ID_ORG_SEPARATOR);
	if (slashIdx > 0) {
		const org = modelName.slice(0, slashIdx);
		return lowercase ? org.toLowerCase() : org;
	}

	// 2. Fallback: first dash-separated segment (e.g. "deepseek-v3-0324" → "deepseek")
	const dashIdx = modelName.indexOf(MODEL_ID_SEGMENT_SEPARATOR);
	if (dashIdx > 0) {
		const org = modelName.slice(0, dashIdx);
		return lowercase ? org.toLowerCase() : org;
	}

	return null;
}

/**
 * 根据模型名称判断思考模式参数格式
 * - deepseek 分组: 使用 {"thinking": {"type": "enabled"/"disabled"}}
 * - 其他分组: 使用 {"chat_template_kwargs": {"enable_thinking": true/false}}
 */
export function getThinkingParamFormat(modelName: string): ThinkingParamFormat {
	const trimmed = modelName?.trim();
	if (!trimmed) return ThinkingParamFormat.Generic;

	const orgName = extractOrgName(trimmed);

	return orgName?.toLowerCase() === 'deepseek'
		? ThinkingParamFormat.Deepseek
		: ThinkingParamFormat.Generic;
}

/**
 * Build thinking mode parameters object based on model org name
 *
 * @param modelName - The model name to determine parameter format
 * @param enableThinking - Whether thinking mode should be enabled
 * @returns Object containing either thinking or chat_template_kwargs params
 */
export function buildThinkingParams(
	modelName: string,
	enableThinking: boolean
): { thinking?: { type: string }; chat_template_kwargs?: { enable_thinking: boolean } } {
	const format = getThinkingParamFormat(modelName);

	if (format === ThinkingParamFormat.Deepseek) {
		return {
			thinking: { type: enableThinking ? 'enabled' : 'disabled' }
		};
	}

	return {
		chat_template_kwargs: { enable_thinking: enableThinking }
	};
}
