# SDK Efficiency Benchmark

Use the benchmark harness to compare browse-path performance before/after SDK efficiency changes.

## Command

```bash
node scripts/bench/sdk-efficiency.mjs \
  --samples 7 \
  --out .context/sdk-efficiency-report.json \
  --target home=http://127.0.0.1:3000/ \
  --target collection=http://127.0.0.1:3000/collections/<address>
```

## Output Schema

The report is written as JSON with:

- `generatedAt`
- `samplesPerTarget`
- `targets[]`
- Per target: `requestCount`, `successCount`, `errorCount`, `p50LatencyMs`, `p95LatencyMs`, `totalBytes`, `averageBytes`, `errors[]`

## Notes

- Run with the same routes and sample counts for before/after comparisons.
- Keep benchmark artifacts in `.context/` for agent collaboration and CI diffing.
