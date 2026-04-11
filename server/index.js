import { createServer } from 'node:http';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { printServerUrl } from './cli/daemon.js';
import { getConfig } from './config.js';
import { resolveWorkspaceDatabase } from './db.js';
import { debug, enableAllDebug } from './logging.js';
import { createRabbitPublisher } from './rabbitmq.js';
import { registerWorkspace, watchRegistry } from './registry-watcher.js';
import { watchDb } from './watcher.js';
import { attachWsServer, setTransitionPublisher } from './ws.js';

if (process.argv.includes('--debug') || process.argv.includes('-d')) {
  enableAllDebug();
}

dotenv.config();

// Parse --host and --port from argv and set env vars before getConfig()
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '--host' && process.argv[i + 1]) {
    process.env.HOST = process.argv[++i];
  }
  if (process.argv[i] === '--port' && process.argv[i + 1]) {
    process.env.PORT = process.argv[++i];
  }
}

const config = getConfig();
const app = createApp(config);
const server = createServer(app);
const log = debug('server');
const rabbit_publisher = createRabbitPublisher(config.rabbitmq);
setTransitionPublisher(rabbit_publisher);
if (rabbit_publisher.isEnabled()) {
  console.log(
    'rabbitmq   enabled labels=[needs-planning, ready-for-dev] queues=[%s-plan, %s-execute]',
    config.rabbitmq.queuePrefix,
    config.rabbitmq.queuePrefix
  );
  log(
    'rabbitmq publishing enabled: labels=[needs-planning, ready-for-dev] queues=[%s-plan, %s-execute]',
    config.rabbitmq.queuePrefix,
    config.rabbitmq.queuePrefix
  );
} else {
  console.log(
    'rabbitmq   disabled (set RABBITMQ_URL and RABBITMQ_QUEUE to enable publishing)'
  );
  log('rabbitmq publishing disabled (set RABBITMQ_URL and RABBITMQ_QUEUE)');
}

// Register the initial workspace (from cwd) so it appears in the workspace picker
// even without the beads daemon running
const workspace_database = resolveWorkspaceDatabase({ cwd: config.root_dir });
if (workspace_database.source !== 'home-default' && workspace_database.exists) {
  registerWorkspace({
    path: config.root_dir,
    database: workspace_database.path
  });
}

// Watch the active beads DB and schedule subscription refresh for active lists
const db_watcher = watchDb(config.root_dir, () => {
  // Schedule subscription list refresh run for active subscriptions
  log('db change detected → schedule refresh');
  scheduleListRefresh();
  // v2: all updates flow via subscription push envelopes only
});

const { scheduleListRefresh, wss } = attachWsServer(server, {
  path: '/ws',
  heartbeat_ms: 30000,
  // Coalesce DB change bursts into one refresh run
  refresh_debounce_ms: 75,
  root_dir: config.root_dir,
  watcher: db_watcher
});

// Watch the global registry for workspace changes (e.g., when user starts
// bd daemon in a different project). This enables automatic workspace switching.
const registry_watcher = watchRegistry(
  (entries) => {
    log('registry changed: %d entries', entries.length);
    // Find if there's a newer workspace that matches our initial root
    // For now, we just log the change - users can switch via set-workspace
    // Future: could auto-switch if a workspace was started in a parent/child dir
  },
  { debounce_ms: 500 }
);

server.listen(config.port, config.host, () => {
  printServerUrl();
});

server.on('error', (err) => {
  log('server error %o', err);
  process.exitCode = 1;
});

let shutting_down = false;

/**
 * Close RabbitMQ with a time bound so a stuck broker cannot delay systemd restart.
 *
 * @param {number} budget_ms
 */
async function closeRabbitWithBudget(budget_ms) {
  try {
    await Promise.race([
      rabbit_publisher.close(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('rabbit close timeout'));
        }, budget_ms);
      })
    ]);
  } catch (err) {
    log('shutdown: rabbit close skipped or timed out %o', err);
  }
}

/**
 * Close listeners and watchers so the process can exit (systemd SIGTERM, Ctrl+C).
 *
 * @param {string} signal
 */
function gracefulShutdown(signal) {
  if (shutting_down) {
    process.exit(1);
  }
  shutting_down = true;
  log('received %s, shutting down', signal);

  registry_watcher.close();
  db_watcher.close();

  for (const ws of wss.clients) {
    try {
      ws.terminate();
    } catch {
      // ignore
    }
  }

  wss.close(() => {
    server.close(() => {
      void (async () => {
        try {
          const rabbit_ms = Number.parseInt(
            process.env.BDUI_SHUTDOWN_RABBIT_MS || '3000',
            10
          );
          const budget =
            Number.isFinite(rabbit_ms) && rabbit_ms > 0 ? rabbit_ms : 3000;
          await closeRabbitWithBudget(budget);
        } catch (err) {
          log('shutdown: error %o', err);
        } finally {
          process.exit(0);
        }
      })();
    });
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    gracefulShutdown(signal);
  });
}
