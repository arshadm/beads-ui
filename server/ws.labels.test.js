import { beforeEach, describe, expect, test, vi } from 'vitest';
import { runBd, runBdJson } from './bd.js';
import { handleMessage, setTransitionPublisher } from './ws.js';

vi.mock('./bd.js', () => ({
  runBd: vi.fn(),
  runBdJson: vi.fn()
}));

function makeStubSocket() {
  return {
    sent: /** @type {string[]} */ ([]),
    readyState: 1,
    OPEN: 1,
    /** @param {string} msg */
    send(msg) {
      this.sent.push(String(msg));
    }
  };
}

describe('ws labels handlers', () => {
  beforeEach(() => {
    /** @type {import('vitest').Mock} */ (runBd).mockReset();
    /** @type {import('vitest').Mock} */ (runBdJson).mockReset();
    setTransitionPublisher(null);
  });

  test('no rabbit publisher configured still succeeds', async () => {
    setTransitionPublisher(null);
    const rb = /** @type {import('vitest').Mock} */ (runBd);
    const rj = /** @type {import('vitest').Mock} */ (runBdJson);
    rb.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' });
    rj.mockResolvedValueOnce({
      code: 0,
      stdoutJson: { id: 'UI-1', labels: ['frontend'], status: 'open' }
    });

    const ws = makeStubSocket();
    await handleMessage(
      /** @type {any} */ (ws),
      Buffer.from(
        JSON.stringify({
          id: 'a0',
          type: /** @type {any} */ ('label-add'),
          payload: { id: 'UI-1', label: 'frontend' }
        })
      )
    );
    const obj = JSON.parse(ws.sent[ws.sent.length - 1]);
    expect(obj.ok).toBe(true);
  });

  test('label-add validates payload', async () => {
    const ws = makeStubSocket();
    await handleMessage(
      /** @type {any} */ (ws),
      Buffer.from(
        JSON.stringify({
          id: 'x',
          type: /** @type {any} */ ('label-add'),
          payload: {}
        })
      )
    );
    const obj = JSON.parse(ws.sent[0]);
    expect(obj.ok).toBe(false);
    expect(obj.error.code).toBe('bad_request');
  });

  test('label-add publishes when transitioning to needs-planning', async () => {
    const rb = /** @type {import('vitest').Mock} */ (runBd);
    const rj = /** @type {import('vitest').Mock} */ (runBdJson);
    rb.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' });
    rj.mockResolvedValueOnce({
      code: 0,
      stdoutJson: { id: 'UI-1', labels: ['needs-planning'], status: 'open' }
    });

    const ws = makeStubSocket();
    const publish = vi.fn(async () => ({ ok: true }));
    setTransitionPublisher({
      isEnabled: () => true,
      publishTransitionEvent: publish
    });
    await handleMessage(
      /** @type {any} */ (ws),
      Buffer.from(
        JSON.stringify({
          id: 'a',
          type: /** @type {any} */ ('label-add'),
          payload: { id: 'UI-1', label: 'needs-planning' }
        })
      )
    );

    const call = rb.mock.calls[0][0];
    expect(call.slice(0, 3)).toEqual(['label', 'add', 'UI-1']);
    expect(publish).toHaveBeenCalledWith({
      taskId: 'UI-1',
      previousLabel: null,
      newLabel: 'needs-planning',
      taskStatus: 'open'
    });
    const obj = JSON.parse(ws.sent[ws.sent.length - 1]);
    expect(obj.ok).toBe(true);
    expect(obj.payload && obj.payload.id).toBe('UI-1');
  });

  test('label-remove does not publish when leaving unrelated label', async () => {
    const rb = /** @type {import('vitest').Mock} */ (runBd);
    const rj = /** @type {import('vitest').Mock} */ (runBdJson);
    rb.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' });
    rj.mockResolvedValueOnce({
      code: 0,
      stdoutJson: { id: 'UI-1', labels: [], status: 'open' }
    });

    const ws = makeStubSocket();
    const publish = vi.fn(async () => ({ ok: true }));
    setTransitionPublisher({
      isEnabled: () => true,
      publishTransitionEvent: publish
    });
    await handleMessage(
      /** @type {any} */ (ws),
      Buffer.from(
        JSON.stringify({
          id: 'b',
          type: /** @type {any} */ ('label-remove'),
          payload: { id: 'UI-1', label: 'frontend' }
        })
      )
    );

    const call = rb.mock.calls[rb.mock.calls.length - 1][0];
    expect(call.slice(0, 3)).toEqual(['label', 'remove', 'UI-1']);
    expect(publish).not.toHaveBeenCalled();
    const obj = JSON.parse(ws.sent[ws.sent.length - 1]);
    expect(obj.ok).toBe(true);
    expect(obj.payload && obj.payload.id).toBe('UI-1');
  });

  test('label-add fails when rabbit publish fails for ready-for-dev', async () => {
    const rb = /** @type {import('vitest').Mock} */ (runBd);
    const rj = /** @type {import('vitest').Mock} */ (runBdJson);
    rb.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' });
    rj.mockResolvedValueOnce({
      code: 0,
      stdoutJson: { id: 'UI-1', labels: ['ready-for-dev'], status: 'open' }
    });
    setTransitionPublisher({
      isEnabled: () => true,
      publishTransitionEvent: async () => ({ ok: false, error: 'rabbit down' })
    });

    const ws = makeStubSocket();
    await handleMessage(
      /** @type {any} */ (ws),
      Buffer.from(
        JSON.stringify({
          id: 'a-fail',
          type: /** @type {any} */ ('label-add'),
          payload: { id: 'UI-1', label: 'ready-for-dev' }
        })
      )
    );
    const obj = JSON.parse(ws.sent[ws.sent.length - 1]);
    expect(obj.ok).toBe(false);
    expect(obj.error.code).toBe('bd_error');
    expect(obj.error.message).toContain('rabbit down');
  });
});
