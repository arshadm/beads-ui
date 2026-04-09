import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve runtime configuration for the server.
 * Notes:
 * - `app_dir` is resolved relative to the installed package location.
 * - `root_dir` represents the directory where the process was invoked
 * (i.e., the current working directory) so DB resolution follows the
 * caller's context rather than the install location.
 *
 * @returns {{ host: string, port: number, app_dir: string, root_dir: string, url: string, rabbitmq: { url: string, queuePrefix: string, enabled: boolean } }}
 */
export function getConfig() {
  const this_file = fileURLToPath(new URL(import.meta.url));
  const server_dir = path.dirname(this_file);
  const package_root = path.resolve(server_dir, '..');
  // Always reflect the directory from which the process was started
  const root_dir = process.cwd();

  let port_value = Number.parseInt(process.env.PORT || '', 10);
  if (!Number.isFinite(port_value)) {
    port_value = 3000;
  }

  const host_env = process.env.HOST;
  const host_value = host_env && host_env.length > 0 ? host_env : '127.0.0.1';
  const rabbitmq_url = String(process.env.RABBITMQ_URL || '').trim();
  const rabbitmq_queue_prefix = String(process.env.RABBITMQ_QUEUE || '').trim();

  return {
    host: host_value,
    port: port_value,
    app_dir: path.resolve(package_root, 'app'),
    root_dir,
    url: `http://${host_value}:${port_value}`,
    rabbitmq: {
      url: rabbitmq_url,
      queuePrefix: rabbitmq_queue_prefix,
      enabled: rabbitmq_url.length > 0 && rabbitmq_queue_prefix.length > 0
    }
  };
}
