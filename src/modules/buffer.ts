export interface BufferOptions<T> {
  maxBufferItems?: number;
  maxBufferSizeInBytes?: number;
  flushIntervalMs?: number;
  customThresholds?: Array<(buffer: T[]) => boolean>; // list of user-defined threshold functions that take the current buffer as argument and return boolean
  flushAction: (batch: T[]) => Promise<void>; // callback when threshold is reached with array of buffered items on argument
}
export class BufferManager<T> {
  private maxBufferItems?: number;
  private maxBufferSizeInBytes?: number;
  private customThresholds?: Array<(buffer: T[]) => boolean>; // list of user-defined threshold functions
  private bufferSizeInBytes: number = 0;
  private flushIntervalMs?: number;
  private flushTimer?: NodeJS.Timeout;
  private flushAction: (buffer: T[]) => Promise<void> | void; // expect a promis<void> return type or a void return type
  private buffer: T[] = [];
  constructor(private options: BufferOptions<T>) {
    if (
      !options.maxBufferItems &&
      !options.maxBufferSizeInBytes &&
      !options.flushIntervalMs &&
      (!options.customThresholds ||
      options.customThresholds.length == 0)
    ) {
      throw new Error(
        "At least one threshold option from flushIntervalMs, maxBufferItems, maxBufferSizeInBytes or customThresholds (non-empty array of functions) must be specified"
      );
    }
    this.flushIntervalMs = options.flushIntervalMs;
    this.maxBufferItems = options.maxBufferItems;
    this.maxBufferSizeInBytes = options.maxBufferSizeInBytes;
    this.customThresholds = options.customThresholds;
    this.flushAction = options.flushAction;
    this.startFlushTimer();
  }
  getMaxBufferSizeInBytes() {
    return this.maxBufferSizeInBytes;
  }
  updateMaxBufferSizeInBytes(newMaxBufferSizeInBytes: number) {
    this.bufferSizeInBytes = newMaxBufferSizeInBytes;
  }
  getMaxBufferItems() {
    return this.maxBufferItems;
  }
  updateMaxBufferItems(newMaxBufferItems: number) {
    this.maxBufferItems = newMaxBufferItems;
  }


  private startFlushTimer() {
    if (!this.flushIntervalMs) return;
    this.flushTimer = setInterval(async () => {
      if (this.buffer.length > 0) {
        await this.flush();
      }
    }, this.flushIntervalMs);
  }
  clearFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }
  private updateFlushTimer() {
    this.clearFlushTimer();
    this.startFlushTimer();
  }
  getFlushIntervalMs() {
    return this.flushIntervalMs;
  }
  updateFlushIntervalMs(newFlushIntervalMs: number) {
    this.flushIntervalMs = newFlushIntervalMs;
    this.updateFlushTimer();
  }
  updateCustomThresholds(newCustomThresholds: Array<(buffer: T[]) => boolean>) {
    this.customThresholds = newCustomThresholds;
  }
  isThresholdReached(): boolean {
    return (
      (this.maxBufferSizeInBytes &&
        this.bufferSizeInBytes >= this.maxBufferSizeInBytes) ||
      (this.maxBufferItems !== undefined &&
        this.buffer.length >= this.maxBufferItems) ||
      (this.customThresholds !== undefined &&
        this.customThresholds.some((fn) => fn(this.buffer)))
    );
  }
  async flush() {
    const batch = [...this.buffer];
    this.buffer = [];
    try {
      await this.flushAction(batch);
    } catch (err) {
      console.error("Error processing the buffer:", err);
    }
  }
  push(item: T) {
    this.buffer.push(item);
    if (this.isThresholdReached()) {
      this.flush();
    }
  }
}
