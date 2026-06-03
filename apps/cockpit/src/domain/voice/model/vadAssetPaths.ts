import ortThreadedJsepModuleUrl from '@/domain/voice/generated/onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url';
import ortThreadedJsepWasmUrl from '@/domain/voice/generated/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url';

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

export function resolveVoiceStaticAssetPath(relativePath: string, basePath: string = import.meta.env.BASE_URL): string {
  const normalizedBasePath = ensureTrailingSlash(basePath);
  return `${normalizedBasePath}${relativePath}`;
}

export const VAD_BASE_ASSET_PATH = resolveVoiceStaticAssetPath('vendor/vad/');
export const VOICE_ORT_WASM_MODULE_URL = ortThreadedJsepModuleUrl;
export const VOICE_ORT_WASM_BINARY_URL = ortThreadedJsepWasmUrl;

export type VoiceOrtModule = {
  env: {
    logLevel?: string;
    wasm: {
      wasmPaths?: string | { mjs?: string | URL; wasm?: string | URL };
    };
  };
};

export function configureVoiceOrt(ort: VoiceOrtModule): void {
  ort.env.logLevel = 'error';
  ort.env.wasm.wasmPaths = {
    mjs: VOICE_ORT_WASM_MODULE_URL,
    wasm: VOICE_ORT_WASM_BINARY_URL,
  };
}
