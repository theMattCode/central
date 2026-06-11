import { getLogger } from '@/domain/voice/log.ts';
import type {
  AssistantTurnInput,
  AssistantTurnResult,
  AssistantTurnStreamResult,
} from 'src/domain/voice/model/model.ts';

const ASSISTANT_TURN_DUMP_DIRECTORY_NAME = 'tmp';

const AUDIO_FILE_EXTENSION_BY_MIME_TYPE: Readonly<Record<string, string>> = {
  'audio/flac': 'flac',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
};

export function toAudioFileExtension(mimeType: string): string {
  return AUDIO_FILE_EXTENSION_BY_MIME_TYPE[mimeType.toLowerCase()] ?? 'bin';
}

export function createAssistantTurnDumpBaseName(
  timestamp: Date,
  turnId: string,
): string {
  return `${timestamp.toISOString().replaceAll(':', '-').replaceAll('.', '-')}-${turnId}`;
}

export async function dumpAssistantTurnArtifacts(
  input: AssistantTurnInput,
  result: AssistantTurnResult,
): Promise<void> {
  if (typeof window !== 'undefined') {
    return;
  }

  const [{ Buffer }, { randomUUID }, { mkdir, writeFile }, { join }] =
    await Promise.all([
      import('node:buffer'),
      import('node:crypto'),
      import('node:fs/promises'),
      import('node:path'),
    ]);

  const dumpDirectory = join(process.cwd(), ASSISTANT_TURN_DUMP_DIRECTORY_NAME);
  await mkdir(dumpDirectory, { recursive: true });

  const inputBuffer = Buffer.from(input.audioBase64, 'base64');
  const outputBuffer = Buffer.from(result.audioBase64, 'base64');
  const dumpBaseName = createAssistantTurnDumpBaseName(
    new Date(),
    randomUUID(),
  );
  const inputFilePath = join(
    dumpDirectory,
    `${dumpBaseName}-input.${toAudioFileExtension(input.audioMimeType)}`,
  );
  const outputFilePath = join(
    dumpDirectory,
    `${dumpBaseName}-output.${toAudioFileExtension(result.audioMimeType)}`,
  );
  const metadataFilePath = join(dumpDirectory, `${dumpBaseName}.json`);

  await Promise.all([
    writeFile(inputFilePath, inputBuffer),
    writeFile(outputFilePath, outputBuffer),
    writeFile(
      metadataFilePath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          inputAudioByteLength: inputBuffer.byteLength,
          inputAudioMimeType: input.audioMimeType,
          outputAudioByteLength: outputBuffer.byteLength,
          outputAudioMimeType: result.audioMimeType,
          responseText: result.responseText,
          transcript: result.transcript,
        },
        null,
        2,
      ),
      'utf8',
    ),
  ]);

  getLogger().info('dumped-assistant-turn-artifacts', {
    dumpDirectory,
    inputAudioByteLength: inputBuffer.byteLength,
    inputFilePath,
    metadataFilePath,
    outputAudioByteLength: outputBuffer.byteLength,
    outputFilePath,
  });
}

export async function dumpAssistantTurnStreamArtifacts(
  input: AssistantTurnInput,
  result: AssistantTurnStreamResult,
): Promise<void> {
  if (typeof window !== 'undefined') {
    return;
  }

  const [{ Buffer }, { randomUUID }, { mkdir, writeFile }, { join }] =
    await Promise.all([
      import('node:buffer'),
      import('node:crypto'),
      import('node:fs/promises'),
      import('node:path'),
    ]);

  const dumpDirectory = join(process.cwd(), ASSISTANT_TURN_DUMP_DIRECTORY_NAME);
  await mkdir(dumpDirectory, { recursive: true });

  const inputBuffer = Buffer.from(input.audioBase64, 'base64');
  const dumpBaseName = createAssistantTurnDumpBaseName(
    new Date(),
    randomUUID(),
  );
  const inputFilePath = join(
    dumpDirectory,
    `${dumpBaseName}-input.${toAudioFileExtension(input.audioMimeType)}`,
  );
  const metadataFilePath = join(dumpDirectory, `${dumpBaseName}.json`);

  const outputFiles = result.audioChunks.map((chunk) => {
    const outputFilePath = join(
      dumpDirectory,
      `${dumpBaseName}-output-${String(chunk.chunkIndex).padStart(2, '0')}.${toAudioFileExtension(chunk.audioMimeType)}`,
    );

    return {
      audioByteLength: Buffer.from(chunk.audioBase64, 'base64').byteLength,
      audioMimeType: chunk.audioMimeType,
      chunkIndex: chunk.chunkIndex,
      outputFilePath,
      text: chunk.text,
    };
  });

  await Promise.all([
    writeFile(inputFilePath, inputBuffer),
    ...result.audioChunks.map((chunk) =>
      writeFile(
        join(
          dumpDirectory,
          `${dumpBaseName}-output-${String(chunk.chunkIndex).padStart(2, '0')}.${toAudioFileExtension(chunk.audioMimeType)}`,
        ),
        Buffer.from(chunk.audioBase64, 'base64'),
      ),
    ),
    writeFile(
      metadataFilePath,
      JSON.stringify(
        {
          audioChunkCount: result.audioChunks.length,
          createdAt: new Date().toISOString(),
          inputAudioByteLength: inputBuffer.byteLength,
          inputAudioMimeType: input.audioMimeType,
          outputFiles,
          responseText: result.responseText,
          transcript: result.transcript,
        },
        null,
        2,
      ),
      'utf8',
    ),
  ]);

  getLogger().info('dumped-streamed-assistant-turn-artifacts', {
    audioChunkCount: result.audioChunks.length,
    dumpDirectory,
    inputAudioByteLength: inputBuffer.byteLength,
    inputFilePath,
    metadataFilePath,
  });
}
