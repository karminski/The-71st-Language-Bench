export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
  }
  return next;
}

/**
 * Largest-remainder allocation so every category keeps a fair share.
 * n <= 0 means "no sampling" (return the original list).
 */
export function stratifiedSample<T>(
  items: T[],
  n: number,
  keyFn: (item: T) => string,
  seed: number,
): T[] {
  if (n <= 0 || n >= items.length) return items;
  const rng = mulberry32(seed);
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  const total = items.length;
  const keys = [...groups.keys()].sort();
  const quotas = keys.map((key) => {
    const size = groups.get(key)!.length;
    const exact = (n * size) / total;
    return { key, size, floor: Math.floor(exact), frac: exact - Math.floor(exact) };
  });

  let remaining = n - quotas.reduce((sum, q) => sum + q.floor, 0);
  quotas.sort((a, b) => b.frac - a.frac || a.key.localeCompare(b.key));
  for (const quota of quotas) {
    if (remaining <= 0) break;
    if (quota.floor < quota.size) {
      quota.floor += 1;
      remaining -= 1;
    }
  }

  const picked: T[] = [];
  for (const quota of quotas) {
    const shuffled = shuffle(groups.get(quota.key)!, rng);
    picked.push(...shuffled.slice(0, quota.floor));
  }
  return picked;
}
