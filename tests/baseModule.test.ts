import { KafkaBulkConsumer } from "../src/baseModule";
import { Kafka, Producer, Admin, Partitioners } from "kafkajs";

// jest.useFakeTimers();
let consumer: KafkaBulkConsumer;
let producer: Producer;
let admin: Admin;
let kafka: Kafka;
let sampleSink: any[] = []
let testInitialize = async () => {
  kafka = new Kafka({
    clientId: "test-client",
    brokers: ["127.0.0.1:9092"],
  });
  admin = kafka.admin();
  producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner,
  });
  consumer = new (KafkaBulkConsumer as any)({
    clientId: "test-client",
    brokers: ["127.0.0.1:9092"],
    groupId: "test-group",
    topic: "test-topic",
    batchSize: 10,
    flushIntervalMs: 1000,
    flushAction: async (messages: any[]) => {
      console.log("recieved messages: ", messages)
      sampleSink.push(...messages);
    },
  });
  try {
    await admin.connect();
  } catch (err) {
    console.error("Failed to connect to Kafka Admin:", err);
  }
  try {
    await producer.connect();
  } catch (err) {
    console.error("Failed to connect to Kafka Producer:", err);
  }
  try {
    await consumer.start();
  } catch (err) {
    console.error("Failed to connect to Kafka Consumer:", err);
  }
  try {
    if (!(await admin.listTopics()).includes("test-topic")) {
      await admin.createTopics({
        topics: [
          { topic: "test-topic", numPartitions: 1, replicationFactor: 1 },
        ],
      });
    } else {
      console.log("test-topic already exists");
    }
  } catch (err) {
    console.error("Failed to create Kafka topic:", err);
  }
};

let testCleanup = async () => {
  await producer.disconnect();
  await admin.disconnect();
  await consumer.stop();
};

beforeAll(() => {
  return testInitialize();
}, 20000);

afterAll(() => {
  return testCleanup();
}, 20000);

describe("KafkaBulkConsumer (unit)", () => {
  it("consumer should be defined", () => {
    expect(consumer).toBeDefined();
  });

  it("consumer should connect after consumer.start()", async () => {
    expect(consumer.isConnected).toBe(true);
  });

  it("consumer should be able to process the messages after threshold is reached", async () => {
    sampleSink = [];
    await producer.send({
      topic: "test-topic",
      messages: [
        { value: "0" },
        { value: "1" },
        { value: "2" },
        { value: "3" },
        { value: "4" },
        { value: "5" },
        { value: "6" },
        { value: "7" },
        { value: "8" },
        { value: "9" }
      ],
    })
    await new Promise((resolve) => setTimeout(resolve, 50));
    sampleSink.sort()
    expect(sampleSink).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });
  it("consumer should flush the buffer on flush()", async () => {
    sampleSink = [];
    await producer.send({
      topic: "test-topic",
      messages: [
        { value: "0" },
        { value: "1" },
        { value: "2" }
      ],
    })
    await new Promise((resolve) => setTimeout(resolve, 50));
    await consumer.flush();
    sampleSink.sort()
    expect(sampleSink).toEqual(["0", "1", "2"]);
  })
  it("consumer should disconnect and flush the buffer on stop", async () => {
    sampleSink = [];
    await producer.send({
      topic: "test-topic",
      messages: [
        { value: "0" },
        { value: "1" },
        { value: "2" }
      ],
    })
    await new Promise((resolve) => setTimeout(resolve, 50));
    await consumer.stop();
    expect(consumer.isConnected).toBe(false);
    sampleSink.sort()
    expect(sampleSink).toEqual(["0", "1", "2"]);
  }, 10000)
});
