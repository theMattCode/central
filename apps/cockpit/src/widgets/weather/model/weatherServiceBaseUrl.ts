const DEFAULT_LOCAL_WEATHER_SERVICE_BASE_URL = 'http://localhost:3010';

function normalizeWeatherServiceBaseUrl(baseUrl: string): string {
  let url: URL;

  try {
    url = new URL(baseUrl);
  } catch (error) {
    throw new Error(
      `Invalid weather service base URL "${baseUrl}". Configure WEATHER_SERVICE_BASE_URL or VITE_WEATHER_API_BASE_URL with an absolute URL.`,
      { cause: error },
    );
  }

  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }

  return url.toString();
}

type ProcessEnv = {
  WEATHER_SERVICE_BASE_URL?: string;
};

type WeatherServiceBaseUrlSources = {
  runtimeBaseUrl?: string;
  buildTimeBaseUrl?: string;
};

function getWeatherServiceBaseUrlSources(): WeatherServiceBaseUrlSources {
  const processEnv = (globalThis as { process?: { env?: ProcessEnv } }).process?.env;

  return {
    runtimeBaseUrl: processEnv?.WEATHER_SERVICE_BASE_URL,
    buildTimeBaseUrl: import.meta.env.VITE_WEATHER_API_BASE_URL,
  };
}

export function resolveWeatherServiceBaseUrl(
  sources: WeatherServiceBaseUrlSources = getWeatherServiceBaseUrlSources(),
): string {
  const baseUrl = sources.runtimeBaseUrl ?? sources.buildTimeBaseUrl ?? DEFAULT_LOCAL_WEATHER_SERVICE_BASE_URL;

  return normalizeWeatherServiceBaseUrl(baseUrl);
}

export { DEFAULT_LOCAL_WEATHER_SERVICE_BASE_URL };
