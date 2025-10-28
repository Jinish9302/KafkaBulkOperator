# KafkaBulkOperator

A small helper to consume Kafka messages in configurable bulk batches and process them with a user-supplied async handler. Designed to be simple to drop into Node.js + TypeScript projects using kafkajs.

## Install

Install from npm (when published) or use the package locally during development.

From npm:

```bash
npm install @jtriv9427/kafkabulkoperator
```

For local development (from this repository):

```bash
npm install
npm run build
# You can `npm link` or import from the built `dist` directory during local testing
```

## Quick usage

Here's a minimal example that consumes messages, batches them, and logs each batch.

TypeScript example

```ts
import KafkaBulkConsumer from '@jtriv9427/kafkabulkoperator';

const consumer = new KafkaBulkConsumer<string>({
	clientId: 'my-app',
	brokers: ['127.0.0.1:9092'],
	groupId: 'my-group',
	topic: 'my-topic',
	batchSize: 100,
	flushIntervalMs: 5000,
	flushAction: async (messages) => {
		console.log('processing batch of', messages.length);
		// handle messages (e.g. write to DB, call external API)
	},
});

await consumer.start();

// Flush the buffer
await consumer.flush()
// Later, when shutting down
await consumer.stop();
```

JavaScript examples

ESM (node --experimental-modules or package.json type: "module"):

```js
import KafkaBulkConsumer from '@jtriv9427/kafkabulkoperator';

const consumer = new KafkaBulkConsumer({
	clientId: 'my-app',
	brokers: ['127.0.0.1:9092'],
	groupId: 'my-group',
	topic: 'my-topic',
	batchSize: 100,
	flushIntervalMs: 5000,
	flushAction: async (messages) => {
		console.log('processing batch of', messages.length);
	},
});

await consumer.start();

// Flush the buffer
await consumer.flush()
// Later, when shutting down
await consumer.stop();
```

CommonJS (require):

```js
// If the published package uses a default export, require may return an object
// where the class is on `.default`. Use the fallback shown below to support both shapes.
const pkg = require('@jtriv9427/kafkabulkoperator');
const KafkaBulkConsumer = pkg.default || pkg;

const consumer = new KafkaBulkConsumer({
	clientId: 'my-app',
	brokers: ['127.0.0.1:9092'],
	groupId: 'my-group',
	topic: 'my-topic',
	batchSize: 100,
	flushIntervalMs: 5000,
	flushAction: async (messages) => {
		console.log('processing batch of', messages.length);
	},
});

await consumer.start();

// Flush the buffer
await consumer.flush()
// Later, when shutting down
await consumer.stop();
```

Notes:
- Use `127.0.0.1` instead of `localhost` on Windows CI/hosts if you run a local Kafka container — it avoids IPv6 (::1) resolution issues.

## API / Options

TypeScript type (approx):

- `clientId: string` — Kafka client id.
- `brokers: string[]` — list of broker addresses (e.g. `['127.0.0.1:9092']`).
- `groupId: string` — consumer group id.
- `topic: string` — topic to subscribe to.
- `batchSize?: number` — maximum messages per batch (default: 50).
- `flushIntervalMs?: number` — maximum time in ms to wait before flushing buffered messages (default: 5000).
- `flushAction: (messages: T[]) => Promise<void>` — async handler that receives an array of buffered messages.

Behavior:
- Buffer messages in memory until `batchSize` is reached or `flushIntervalMs` elapses, then call `flushAction` with the current buffer.
- On consumer start we attempt to connect with retries/backoff to tolerate broker startup races.

## Development

- Build: `npm run build` (runs `tsc`)
- Tests: `npm test` (uses Jest + ts-jest)
- Lint: if you have ESLint installed, run `npm run lint` (project contains a `.eslintrc.js` — use ESLint v8 or migrate to v9 flat config).

## Publishing

The repository includes a GitHub Actions workflow at `.github/workflows/publish.yml` that can be used to create a manual release and publish to npm. The workflow:

- Bumps the version using `npm version` (the workflow currently updates `package.json` and commits the bump).
- Creates and pushes an annotated tag `v<version>`.
- Runs the build and publishes to npm using the `NPM_TOKEN` secret.

If you plan to use `npm ci` in CI reliably, commit `package-lock.json` to the repository so installs are reproducible.

Note about approvals:
- The GitHub Actions workflow used for publishing targets the `production` environment and is configured to require manual approval before it can run the publish steps. That means a repository owner or an environment approver must approve the workflow run before the package is actually published to npm.



## Notes & troubleshooting

- If the consumer logs connection errors while Kafka is starting (ECONNREFUSED/ECONNRESET), the built-in connect retry should help. Check that your broker is reachable and advertised listeners are configured correctly in Docker.
- When running Kafka in Docker on Windows, prefer `127.0.0.1:9092` for host connectivity rather than `localhost` to avoid IPv6 resolution issues.
