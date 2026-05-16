import { describe, it, expect } from 'vitest';
import { createSSEStream, subscribeToRoom, publishToRoom } from '../sse';

describe('sse', () => {
  it('subscribeToRoom returns unsubscribe function', () => {
    const unsub = subscribeToRoom('R1', () => {});
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('publishToRoom calls all listeners in the room', () => {
    const received: unknown[] = [];
    const u1 = subscribeToRoom('R2', (e) => received.push(e.data));
    const u2 = subscribeToRoom('R2', (e) => received.push(e.data));
    publishToRoom('R2', { type: 't', data: { v: 42 } });
    expect(received).toEqual([{ v: 42 }, { v: 42 }]);
    u1(); u2();
  });

  it('publishToRoom does not call listeners in other rooms', () => {
    const received: unknown[] = [];
    subscribeToRoom('RA', (e) => received.push(e.data));
    publishToRoom('RB', { type: 't', data: 'nope' });
    expect(received).toHaveLength(0);
  });

  it('unsubscribe removes listener', () => {
    let count = 0;
    const unsub = subscribeToRoom('R3', () => { count++; });
    publishToRoom('R3', { type: 't', data: null });
    expect(count).toBe(1);
    unsub();
    publishToRoom('R3', { type: 't', data: null });
    expect(count).toBe(1);
  });

  it('createSSEStream creates a ReadableStream', () => {
    const stream = createSSEStream((_send, close) => close());
    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it('createSSEStream produces valid SSE text', async () => {
    const stream = createSSEStream((send, close) => {
      send({ type: 'vote', data: { count: 5 } });
      close();
    });

    const text = await new Response(stream).text();
    expect(text).toContain('event: vote');
    expect(text).toContain('"count":5');
  });
});
