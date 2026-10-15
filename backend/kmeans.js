// 1D K-Means. Returns clusters sorted by centroid ascending.
function kmeans1D(values, k = 3, maxIter = 100) {
  const data = values.filter((v) => Number.isFinite(v));
  if (data.length === 0) return [];
  const distinct = [...new Set(data)].sort((a, b) => a - b);
  const kk = Math.min(k, distinct.length);

  // Deterministic init: spread centroids over the sorted distinct values.
  let centroids = Array.from({ length: kk }, (_, i) =>
    distinct[Math.round((i * (distinct.length - 1)) / Math.max(kk - 1, 1))]
  );
  let assign = new Array(data.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    data.forEach((v, i) => {
      let best = 0;
      for (let c = 1; c < kk; c++) {
        if (Math.abs(v - centroids[c]) < Math.abs(v - centroids[best])) best = c;
      }
      if (assign[i] !== best) { assign[i] = best; changed = true; }
    });
    const sums = new Array(kk).fill(0);
    const counts = new Array(kk).fill(0);
    data.forEach((v, i) => { sums[assign[i]] += v; counts[assign[i]]++; });
    centroids = centroids.map((c, j) => (counts[j] ? sums[j] / counts[j] : c));
    if (!changed && iter > 0) break;
  }

  const counts = new Array(kk).fill(0);
  assign.forEach((a) => counts[a]++);
  return centroids
    .map((c, j) => ({ centroid: Math.round(c * 100) / 100, count: counts[j] }))
    .filter((c) => c.count > 0)
    .sort((a, b) => a.centroid - b.centroid);
}

module.exports = { kmeans1D };
