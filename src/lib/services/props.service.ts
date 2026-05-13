import { apiFetch, apiFetchWithParams } from '$lib/utils';
import { ServerRole } from '$lib/enums';
import { API_MODELS } from '$lib/constants';

/**
 * Extended model entry for vLLM/OpenAI-compatible backends that may include extra fields.
 */
interface ExtendedModelEntry {
	id: string;
	max_model_len?: number;
	[max: string]: any;
}

/**
 * Fallback props for non-llama.cpp backends (e.g., vLLM, OpenAI-compatible APIs).
 * Fetches model info from /v1/models to populate n_ctx and model_path from the first available model.
 */
async function getFallbackProps(): Promise<ApiLlamaCppServerProps> {
	let nCtx = 4096;
	let modelPath = '';

	try {
		const response = await apiFetch<ApiModelListResponse>(API_MODELS.LIST, { authOnly: true });
		const firstModel = response.data?.[0] as ExtendedModelEntry | undefined;

		if (firstModel) {
			modelPath = firstModel.id;
			// vLLM returns max_model_len; use it as n_ctx
			nCtx = firstModel.max_model_len || 4096;
		}

		console.info(
			`[PropsService] Fallback props from /v1/models: model="${modelPath}", n_ctx=${nCtx}`
		);
	} catch {
		console.warn('[PropsService] Failed to fetch /v1/models for fallback, using defaults');
	}

	return {
		role: ServerRole.MODEL,
		default_generation_settings: {
			id: 0,
			id_task: 0,
			n_ctx: nCtx,
			speculative: false,
			is_processing: false,
			params: {
				n_predict: 512,
				seed: -1,
				temperature: 1.0,
				dynatemp_range: 0,
				dynatemp_exponent: 1,
				top_k: 20,
				top_p: 0.95,
				min_p: 0.0,
				top_n_sigma: 0,
				xtc_probability: 0,
				xtc_threshold: 0,
				typ_p: 1,
				repeat_last_n: 64,
				repeat_penalty: 1.0,
				presence_penalty: 0.0,
				frequency_penalty: 0,
				dry_multiplier: 0,
				dry_base: 1,
				dry_allowed_length: 0,
				dry_penalty_last_n: 0,
				dry_sequence_breakers: [],
				mirostat: 0,
				mirostat_tau: 0,
				mirostat_eta: 0,
				stop: [],
				max_tokens: 512,
				n_keep: 0,
				n_discard: 0,
				ignore_eos: false,
				stream: true,
				logit_bias: [],
				n_probs: 0,
				min_keep: 0,
				grammar: '',
				grammar_lazy: false,
				grammar_triggers: [],
				preserved_tokens: [],
				chat_format: '',
				reasoning_format: 'none',
				reasoning_in_content: false,
				generation_prompt: '',
				samplers: [],
				backend_sampling: false,
				'speculative.n_max': 0,
				'speculative.n_min': 0,
				'speculative.p_min': 0,
				timings_per_token: false,
				post_sampling_probs: false,
				lora: []
			},
			prompt: '',
			next_token: {
				has_next_token: false,
				has_new_line: false,
				n_remain: 0,
				n_decoded: 0,
				stopping_word: ''
			}
		},
		total_slots: 1,
		model_path: modelPath,
		modalities: {
			vision: true,
			audio: true
		},
		chat_template: '',
		bos_token: '<|begin_of_text|>',
		eos_token: '<|end_of_text|>',
		build_info: 'vllm-compatible'
	};
}

export class PropsService {
	/**
	 *
	 *
	 * Fetching
	 *
	 *
	 */

	/**
	 * Fetches global server properties from the `/props` endpoint.
	 * In MODEL mode, returns modalities for the single loaded model.
	 * In ROUTER mode, returns server-wide settings without model-specific modalities.
	 *
	 * For non-llama.cpp backends (vLLM, OpenAI-compatible), falls back to default props
	 * when the `/props` endpoint returns 404.
	 *
	 * @param autoload - If false, prevents automatic model loading (default: false)
	 * @returns Server properties including default generation settings and capabilities
	 * @throws {Error} If the request fails or returns invalid data
	 */
	static async fetch(autoload = false): Promise<ApiLlamaCppServerProps> {
		const params: Record<string, string> = {};
		if (!autoload) {
			params.autoload = 'false';
		}

		try {
			return await apiFetchWithParams<ApiLlamaCppServerProps>('./props', params, { authOnly: true });
		} catch (error: any) {
			// If /props returns 404, or empty response (non-llama.cpp backend like vLLM/OpenAI-compatible)
			// Return fallback props so the webUI can still function
			if (
				error?.message?.includes('404') ||
				error?.response?.status === 404 ||
				error?.message?.includes('Unexpected end of JSON')
			) {
				console.info('[PropsService] /props endpoint not available, using fallback props (non-llama.cpp backend)');
				return await getFallbackProps();
			}
			// For other errors (network, 500, etc.), re-throw
			throw error;
		}
	}

	/**
	 * Fetches server properties for a specific model (ROUTER mode only).
	 * Required in ROUTER mode because global `/props` does not include per-model modalities.
	 *
	 * For non-llama.cpp backends (vLLM, OpenAI-compatible), falls back to default props
	 * when the `/props` endpoint returns 404.
	 *
	 * @param modelId - The model ID to fetch properties for
	 * @param autoload - If false, prevents automatic model loading (default: false)
	 * @returns Server properties specific to the requested model
	 * @throws {Error} If the request fails, model not found, or model not loaded
	 */
	static async fetchForModel(modelId: string, autoload = false): Promise<ApiLlamaCppServerProps> {
		const params: Record<string, string> = { model: modelId };
		if (!autoload) {
			params.autoload = 'false';
		}

		try {
			return await apiFetchWithParams<ApiLlamaCppServerProps>('./props', params, { authOnly: true });
		} catch (error: any) {
			// If /props returns 404, or empty response (non-llama.cpp backend like vLLM/OpenAI-compatible)
			// Return fallback props so the webUI can still function
			if (
				error?.message?.includes('404') ||
				error?.response?.status === 404 ||
				error?.message?.includes('Unexpected end of JSON')
			) {
				console.info(`[PropsService] /props endpoint not available for model "${modelId}", using fallback props (non-llama.cpp backend)`);
				return await getFallbackProps();
			}
			// For other errors (network, 500, etc.), re-throw
			throw error;
		}
	}
}
