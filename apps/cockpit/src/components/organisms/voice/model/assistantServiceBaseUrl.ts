const DEFAULT_LOCAL_ASSISTANT_SERVICE_BASE_URL = 'http://localhost:3020';

type ProcessEnv = {
  ASSISTANT_SERVICE_BASE_URL?: string;
};

type AssistantServiceBaseUrlSources = {
  runtimeBaseUrl?: string;
  buildTimeBaseUrl?: string;
};

function normalizeAssistantServiceBaseUrl(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch (error) {
    throw new Error(
      `Invalid assistant service base URL "${baseUrl}". Configure ASSISTANT_SERVICE_BASE_URL or VITE_ASSISTANT_API_BASE_URL with an absolute URL.`,
      { cause: error },
    );
  }

  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }

  return url.toString();
}

function getAssistantServiceBaseUrlSources(): AssistantServiceBaseUrlSources {
  const processEnv = (globalThis as { process?: { env?: ProcessEnv } }).process?.env;

  return {
    runtimeBaseUrl: processEnv?.ASSISTANT_SERVICE_BASE_URL,
    buildTimeBaseUrl: import.meta.env.VITE_ASSISTANT_API_BASE_URL,
  };
}

export function resolveAssistantServiceBaseUrl(
  sources: AssistantServiceBaseUrlSources = getAssistantServiceBaseUrlSources(),
): string {
  const baseUrl = sources.runtimeBaseUrl ?? sources.buildTimeBaseUrl ?? DEFAULT_LOCAL_ASSISTANT_SERVICE_BASE_URL;

  return normalizeAssistantServiceBaseUrl(baseUrl);
}

export { DEFAULT_LOCAL_ASSISTANT_SERVICE_BASE_URL };
