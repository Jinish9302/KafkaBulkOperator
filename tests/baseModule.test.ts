import KafkaBulkConsumer from "../src/baseModule";

jest.useFakeTimers();

// Keep track of consumers created during tests so we can stop/disconnect them
let __testConsumers: any[] = [];

afterEach(async () => {
	for (const c of __testConsumers) {
		try {
			// stop() will clear interval and disconnect the Kafka consumer if connected
			await (c as any).stop();
		} catch (err) {
			// ignore errors during teardown
		}
	}
	__testConsumers = [];
});

describe("KafkaBulkConsumer (unit)", () => {
	test("flush calls processBatch with buffered messages and clears buffer", async () => {
		const processed: any[] = [];
		const consumer = new (KafkaBulkConsumer as any)({
			clientId: "test-client",
			brokers: ["127.0.0.1:9092"],
			groupId: "test-group",
			topic: "test-topic",
			batchSize: 3,
			flushIntervalMs: 10000,
			processBatch: async (messages: any[]) => {
				processed.push(...messages);
			},
		});

		// Track consumer for teardown
		__testConsumers.push(consumer);

		// Simulate receiving messages by pushing into buffer and calling private flush
		(consumer as any).bufferManager.push(1);
		(consumer as any).bufferManager.push(2);
		await (consumer as any).bufferManager.flush();

		expect(processed).toEqual([1, 2]);
		expect((consumer as any).bufferManager.buffer.length).toBe(0);
	});

	test("flush is not triggered before the interval elapses", async () => {
		const processed: any[] = [];
		const consumer = new (KafkaBulkConsumer as any)({
			clientId: "test-client",
			brokers: ["127.0.0.1:9092"],
			groupId: "test-group",
			topic: "test-topic",
			batchSize: 100,
			flushIntervalMs: 1000,
			processBatch: async (messages: any[]) => {
				processed.push(...messages);
			},
		});

		__testConsumers.push(consumer);
		(consumer as any).bufferManager.startFlushTimer();

		(consumer as any).bufferManager.buffer.push("x");
		// Advance only half the interval
		jest.advanceTimersByTime(500);

		// Allow any microtasks to run
		await Promise.resolve();
		await Promise.resolve();

		expect(processed).toEqual([]);

		// Now advance to full interval and assert flush happened
		jest.advanceTimersByTime(500);
		await Promise.resolve();
		await Promise.resolve();

		expect(processed).toEqual(["x"]);

		(global as any).clearInterval((consumer as any).timer);
	});

	test("timer flush triggers processBatch when interval elapses", async () => {
		const processed: any[] = [];
		const consumer = new (KafkaBulkConsumer as any)({
			clientId: "test-client",
			brokers: ["127.0.0.1:9092"],
			groupId: "test-group",
			topic: "test-topic",
			batchSize: 100,
			flushIntervalMs: 1000,
			processBatch: async (messages: any[]) => {
				processed.push(...messages);
			},
		});

		// Track consumer for teardown and start the timer (uses private startTimer)
		__testConsumers.push(consumer);
		(consumer as any).bufferManager.startFlushTimer();

		// Push messages and advance timers
		(consumer as any).bufferManager.push("a");
		(consumer as any).bufferManager.push("b");
		jest.advanceTimersByTime(1000);

		// Allow the scheduled async flush to run
		await Promise.resolve();
		await Promise.resolve();

		expect(processed).toEqual(["a", "b"]);

		// Clear interval to avoid leaving timers running
		(global as any).clearInterval((consumer as any).timer);
	});
});

