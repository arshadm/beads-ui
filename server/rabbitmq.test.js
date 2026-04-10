import { beforeEach, describe, expect, test, vi } from 'vitest';

const assert_queue = vi.fn(async () => {});
const send_to_queue = vi.fn(() => true);
const close_channel = vi.fn(async () => {});
const close_connection = vi.fn(async () => {});
const create_channel = vi.fn(async () => ({
  assertQueue: assert_queue,
  sendToQueue: send_to_queue,
  close: close_channel
}));
const connect = vi.fn(async () => ({
  createChannel: create_channel,
  close: close_connection
}));

vi.mock('amqplib', () => ({ connect }));

describe('rabbitmq publisher', async () => {
  const { createRabbitPublisher } = await import('./rabbitmq.js');

  beforeEach(() => {
    assert_queue.mockClear();
    send_to_queue.mockClear();
    close_channel.mockClear();
    close_connection.mockClear();
    create_channel.mockClear();
    connect.mockClear();
  });

  test('publishes needs-planning to {prefix}-plan queue', async () => {
    const publisher = createRabbitPublisher({
      url: 'amqp://localhost',
      queuePrefix: 'team-workflow',
      enabled: true
    });

    const res = await publisher.publishTransitionEvent({
      taskId: 'UI-1',
      taskTitle: 'Plan task',
      taskLabels: ['needs-planning', 'frontend'],
      taskProjectId: 'proj-1',
      previousLabel: 'created',
      newLabel: 'needs-planning',
      taskStatus: 'open'
    });

    expect(res.ok).toBe(true);
    expect(assert_queue).toHaveBeenCalledWith('team-workflow-plan', {
      durable: true
    });
    expect(send_to_queue).toHaveBeenCalledWith(
      'team-workflow-plan',
      expect.any(Buffer),
      { persistent: true }
    );
    const payload_buffer = /** @type {Buffer} */ (
      send_to_queue.mock.calls[0][1]
    );
    const payload_json = JSON.parse(payload_buffer.toString('utf8'));
    expect(payload_json).toEqual({
      taskId: 'UI-1',
      taskTitle: 'Plan task',
      taskLabels: ['needs-planning', 'frontend'],
      taskProjectId: 'proj-1',
      previousLabel: 'created',
      newLabel: 'needs-planning',
      taskStatus: 'open'
    });
  });

  test('publishes ready-for-dev to {prefix}-execute queue', async () => {
    const publisher = createRabbitPublisher({
      url: 'amqp://localhost',
      queuePrefix: 'team-workflow',
      enabled: true
    });

    const res = await publisher.publishTransitionEvent({
      taskId: 'UI-2',
      taskTitle: 'Execute task',
      taskLabels: ['ready-for-dev'],
      taskProjectId: null,
      previousLabel: 'planned',
      newLabel: 'ready-for-dev',
      taskStatus: 'open'
    });

    expect(res.ok).toBe(true);
    expect(assert_queue).toHaveBeenCalledWith('team-workflow-execute', {
      durable: true
    });
    expect(send_to_queue).toHaveBeenCalledWith(
      'team-workflow-execute',
      expect.any(Buffer),
      { persistent: true }
    );
  });

  test('ignores unrelated transition labels', async () => {
    const publisher = createRabbitPublisher({
      url: 'amqp://localhost',
      queuePrefix: 'team-workflow',
      enabled: true
    });

    const res = await publisher.publishTransitionEvent({
      taskId: 'UI-3',
      taskTitle: 'Unrelated task',
      taskLabels: ['in-progress'],
      taskProjectId: null,
      previousLabel: 'ready-for-dev',
      newLabel: 'in-progress',
      taskStatus: 'in_progress'
    });

    expect(res.ok).toBe(true);
    expect(connect).not.toHaveBeenCalled();
    expect(send_to_queue).not.toHaveBeenCalled();
  });
});
