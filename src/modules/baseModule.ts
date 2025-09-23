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
  private buffer: T[] = [];
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
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.options.topic, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ message }: EachMessagePayload) => {
        const value = message.value?.toString();
        if (value) {
          try {
            const parsed: T = JSON.parse(value);
            this.buffer.push(parsed);
          } catch (err) {
            console.error("Failed to parse message:", value);
          }
        }

        if (this.buffer.length >= this.batchSize) {
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
