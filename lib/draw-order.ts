import { createHmac } from "node:crypto";

function deterministicIndex(seed: string, context: string, upperBound: number) {
  const digest = createHmac("sha256", seed).update(context).digest();
  const limit = Math.floor(0x100000000 / upperBound) * upperBound;
  for (let offset = 0; offset < 32; offset += 4) {
    const value = digest.readUInt32BE(offset);
    if (value < limit) return value % upperBound;
  }
  return deterministicIndex(seed, `${context}:retry`, upperBound);
}

export function generateNumbers(seed: string, assignedNumbers: number[]) {
  const pool = [...assignedNumbers].sort((a, b) => a - b);
  const selected: number[] = [];
  const count = pool.length;

  for (let position = 0; position < count; position += 1) {
    const index = deterministicIndex(seed, `prize:${position + 1}`, pool.length);
    selected.push(pool.splice(index, 1)[0]);
  }

  return selected;
}

export function resolveDrawOrder(seed: string, assignedNumbers: number[], prepared: { algorithm: string; numbers: number[] }) {
  if (prepared.algorithm === "hmac-sha256-registered-without-replacement-v2" && prepared.numbers.length === assignedNumbers.length) {
    return prepared.numbers;
  }
  return generateNumbers(seed, assignedNumbers);
}
