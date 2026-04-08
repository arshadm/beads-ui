import { connect } from 'amqplib';
import { debug } from './logging.js';

const log = debug('rabbitmq');

/**
 * @typedef {{
 *   taskId: string,
 *   previousLabel: string | null,
 *   newLabel: string | null,
 *   taskStatus: string
 * }} TransitionEvent
 */

/**
 * @typedef {{
 *   url: string,
 *   queue: string,
 *   enabled: boolean
 * }} RabbitConfig
 */

/**
 * @param {RabbitConfig} config
 */
export function createRabbitPublisher(config) {
  /** @type {any | null} */
  let connection = null;
  /** @type {any | null} */
  let channel = null;

  async function ensureChannel() {
    if (!config.enabled) {
      return null;
    }
    if (channel) {
      return channel;
    }
    connection = await connect(config.url);
    channel = await connection.createChannel();
    await channel.assertQueue(config.queue, { durable: true });
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
      try {
        const ch = await ensureChannel();
        if (!ch) {
          return { ok: true };
        }
        const payload = Buffer.from(JSON.stringify(event), 'utf8');
        const sent = ch.sendToQueue(config.queue, payload, { persistent: true });
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
        if (channel) {
          await channel.close();
        }
      } catch {
        // ignore close errors
      } finally {
        channel = null;
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
