import 'src/domain/assistant/Jarvis/jarvis.css';
import { createMemo, createSignal, For, onSettled } from 'solid-js';
import {
  MdFillGraphic_eq as OutputIcon,
  MdFillMic as MicIcon,
  MdFillPause_circle as StandbyIcon,
  MdFillPower_settings_new as PowerIcon,
} from 'solid-icons/md';
import { formatJarvisPercent, type JarvisMode, resolveJarvisSystemState } from '@/domain/assistant/Jarvis/model.ts';
import { useVoiceConversation } from '@/domain/voice/model/useVoiceConversation.ts';
import { JarvisOrb } from '@/domain/assistant/Jarvis/JarvisOrb.tsx';
import { Icon } from '@/components/Icon/Icon.tsx';

const BAR_COUNT = 56;

type JarvisMotionFrame = {
  bars: number[];
  energy: number;
};

type MicrophoneState = {
  error: string | null;
  isListening: boolean;
  isLoading: boolean;
  micLevel: number;
  userSpeaking: boolean;
};

const IDLE_BARS = Array.from({ length: BAR_COUNT }, () => 0.12);
const INITIAL_MICROPHONE_STATE: MicrophoneState = {
  error: null,
  isListening: false,
  isLoading: false,
  micLevel: 0,
  userSpeaking: false,
};

function clamp01(value: number): number {
  if (Number.isNaN(value) || value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function getTargetEnergy(mode: JarvisMode, microphoneLevel: number, playbackLevel: number, tickSeconds: number) {
  switch (mode) {
    case 'offline':
      return 0;
    case 'booting':
      return 0.24 + (Math.sin(tickSeconds * 3.2) + 1) * 0.08;
    case 'standby':
      return 0.18 + (Math.sin(tickSeconds * 1.5) + 1) * 0.04;
    case 'listening':
      return 0.32 + microphoneLevel * 0.7;
    case 'transcribing':
      return 0.34 + (Math.sin(tickSeconds * 5.4) + 1) * 0.12;
    case 'speaking':
      return 0.26 + playbackLevel * 0.9;
    case 'error':
      return 0.2 + Math.abs(Math.sin(tickSeconds * 4.4)) * 0.16;
  }
}

function useJarvisMotion(mode: () => JarvisMode, microphoneLevel: () => number, playbackLevel: () => number) {
  const [frame, setFrame] = createSignal<JarvisMotionFrame>({
    bars: IDLE_BARS,
    energy: 0.08,
  });

  onSettled(() => {
    let frameId = 0;

    const animate = (time: number) => {
      const tickSeconds = time / 1000;

      setFrame((currentFrame) => {
        const currentMode = mode();
        const targetEnergy = getTargetEnergy(currentMode, microphoneLevel(), playbackLevel(), tickSeconds);
        const energySmoothing = currentMode === 'speaking' || currentMode === 'listening' ? 0.22 : 0.12;
        const nextEnergy = currentFrame.energy + (targetEnergy - currentFrame.energy) * energySmoothing;

        const nextBars = currentFrame.bars.map((currentValue, index) => {
          const indexRatio = index / BAR_COUNT;
          const waveA = (Math.sin(tickSeconds * 4.8 + indexRatio * Math.PI * 8) + 1) / 2;
          const waveB = (Math.sin(tickSeconds * 2.2 - indexRatio * Math.PI * 5) + 1) / 2;
          const waveC = (Math.cos(tickSeconds * 6.1 + indexRatio * Math.PI * 13) + 1) / 2;
          const liveEnergy = currentMode === 'speaking' ? playbackLevel() : microphoneLevel();
          const dynamicBias =
            currentMode === 'listening' || currentMode === 'speaking'
              ? liveEnergy * (0.24 + waveC * 0.32)
              : currentMode === 'transcribing'
                ? 0.12 + waveB * 0.08
                : currentMode === 'booting'
                  ? waveA * 0.05
                  : currentMode === 'error'
                    ? waveC * 0.14
                    : 0;
          const targetBar = clamp01(nextEnergy * (0.4 + waveA * 0.36) + waveB * 0.12 + dynamicBias);
          const barSmoothing = currentMode === 'speaking' ? 0.34 : currentMode === 'listening' ? 0.28 : 0.18;

          return currentValue + (targetBar - currentValue) * barSmoothing;
        });

        return {
          bars: nextBars,
          energy: nextEnergy,
        };
      });

      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(frameId);
  });

  return frame;
}

function TelemetryList(props: { items: ReadonlyArray<{ label: string; value: string }>; title: string }) {
  return (
    <div class="jarvis-telemetry glass-panel">
      <div class="jarvis-telemetry__title">{props.title}</div>
      <div class="jarvis-telemetry__items">
        <For each={props.items}>
          {(item) => (
            <div class="jarvis-telemetry__row">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

export function Jarvis() {
  const [isEnabled, setIsEnabled] = createSignal(false);
  const microphoneState = INITIAL_MICROPHONE_STATE;
  const conversation = useVoiceConversation({
    language: 'de',
  });

  const isVadEnabled = false;
  const shouldListen = false;

  const systemState = createMemo(() =>
    resolveJarvisSystemState({
      conversationError: conversation.errorMessage,
      conversationStatus: conversation.status,
      isEnabled: isEnabled(),
      isVadLoading: microphoneState.isLoading,
      userSpeaking: microphoneState.userSpeaking,
      vadError: microphoneState.error,
    }),
  );

  const motion = useJarvisMotion(
    () => systemState().mode,
    () => microphoneState.micLevel,
    () => conversation.playbackLevel,
  );

  const toggleEnabled = () => {
    if (isEnabled()) {
      conversation.stopPlayback();
      setIsEnabled(false);
      return;
    }

    if (isVadEnabled) {
      setIsEnabled(true);
    }
  };

  const leftTelemetry = createMemo(() => [
    {
      label: 'MIC LEVEL',
      value: formatJarvisPercent(microphoneState.micLevel),
    },
    {
      label: 'ARRAY',
      value: microphoneState.isListening ? 'ARMED' : isVadEnabled && isEnabled() ? 'HOLD' : 'OFFLINE',
    },
    {
      label: 'CAPTURE',
      value: microphoneState.userSpeaking ? 'LIVE' : shouldListen ? 'READY' : 'PAUSED',
    },
    { label: 'TURN', value: conversation.status.toUpperCase() },
  ]);

  const rightTelemetry = createMemo(() => [
    {
      label: 'OUT LEVEL',
      value: formatJarvisPercent(conversation.playbackLevel),
    },
    {
      label: 'REPLY',
      value: conversation.status === 'playing' ? 'STREAMING' : conversation.responseText ? 'BUFFERED' : 'IDLE',
    },
    {
      label: 'TRANSCRIPT',
      value: conversation.status === 'processing' ? 'LIVE' : conversation.transcript ? 'LOCKED' : 'EMPTY',
    },
    { label: 'STATUS', value: systemState().label.toUpperCase() },
  ]);

  const transcriptCopy = createMemo(
    () =>
      conversation.transcript ??
      (isEnabled()
        ? 'Awaiting a captured speech segment from the live microphone.'
        : 'Voice Activity Detection is temporarily disabled.'),
  );
  const responseCopy = createMemo(
    () =>
      conversation.responseText ??
      (conversation.status === 'playing'
        ? 'Reply audio is currently streaming back into the reactor.'
        : 'Model output will stream here while the browser plays the synthesized reply.'),
  );
  const errorMessage = createMemo(() => microphoneState.error ?? conversation.errorMessage);

  return (
    <section class="relative w-full h-full" data-mode={systemState().mode} id="jarvis">
      <div class="absolute scanline" aria-hidden="true" />

      <div class="jarvis-shell__header">
        <div class="jarvis-shell__headline">
          <p>{systemState().detail}</p>
        </div>

        <div class="jarvis-shell__status">
          <div
            class={[
              'jarvis-shell__badge glass-control',
              {
                'jarvis-shell__badge--error': systemState().tone === 'error',
                'jarvis-shell__badge--attention': systemState().tone === 'attention',
              },
            ]}
          >
            <Icon icon={PowerIcon} class="h-4 w-4" />
            {systemState().label}
          </div>
          <button
            type="button"
            class={['jarvis-shell__toggle glass-control', { 'jarvis-shell__toggle--active': isEnabled() }]}
            onClick={toggleEnabled}
            disabled={!isVadEnabled}
          >
            <Icon icon={isEnabled() ? StandbyIcon : MicIcon} class="h-5 w-5" />
            {isEnabled() ? 'Stand down' : 'VAD disabled'}
          </button>
        </div>
      </div>

      <div class="jarvis-shell__center">
        <TelemetryList items={leftTelemetry()} title="Sensor rail" />
        <JarvisOrb bars={motion().bars} energy={motion().energy} mode={systemState().mode} />
        <TelemetryList items={rightTelemetry()} title="Output rail" />
      </div>

      <div class="jarvis-shell__panels">
        <div class="jarvis-panel glass-panel">
          <div class="jarvis-panel__title">
            <Icon icon={MicIcon} class="h-4 w-4" />
            Transcript
          </div>
          <p>{transcriptCopy()}</p>
        </div>

        <div class="jarvis-panel glass-panel">
          <div class="jarvis-panel__title">
            <Icon icon={OutputIcon} class="h-4 w-4" />
            Reply stream
          </div>
          <p>{responseCopy()}</p>
        </div>
      </div>

      {errorMessage() ? <div class="jarvis-shell__alert glass-panel">{errorMessage()}</div> : null}
    </section>
  );
}
