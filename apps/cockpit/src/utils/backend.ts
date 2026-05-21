const DEFAULT_BACKEND_BASE_URL = 'http://localhost:3010';

export function resolveBackendBaseUrl(): string {
  return process.env.BACKEND_BASE_URL || import.meta.env.VITE_BACKEND_API_BASE_URL || DEFAULT_BACKEND_BASE_URL;
}
