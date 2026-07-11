export function filterNewPlaceIds<T extends { placeId: string }>(
  places: T[],
  existingIds: Iterable<string>,
): T[] {
  const seen = new Set(existingIds);
  return places.filter((place) => {
    if (seen.has(place.placeId)) return false;
    seen.add(place.placeId);
    return true;
  });
}
