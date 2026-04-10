import { connect } from 'amqplib';
import { debug } from './logging.js';

const log = debug('rabbitmq');

/**
 * @typedef {{
 *   taskId: string,
 *   taskTitle: string,
 *   taskLabels: string[],
 *   taskProjectId: string | null,
 *   previousLabel: string | null,
 *   newLabel: string | null,
 *   taskStatus: string
 * }} TransitionEvent
 */

/**
 * @typedef {{
 *   url: string,
 *   queuePrefix: string,
 *   enabled: boolean
 * }} RabbitConfig
 */

/**
 * @param {RabbitConfig} config
 */
export function createRabbitPublisher(config) {
  /** @type {any | null} */
  let connection = null;
  /** @type {Map<string, any>} */
  const channels = new Map();
  const PLAN_STATE = 'needs-planning';
  const EXECUTE_STATE = 'ready-for-dev';

  /**
   * @param {TransitionEvent} event
   * @returns {string | null}
   */
  function resolveQueueName(event) {
    if (event.newLabel === PLAN_STATE) {
      return `${config.queuePrefix}-plan`;
    }
    if (event.newLabel === EXECUTE_STATE) {
      return `${config.queuePrefix}-execute`;
    }
    return null;
  }

  /**
   * @param {string} queueName
   */
  async function ensureChannel(queueName) {
    if (!config.enabled) {
      return null;
    }
    const existingChannel = channels.get(queueName);
    if (existingChannel) {
      return existingChannel;
    }
    if (!connection) {
      connection = await connect(config.url);
    }
    const channel = await connection.createChannel();
    await channel.assertQueue(queueName, { durable: true });
    channels.set(queueName, channel);
    return channel;
  }

  return {
    isEnabled() {
      return Boolean(config.enabled);
    },
    /**
     * @param {TransitionEvent} event
     */
    async publishTransitionEvent(event) {
      if (!config.enabled) {
        return { ok: true };
      }
      const queueName = resolveQueueName(event);
      if (!queueName) {
        return { ok: true };
      }
      try {
        const ch = await ensureChannel(queueName);
        if (!ch) {
          return { ok: true };
        }
        const payload = Buffer.from(JSON.stringify(event), 'utf8');
        const sent = ch.sendToQueue(queueName, payload, { persistent: true });
        if (!sent) {
          return { ok: false, error: 'RabbitMQ sendToQueue returned false' };
        }
        return { ok: true };
      } catch (err) {
        log('publishTransitionEvent failed %o', err);
        return {
          ok: false,
          error:
            err && typeof err === 'object' && 'message' in err
              ? String(err.message || 'RabbitMQ publish failed')
              : 'RabbitMQ publish failed'
        };
      }
    },
    async close() {
      try {
        for (const channel of channels.values()) {
          await channel.close();
        }
      } catch {
        // ignore close errors
      } finally {
        channels.clear();
      }
      try {
        if (connection) {
          await connection.close();
        }
      } catch {
        // ignore close errors
      } finally {
        connection = null;
      }
    }
  };
}
