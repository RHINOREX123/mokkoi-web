/**
 * API client for communicating with mokkoi.com endpoints.
 * Handles retries, timeouts, and error formatting.
 */

export interface GenerateScreenRequest {
  prompt: string;
  currentScreen?: unknown;
  imageData?: string;
  imageMimeType?: string;
  projectId?: string;
  screenId?: string;
  screenName?: string;
}

export interface GenerateScreenResponse {
  tree: ComponentNode;
  modelUsed: string;
}

export interface GenerateFlowRequest {
  prompt: string;
  projectId?: string;
}

export interface GenerateFlowResponse {
  screens: Array<{ id: string; name: string; tree: ComponentNode }>;
  modelUsed: string;
}

export interface ComponentNode {
  type: string;
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  children?: (ComponentNode | string)[];
}

const TIMEOUT_MS = 60_000;
const MAX_RETRIES = 1;

function getConfig() {
  const apiUrl = process.env.MOKKOI_API_URL || 'https://mokkoi.com';
  const apiKey = process.env.MOKKOI_API_KEY || '';
  return { apiUrl, apiKey };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function apiRequest<T>(
  path: string,
  body: unknown,
  retries = MAX_RETRIES
): Promise<T> {
  const { apiUrl, apiKey } = getConfig();

  if (!apiKey) {
    throw new Error(
      'MOKKOI_API_KEY is not set. Set it to your Anthropic API key for BYOK generation.'
    );
  }

  const url = `${apiUrl.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'X-Mokkoi-Source': 'mcp',
    'X-API-Key': apiKey,
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        url,
        { method: 'POST', headers, body: JSON.stringify(body) },
        TIMEOUT_MS
      );

      if (response.ok) {
        return (await response.json()) as T;
      }

      // Retry on 5xx errors
      if (response.status >= 500 && attempt < retries) {
        continue;
      }

      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `API request failed (${response.status}): ${errorBody}`
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`API request timed out after ${TIMEOUT_MS / 1000}s`);
      }
      // Retry network errors once
      if (attempt < retries && !(err instanceof Error && err.message.startsWith('API request failed'))) {
        continue;
      }
      throw err;
    }
  }

  throw new Error('API request failed after retries');
}

export async function generateScreen(
  req: GenerateScreenRequest
): Promise<GenerateScreenResponse> {
  return apiRequest<GenerateScreenResponse>('/api/generate', req);
}

export async function generateFlow(
  req: GenerateFlowRequest
): Promise<GenerateFlowResponse> {
  return apiRequest<GenerateFlowResponse>('/api/generate-flow', req);
}
