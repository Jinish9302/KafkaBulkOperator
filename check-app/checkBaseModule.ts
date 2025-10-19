import KafkaBulkConsumer from "../src/modules/baseModule";

let consumer = new KafkaBulkConsumer({
  clientId: "test-client",
  // Use IPv4 loopback to avoid Windows resolving localhost to ::1 (IPv6) which may be refused
  brokers: ["127.0.0.1:9092"],
  groupId: "test-group",
  topic: "test-topic",
  batchSize: 10,
  flushIntervalMs: 10000,
  processBatch: async (messages: any[]) => {
    console.log("Processing batch of messages:", messages);
  }}
);

consumer.start().catch(console.error);
