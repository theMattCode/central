const DEFAULT_LOCAL_BACKEND_BASE_URL = 'http://localhost:3010';

function normalizeBackendBaseUrl(baseUrl: string): string {
  let url: URL;

  try {
    url = new URL(baseUrl);
  } catch (error) {
    throw new Error(
      `Invalid backend base URL "${baseUrl}". Configure BACKEND_BASE_URL or VITE_BACKEND_API_BASE_URL with an absolute URL.`,
      { cause: error },
    );
  }

  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }

  return url.toString();
}

type ProcessEnv = {
  BACKEND_BASE_URL?: string;
};

type BackendBaseUrlSources = {
  runtimeBaseUrl?: string;
  buildTimeBaseUrl?: string;
};

function getBackendBaseUrlSources(): BackendBaseUrlSources {
  const processEnv = (globalThis as { process?: { env?: ProcessEnv } }).process?.env;

  return {
    runtimeBaseUrl: processEnv?.BACKEND_BASE_URL,
    buildTimeBaseUrl: import.meta.env.VITE_BACKEND_API_BASE_URL,
  };
}

export function resolveBackendBaseUrl(sources: BackendBaseUrlSources = getBackendBaseUrlSources()): string {
  const baseUrl = sources.runtimeBaseUrl ?? sources.buildTimeBaseUrl ?? DEFAULT_LOCAL_BACKEND_BASE_URL;

  return normalizeBackendBaseUrl(baseUrl);
}

export { DEFAULT_LOCAL_BACKEND_BASE_URL };
