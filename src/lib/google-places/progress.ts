export interface SearchPosition { provinceIndex: number; sectorIndex: number }

export function advanceSearchPosition(
  current: SearchPosition,
  provinceCount: number,
  sectorCount: number,
): SearchPosition {
  if (provinceCount < 1 || sectorCount < 1) return { provinceIndex: 0, sectorIndex: 0 };
  const nextSector = current.sectorIndex + 1;
  if (nextSector < sectorCount) return { provinceIndex: current.provinceIndex, sectorIndex: nextSector };
  return { provinceIndex: (current.provinceIndex + 1) % provinceCount, sectorIndex: 0 };
}
