import { toErrorMessage } from '@/utils/formatting.ts';

const DEFAULT_BACKEND_BASE_URL = 'http://localhost:3010';

export function resolveBackendBaseUrl(): string {
  return (
    process.env.BACKEND_BASE_URL ||
    import.meta.env.VITE_BACKEND_API_BASE_URL ||
    DEFAULT_BACKEND_BASE_URL
  );
}

type BackendError = {
  error?: {
    message?: string;
  };
};

export async function resolveErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as BackendError;
    if (payload.error?.message) {
      return payload.error.message;
    }
  } catch (error) {
    return `request failed with status ${response.status}, error: ${toErrorMessage(error)}`;
  }

  return `request failed with status ${response.status}`;
}

export async function fetchJson<T>(url: URL, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await resolveErrorMessage(response));
  }

  return (await response.json()) as T;
}
