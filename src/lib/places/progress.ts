export interface SearchPosition { provinceIndex: number; sectorIndex: number }

export function advanceSearchPosition(
  current: SearchPosition,
  provinceCount: number,
  sectorCount: number,
): SearchPosition {
  if (provinceCount < 1 || sectorCount < 1) return { provinceIndex: 0, sectorIndex: 0 };
  const total = provinceCount * sectorCount;
  const normalizedProvince = modulo(current.provinceIndex, provinceCount);
  const normalizedSector = modulo(current.sectorIndex, sectorCount);
  const currentIndex = normalizedSector * provinceCount + normalizedProvince;
  const step = coprimeStep(total, provinceCount + 1);
  const nextIndex = (currentIndex + step) % total;
  return {
    provinceIndex: nextIndex % provinceCount,
    sectorIndex: Math.floor(nextIndex / provinceCount),
  };
}

function coprimeStep(total: number, preferred: number) {
  for (let step = Math.max(1, preferred); step < total; step += 1) {
    if (greatestCommonDivisor(step, total) === 1) return step;
  }
  return 1;
}

function greatestCommonDivisor(a: number, b: number) {
  let left = a;
  let right = b;
  while (right) [left, right] = [right, left % right];
  return left;
}

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

