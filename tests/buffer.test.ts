import { BufferManager } from "../src/modules/buffer";

jest.useFakeTimers()

describe("BufferManager", () => {
  it("should throw an error if insufficient threshold options are specified", () => {
    expect(() => new BufferManager({flushAction: async () => {}}))
    .toThrow(
      "At least one threshold option from flushIntervalMs, maxBufferItems, maxBufferSizeInBytes or customThresholds (non-empty array of functions) must be specified"
    );
  });

  it("should start the flush timer when the flushIntervalMs option is specified", async() => {
    const flushIntervalMs = 1000;
    const flushActionMock = jest.fn(async () => {});
    const bufferManager = new BufferManager({ flushIntervalMs, flushAction: flushActionMock});
    bufferManager.push(1);
    jest.advanceTimersByTime(flushIntervalMs);
    expect(flushActionMock).toHaveBeenCalledTimes(1);
  });

  it("should update the flush timer when the flushIntervalMs option is updated", () => {
    const flushIntervalMs1 = 1000;
    const flushIntervalMs2 = 2000;
    const flushActionMock = jest.fn(async () => {});
    const bufferManager = new BufferManager({ flushIntervalMs: flushIntervalMs2, flushAction: flushActionMock });
    bufferManager.updateFlushIntervalMs(flushIntervalMs1);
    bufferManager.push(1);
    jest.advanceTimersByTime(flushIntervalMs1);
    expect(flushActionMock).toHaveBeenCalledTimes(1);
  });

  it("should not flush the buffer if the threshold is not reached", async () => {
    const bufferManager = new BufferManager({ maxBufferItems: 10, flushAction: async () => {} });
    const flushSpy = jest.spyOn(bufferManager, "flush");
    bufferManager.push(1);
    bufferManager.push(2);
    expect(flushSpy).not.toHaveBeenCalled();
  });

  it("should flush the buffer if the threshold is reached", async () => {
    const bufferManager = new BufferManager({ maxBufferItems: 10, flushAction: async () => {} });
    const flushSpy = jest.spyOn(bufferManager, "flush");
    for (let i = 0; i < 10; i++) {
      bufferManager.push(i);
    }
    expect(flushSpy).toHaveBeenCalledTimes(1);
  });
});
