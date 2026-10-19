import { createMemo } from 'solid-js';
import { MdFillGraphic_eq as VoiceIcon, MdFillMic as MicIcon, MdFillPause_circle as StopIcon } from 'solid-icons/md';
import { Section } from '@/components/Section/Section.tsx';
import { useVoiceConversation } from '@/domain/voice/model/useVoiceConversation.ts';

type ListeningPhase = 'initializing' | 'ready' | 'speaking';

function getStatusLabel(
  enabled: boolean,
  phase: ListeningPhase,
  status: ReturnType<typeof useVoiceConversation>['status'],
  responseText: string | null,
): string {
  if (!enabled) {
    return 'Deaktiviert';
  }

  if (status === 'processing') {
    return responseText ? 'Generiere Antwort' : 'Verarbeite Sprachsegment';
  }

  if (status === 'playing') {
    return 'Spiele Antwort ab';
  }

  if (status === 'error') {
    return 'Fehler';
  }

  if (phase === 'speaking') {
    return 'Ich hoere zu';
  }

  if (phase === 'ready') {
    return 'Bereit';
  }

  return 'Initialisiere Mikrofon';
}

export function VoiceWidget() {
  const listeningPhase: ListeningPhase = 'initializing';
  const conversation = useVoiceConversation({
    language: 'de',
  });

  const isEnabled = false;

  const statusLabel = createMemo(() =>
    getStatusLabel(isEnabled, listeningPhase, conversation.status, conversation.responseText),
  );

  return (
    <Section>
      <div class="flex flex-1 flex-col gap-2">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-3">
            <div class="rounded-full border border-slate-700/80 bg-slate-900/70 p-2 text-slate-200">
              <VoiceIcon size={20} />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-slate-50">Voice</h2>
              <p class="text-sm text-slate-400">
                Deutscher Sprachmodus ueber Cockpit -&gt; service-assistant mit gestreamter LLM/TTS-Antwort.
              </p>
            </div>
          </div>

          <button
            type="button"
            class={[
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition',
              'cursor-not-allowed border-slate-600/60 bg-slate-800/50 text-slate-400',
            ]}
            disabled
          >
            {isEnabled ? <StopIcon size={18} /> : <MicIcon size={18} />}
            VAD deaktiviert
          </button>
        </div>

        <div class="rounded-md border border-slate-800/90 bg-slate-950/40 p-4">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium text-slate-300">Status</span>
            <span
              class={[
                'rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide',
                conversation.status === 'error'
                  ? 'bg-rose-500/15 text-rose-100'
                  : conversation.status === 'processing'
                    ? 'bg-amber-500/15 text-amber-100'
                    : conversation.status === 'playing'
                      ? 'bg-sky-500/15 text-sky-100'
                      : 'bg-emerald-500/15 text-emerald-100',
              ]}
            >
              {statusLabel()}
            </span>
          </div>

          <p class="mt-3 text-sm text-slate-400">
            Voice Activity Detection ist voruebergehend deaktiviert. Es werden keine Mikrofonsegmente erfasst oder an
            den Assistant-Service gesendet.
          </p>
        </div>

        {conversation.errorMessage ? (
          <div class="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {conversation.errorMessage}
          </div>
        ) : null}

        <div class="grid gap-2 lg:grid-cols-2">
          <div class="rounded-md border border-slate-800/90 bg-slate-950/40 p-4">
            <h3 class="text-sm font-medium text-slate-300">Erkannt</h3>
            <p class="mt-2 text-sm leading-6 text-slate-100">
              {conversation.transcript ?? 'Noch kein Transkript vorhanden.'}
            </p>
          </div>

          <div class="rounded-md border border-slate-800/90 bg-slate-950/40 p-4">
            <h3 class="text-sm font-medium text-slate-300">Antwort</h3>
            <p class="mt-2 text-sm leading-6 text-slate-100">
              {conversation.responseText ?? 'Nach einer Spracheingabe erscheint hier die Modellantwort.'}
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
