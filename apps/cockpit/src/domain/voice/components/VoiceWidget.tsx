import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMicVAD } from '@ricky0123/vad-react';
import {
  MdGraphicEq as VoiceIcon,
  MdMic as MicIcon,
  MdPauseCircle as StopIcon,
} from 'react-icons/md';
import { Section } from '@/components/Section/Section.tsx';
import { cx } from '@/utils/styles.ts';
import {
  configureVoiceOrt,
  VAD_BASE_ASSET_PATH,
} from '@/domain/voice/model/vadAssetPaths.ts';
import { useVoiceConversation } from '@/domain/voice/model/useVoiceConversation.ts';

type ListeningPhase = 'initializing' | 'ready' | 'speaking';

type ActiveMicrophoneProps = {
  onSpeechSegment: (audio: Float32Array) => Promise<void>;
  onPhaseChange: (phase: ListeningPhase) => void;
};

function ActiveMicrophone({
  onSpeechSegment,
  onPhaseChange,
}: ActiveMicrophoneProps) {
  useMicVAD({
    startOnLoad: true,
    baseAssetPath: VAD_BASE_ASSET_PATH,
    ortConfig: configureVoiceOrt,
    model: 'v5',
    minSpeechMs: 500,
    preSpeechPadMs: 1_000,
    redemptionMs: 1_600,
    onSpeechStart: () => onPhaseChange('speaking'),
    onSpeechEnd: (audio) => {
      onPhaseChange('ready');
      void onSpeechSegment(audio);
    },
    onVADMisfire: () => onPhaseChange('ready'),
  });

  useEffect(() => {
    onPhaseChange('ready');
    return () => onPhaseChange('initializing');
  }, [onPhaseChange]);

  return null;
}

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
  const [isEnabled, setIsEnabled] = useState(false);
  const [listeningPhase, setListeningPhase] =
    useState<ListeningPhase>('initializing');
  const conversation = useVoiceConversation({
    language: 'de',
  });

  const shouldListen =
    isEnabled &&
    conversation.status !== 'processing' &&
    conversation.status !== 'playing';

  const statusLabel = useMemo(
    () =>
      getStatusLabel(
        isEnabled,
        listeningPhase,
        conversation.status,
        conversation.responseText,
      ),
    [conversation.responseText, conversation.status, isEnabled, listeningPhase],
  );

  const toggleEnabled = useCallback(() => {
    if (isEnabled) {
      conversation.stopPlayback();
      setListeningPhase('initializing');
      setIsEnabled(false);
      return;
    }

    setIsEnabled(true);
  }, [conversation, isEnabled]);

  return (
    <Section>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-slate-700/80 bg-slate-900/70 p-2 text-slate-200">
              <VoiceIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-50">Voice</h2>
              <p className="text-sm text-slate-400">
                Deutscher Sprachmodus ueber Cockpit -&gt; service-assistant mit
                gestreamter LLM/TTS-Antwort.
              </p>
            </div>
          </div>

          <button
            type="button"
            className={cx(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition',
              isEnabled
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
            )}
            onClick={toggleEnabled}
          >
            {isEnabled ? <StopIcon size={18} /> : <MicIcon size={18} />}
            {isEnabled ? 'Deaktivieren' : 'Aktivieren'}
          </button>
        </div>

        <div className="rounded-md border border-slate-800/90 bg-slate-950/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-300">Status</span>
            <span
              className={cx(
                'rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide',
                conversation.status === 'error'
                  ? 'bg-rose-500/15 text-rose-100'
                  : conversation.status === 'processing'
                    ? 'bg-amber-500/15 text-amber-100'
                    : conversation.status === 'playing'
                      ? 'bg-sky-500/15 text-sky-100'
                      : 'bg-emerald-500/15 text-emerald-100',
              )}
            >
              {statusLabel}
            </span>
          </div>

          <p className="mt-3 text-sm text-slate-400">
            Sprich nach dem Aktivieren frei in das Mikrofon. Das Widget trennt
            Sprache lokal im Browser, sendet nur erkannte Sprachsegmente an den
            Assistant-Service und startet die Sprachausgabe bereits waehrend der
            Antwort.
          </p>
        </div>

        {conversation.errorMessage ? (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {conversation.errorMessage}
          </div>
        ) : null}

        <div className="grid gap-2 lg:grid-cols-2">
          <div className="rounded-md border border-slate-800/90 bg-slate-950/40 p-4">
            <h3 className="text-sm font-medium text-slate-300">Erkannt</h3>
            <p className="mt-2 text-sm leading-6 text-slate-100">
              {conversation.transcript ?? 'Noch kein Transkript vorhanden.'}
            </p>
          </div>

          <div className="rounded-md border border-slate-800/90 bg-slate-950/40 p-4">
            <h3 className="text-sm font-medium text-slate-300">Antwort</h3>
            <p className="mt-2 text-sm leading-6 text-slate-100">
              {conversation.responseText ??
                'Nach einer Spracheingabe erscheint hier die Modellantwort.'}
            </p>
          </div>
        </div>

        {shouldListen ? (
          <ActiveMicrophone
            onPhaseChange={setListeningPhase}
            onSpeechSegment={conversation.processSpeech}
          />
        ) : null}
      </div>
    </Section>
  );
}
