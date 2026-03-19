const DEFAULT_LOCAL_VOICE_SERVICE_BASE_URL = 'http://localhost:3020';

type ProcessEnv = {
  VOICE_SERVICE_BASE_URL?: string;
};

type VoiceServiceBaseUrlSources = {
  runtimeBaseUrl?: string;
  buildTimeBaseUrl?: string;
};

function normalizeVoiceServiceBaseUrl(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch (error) {
    throw new Error(
      `Invalid voice service base URL "${baseUrl}". Configure VOICE_SERVICE_BASE_URL or VITE_VOICE_API_BASE_URL with an absolute URL.`,
      { cause: error },
    );
  }

  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }

  return url.toString();
}

function getVoiceServiceBaseUrlSources(): VoiceServiceBaseUrlSources {
  const processEnv = (globalThis as { process?: { env?: ProcessEnv } }).process?.env;

  return {
    runtimeBaseUrl: processEnv?.VOICE_SERVICE_BASE_URL,
    buildTimeBaseUrl: import.meta.env.VITE_VOICE_API_BASE_URL,
  };
}

export function resolveVoiceServiceBaseUrl(
  sources: VoiceServiceBaseUrlSources = getVoiceServiceBaseUrlSources(),
): string {
  const baseUrl = sources.runtimeBaseUrl ?? sources.buildTimeBaseUrl ?? DEFAULT_LOCAL_VOICE_SERVICE_BASE_URL;

  return normalizeVoiceServiceBaseUrl(baseUrl);
}

export { DEFAULT_LOCAL_VOICE_SERVICE_BASE_URL };
