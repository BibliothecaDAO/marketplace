type WaitForIndexedBlockOptions = {
  receiptBlock: number;
  getIndexedBlock(): Promise<number>;
  timeoutMs?: number;
  pollIntervalMs?: number;
  now?: () => number;
  sleep?: (durationMs: number) => Promise<void>;
};

export async function waitForIndexedBlock({
  receiptBlock,
  getIndexedBlock,
  timeoutMs = 60_000,
  pollIntervalMs = 1_000,
  now = Date.now,
  sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration)),
}: WaitForIndexedBlockOptions): Promise<{ indexed: boolean; indexedBlock: number }> {
  const startedAt = now();
  let indexedBlock = 0;
  while (now() - startedAt < timeoutMs) {
    try {
      indexedBlock = await getIndexedBlock();
      if (indexedBlock >= receiptBlock) return { indexed: true, indexedBlock };
    } catch {
      // A transient status failure does not change the confirmed onchain result.
    }
    await sleep(pollIntervalMs);
  }
  return { indexed: false, indexedBlock };
}
