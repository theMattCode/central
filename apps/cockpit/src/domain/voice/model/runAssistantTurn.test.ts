import { describe, expect, it } from 'vitest';
import { extractSseEvents } from 'src/domain/voice/model/runAssistantTurn.ts';

describe('extractSseEvents', () => {
  it('parses multiple event frames from a single buffer', () => {
    const payload =
      'event: transcript\ndata: {"transcript":"Hallo"}\n\n' +
      'event: response_delta\ndata: {"delta":" Welt"}\n\n';

    expect(extractSseEvents(payload)).toEqual({
      buffer: '',
      events: [
        {
          data: '{"transcript":"Hallo"}',
          event: 'transcript',
        },
        {
          data: '{"delta":" Welt"}',
          event: 'response_delta',
        },
      ],
    });
  });

  it('keeps incomplete trailing frames in the buffer', () => {
    const payload = 'event: transcript\r\ndata: {"transcript":"Hal';

    expect(extractSseEvents(payload)).toEqual({
      buffer: payload,
      events: [],
    });
  });
});
