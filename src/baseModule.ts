import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
import { BufferManager, BufferOptions } from "./modules/buffer";

export interface BulkConsumerOptions<T> {
  clientId: string;
  brokers: string[];
  groupId: string;
  topic: string;
  batchSize?: number; // max items per bulk
  flushIntervalMs?: number; // max wait time before flush
  processBatch: (messages: T[]) => Promise<void>; // user-defined function
}

export class KafkaBulkConsumer<T = any> {
  private kafka: Kafka;
  private consumer: Consumer;
  private bufferManager: BufferManager;
  private timer?: NodeJS.Timeout;

  constructor(private options: BulkConsumerOptions<T>) {
    this.kafka = new Kafka({
      clientId: options.clientId,
      brokers: options.brokers,
    });
    this.bufferManager = new BufferManager({
      flushAction: options.processBatch,
      flushIntervalMs: options.flushIntervalMs,
      maxBufferItems: options.batchSize,
    } as BufferOptions);
    this.consumer = this.kafka.consumer({ groupId: options.groupId });
  }

  async start() {
    // Try connecting with retries/backoff because the broker may still be starting.
    const maxConnectRetries = 10;
    const baseDelayMs = 500; // initial backoff
    let attempt = 0;
    while (true) {
      try {
        await this.consumer.connect();
        break;
      } catch (err) {
        attempt++;
        if (attempt > maxConnectRetries) {
          console.error(`Failed to connect consumer after ${attempt} attempts`);
          throw err;
        }
        const delay = Math.min(10000, baseDelayMs * 2 ** (attempt - 1));
        console.warn(
          `Consumer connect failed (attempt ${attempt}/${maxConnectRetries}), retrying in ${delay}ms`,
          err
        );
        await new Promise((res) => setTimeout(res, delay));
      }
    }
    await this.consumer.subscribe({
      topic: this.options.topic,
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ message }: EachMessagePayload) => {
        const value = message.value?.toString();
        if (value) {
          try {
            this.bufferManager.push(value);
          } catch (err) {
            console.error("Failed to parse message:", value);
          }
        }
      },
    });
  }
  async stop() {
    if (this.timer) clearInterval(this.timer);
    await this.consumer.disconnect();
  }
}
export default KafkaBulkConsumer;
