// ─────────────────────────────────────────
//  TEKRARLANABİLİR RASTGELE SAYI ÜRETECİ
// ─────────────────────────────────────────
// mulberry32 — aynı seed ile aynı simülasyon sonucu (test ve karşılaştırma için).
export function createRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    // Python random.choices(weights=...) karşılığı. Ağırlıkların hepsi 0 ise
    // (Python'da ValueError) eşit olasılıkla seçer.
    weightedIndex(weights) {
      let total = 0;
      for (const w of weights) total += Math.max(0, w);
      if (total <= 0) return Math.floor(next() * weights.length);
      let r = next() * total;
      let last = 0;
      for (let i = 0; i < weights.length; i++) {
        const w = Math.max(0, weights[i]);
        if (w <= 0) continue;
        last = i;
        r -= w;
        if (r < 0) return i;
      }
      return last;
    },
  };
}
