import 'src/domain/assistant/Jarvis/jarvis.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMicVAD } from '@ricky0123/vad-react';
import {
  MdGraphicEq as OutputIcon,
  MdMic as MicIcon,
  MdPauseCircle as StandbyIcon,
  MdPowerSettingsNew as PowerIcon,
} from 'react-icons/md';
import { cx } from '@/utils/styles.ts';
import {
  formatJarvisPercent,
  type JarvisMode,
  resolveJarvisSystemState,
} from '@/domain/assistant/Jarvis/model.ts';
import {
  configureVoiceOrt,
  VAD_BASE_ASSET_PATH,
} from '@/domain/voice/model/vadAssetPaths.ts';
import { getFloat32SignalLevel } from '@/domain/voice/model/audioLevel.ts';
import { useVoiceConversation } from '@/domain/voice/model/useVoiceConversation.ts';
import { JarvisOrb } from '@/domain/assistant/Jarvis/JarvisOrb.tsx';

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

type ActiveMicrophoneProps = {
  onSpeechSegment: (audio: Float32Array) => Promise<void>;
  onStateChange: (state: MicrophoneState) => void;
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

function getTargetEnergy(
  mode: JarvisMode,
  microphoneLevel: number,
  playbackLevel: number,
  tickSeconds: number,
) {
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

function useJarvisMotion(
  mode: JarvisMode,
  microphoneLevel: number,
  playbackLevel: number,
) {
  const [frame, setFrame] = useState<JarvisMotionFrame>({
    bars: IDLE_BARS,
    energy: 0.08,
  });

  useEffect(() => {
    let frameId = 0;

    const animate = (time: number) => {
      const tickSeconds = time / 1000;

      setFrame((currentFrame) => {
        const targetEnergy = getTargetEnergy(
          mode,
          microphoneLevel,
          playbackLevel,
          tickSeconds,
        );
        const energySmoothing =
          mode === 'speaking' || mode === 'listening' ? 0.22 : 0.12;
        const nextEnergy =
          currentFrame.energy +
          (targetEnergy - currentFrame.energy) * energySmoothing;

        const nextBars = currentFrame.bars.map((currentValue, index) => {
          const indexRatio = index / BAR_COUNT;
          const waveA =
            (Math.sin(tickSeconds * 4.8 + indexRatio * Math.PI * 8) + 1) / 2;
          const waveB =
            (Math.sin(tickSeconds * 2.2 - indexRatio * Math.PI * 5) + 1) / 2;
          const waveC =
            (Math.cos(tickSeconds * 6.1 + indexRatio * Math.PI * 13) + 1) / 2;
          const liveEnergy =
            mode === 'speaking' ? playbackLevel : microphoneLevel;
          const dynamicBias =
            mode === 'listening' || mode === 'speaking'
              ? liveEnergy * (0.24 + waveC * 0.32)
              : mode === 'transcribing'
                ? 0.12 + waveB * 0.08
                : mode === 'booting'
                  ? waveA * 0.05
                  : mode === 'error'
                    ? waveC * 0.14
                    : 0;
          const targetBar = clamp01(
            nextEnergy * (0.4 + waveA * 0.36) + waveB * 0.12 + dynamicBias,
          );
          const barSmoothing =
            mode === 'speaking' ? 0.34 : mode === 'listening' ? 0.28 : 0.18;

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
  }, [microphoneLevel, mode, playbackLevel]);

  return frame;
}

function ActiveMicrophone({
  onSpeechSegment,
  onStateChange,
}: ActiveMicrophoneProps) {
  const [micLevel, setMicLevel] = useState(0);
  const vad = useMicVAD({
    startOnLoad: true,
    baseAssetPath: VAD_BASE_ASSET_PATH,
    ortConfig: configureVoiceOrt,
    onFrameProcessed: (_probabilities, frame) => {
      setMicLevel(getFloat32SignalLevel(frame));
    },
    onSpeechEnd: (audio) => {
      setMicLevel(0);
      void onSpeechSegment(audio);
    },
    onVADMisfire: () => setMicLevel(0),
  });

  useEffect(() => {
    onStateChange({
      error: vad.errored ? String(vad.errored) : null,
      isListening: vad.listening,
      isLoading: vad.loading,
      micLevel: vad.userSpeaking ? micLevel : Math.min(micLevel, 0.16),
      userSpeaking: vad.userSpeaking,
    });
  }, [
    micLevel,
    onStateChange,
    vad.errored,
    vad.listening,
    vad.loading,
    vad.userSpeaking,
  ]);

  useEffect(() => {
    return () => onStateChange(INITIAL_MICROPHONE_STATE);
  }, [onStateChange]);

  return null;
}

function TelemetryList({
  items,
  title,
}: {
  items: ReadonlyArray<{ label: string; value: string }>;
  title: string;
}) {
  return (
    <div className="jarvis-telemetry">
      <div className="jarvis-telemetry__title">{title}</div>
      <div className="jarvis-telemetry__items">
        {items.map((item) => (
          <div key={`${title}-${item.label}`} className="jarvis-telemetry__row">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Jarvis() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [microphoneState, setMicrophoneState] = useState<MicrophoneState>(
    INITIAL_MICROPHONE_STATE,
  );
  const conversation = useVoiceConversation({
    language: 'de',
  });

  const shouldListen =
    isEnabled &&
    conversation.status !== 'processing' &&
    conversation.status !== 'playing';

  const systemState = useMemo(
    () =>
      resolveJarvisSystemState({
        conversationError: conversation.errorMessage,
        conversationStatus: conversation.status,
        isEnabled,
        isVadLoading: microphoneState.isLoading,
        userSpeaking: microphoneState.userSpeaking,
        vadError: microphoneState.error,
      }),
    [
      conversation.errorMessage,
      conversation.status,
      isEnabled,
      microphoneState.error,
      microphoneState.isLoading,
      microphoneState.userSpeaking,
    ],
  );

  const motion = useJarvisMotion(
    systemState.mode,
    microphoneState.micLevel,
    conversation.playbackLevel,
  );

  const toggleEnabled = useCallback(() => {
    if (isEnabled) {
      conversation.stopPlayback();
      setIsEnabled(false);
      return;
    }

    setIsEnabled(true);
  }, [conversation, isEnabled]);

  const leftTelemetry = useMemo(
    () => [
      {
        label: 'MIC LEVEL',
        value: formatJarvisPercent(microphoneState.micLevel),
      },
      {
        label: 'ARRAY',
        value: microphoneState.isListening
          ? 'ARMED'
          : isEnabled
            ? 'HOLD'
            : 'OFFLINE',
      },
      {
        label: 'CAPTURE',
        value: microphoneState.userSpeaking
          ? 'LIVE'
          : shouldListen
            ? 'READY'
            : 'PAUSED',
      },
      { label: 'TURN', value: conversation.status.toUpperCase() },
    ],
    [
      conversation.status,
      isEnabled,
      microphoneState.isListening,
      microphoneState.micLevel,
      microphoneState.userSpeaking,
      shouldListen,
    ],
  );

  const rightTelemetry = useMemo(
    () => [
      {
        label: 'OUT LEVEL',
        value: formatJarvisPercent(conversation.playbackLevel),
      },
      {
        label: 'REPLY',
        value:
          conversation.status === 'playing'
            ? 'STREAMING'
            : conversation.responseText
              ? 'BUFFERED'
              : 'IDLE',
      },
      {
        label: 'TRANSCRIPT',
        value:
          conversation.status === 'processing'
            ? 'LIVE'
            : conversation.transcript
              ? 'LOCKED'
              : 'EMPTY',
      },
      { label: 'STATUS', value: systemState.label.toUpperCase() },
    ],
    [
      conversation.playbackLevel,
      conversation.responseText,
      conversation.status,
      conversation.transcript,
      systemState.label,
    ],
  );

  const transcriptCopy =
    conversation.transcript ??
    (isEnabled
      ? 'Awaiting a captured speech segment from the live microphone.'
      : 'Activate the system to arm local speech detection.');
  const responseCopy =
    conversation.responseText ??
    (conversation.status === 'playing'
      ? 'Reply audio is currently streaming back into the reactor.'
      : 'Model output will stream here while the browser plays the synthesized reply.');
  const errorMessage = microphoneState.error ?? conversation.errorMessage;

  return (
    <section
      className="relative w-full h-full"
      data-mode={systemState.mode}
      id="jarvis"
    >
      <div className="absolute scanline" aria-hidden="true" />

      <div className="jarvis-shell__header">
        <div className="jarvis-shell__headline">
          <p>{systemState.detail}</p>
        </div>

        <div className="jarvis-shell__status">
          <div
            className={cx(
              'jarvis-shell__badge',
              systemState.tone === 'error'
                ? 'jarvis-shell__badge--error'
                : systemState.tone === 'attention'
                  ? 'jarvis-shell__badge--attention'
                  : undefined,
            )}
          >
            <PowerIcon />
            {systemState.label}
          </div>
          <button
            type="button"
            className={cx(
              'jarvis-shell__toggle',
              isEnabled ? 'jarvis-shell__toggle--active' : undefined,
            )}
            onClick={toggleEnabled}
          >
            {isEnabled ? (
              <StandbyIcon className="h-5 w-5" />
            ) : (
              <MicIcon className="h-5 w-5" />
            )}
            {isEnabled ? 'Stand down' : 'Activate system'}
          </button>
        </div>
      </div>

      <div className="jarvis-shell__center">
        <TelemetryList items={leftTelemetry} title="Sensor rail" />
        <JarvisOrb
          bars={motion.bars}
          energy={motion.energy}
          mode={systemState.mode}
        />
        <TelemetryList items={rightTelemetry} title="Output rail" />
      </div>

      <div className="jarvis-shell__panels">
        <div className="jarvis-panel">
          <div className="jarvis-panel__title">
            <MicIcon className="h-4 w-4" />
            Transcript
          </div>
          <p>{transcriptCopy}</p>
        </div>

        <div className="jarvis-panel">
          <div className="jarvis-panel__title">
            <OutputIcon className="h-4 w-4" />
            Reply stream
          </div>
          <p>{responseCopy}</p>
        </div>
      </div>

      {errorMessage ? (
        <div className="jarvis-shell__alert">{errorMessage}</div>
      ) : null}

      {shouldListen ? (
        <ActiveMicrophone
          onSpeechSegment={conversation.processSpeech}
          onStateChange={setMicrophoneState}
        />
      ) : null}
    </section>
  );
}
