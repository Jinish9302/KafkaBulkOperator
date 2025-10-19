import { Kafka, Consumer, EachMessagePayload } from "kafkajs";

export interface BulkConsumerOptions<T> {
  clientId: string;
  brokers: string[];
  groupId: string;
  topic: string;
  batchSize?: number;       // max items per bulk
  flushIntervalMs?: number; // max wait time before flush
  processBatch: (messages: T[]) => Promise<void>; // user-defined function
}

export class KafkaBulkConsumer<T = any> {
  private kafka: Kafka;
  private consumer: Consumer;
  private buffer: any[] = [];
  private batchSize: number;
  private flushIntervalMs: number;
  private timer?: NodeJS.Timeout;

  constructor(private options: BulkConsumerOptions<T>) {
    this.kafka = new Kafka({
      clientId: options.clientId,
      brokers: options.brokers,
    });

    this.consumer = this.kafka.consumer({ groupId: options.groupId });
    this.batchSize = options.batchSize || 50;
    this.flushIntervalMs = options.flushIntervalMs || 5000;
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
        console.warn(`Consumer connect failed (attempt ${attempt}/${maxConnectRetries}), retrying in ${delay}ms`, err);
        await new Promise((res) => setTimeout(res, delay));
      }
    }
    await this.consumer.subscribe({ topic: this.options.topic, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ message }: EachMessagePayload) => {
        const value = message.value?.toString();
        if (value) {
          try {
            this.buffer.push(value);
          } catch (err) {
            console.error("Failed to parse message:", value);
          }
        }

        if (this.buffer.length >= this.batchSize) {
          console.log(`Buffer reached batch size of ${this.batchSize}, flushing ${this.buffer.length} messages`);
          await this.flush();
        }
      },
    });

    this.startTimer();
  }

  private startTimer() {
    this.timer = setInterval(async () => {
      if (this.buffer.length > 0) {
        await this.flush();
      }
    }, this.flushIntervalMs);
  }

  private async flush() {
    const batch = [...this.buffer];
    this.buffer = [];

    try {
      await this.options.processBatch(batch);
    } catch (err) {
      console.error("Error processing batch:", err);
      // Retry logic can be added here
    }
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    await this.consumer.disconnect();
  }
}
export default KafkaBulkConsumer;