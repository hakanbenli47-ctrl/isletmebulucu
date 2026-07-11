import "server-only";
import { instagramUsername } from "@/lib/google-places/website";
import type { PlaceDetails } from "@/types";

type ActivityResult = Pick<PlaceDetails, "instagramActivity" | "instagramLastPostAt" | "instagramFollowers">;
type CacheItem = { expiresAt: number; value: ActivityResult };

const globalCache = globalThis as typeof globalThis & { __instagramActivityCache?: Map<string, CacheItem> };
const activityCache = globalCache.__instagramActivityCache ??= new Map<string, CacheItem>();
const CACHE_MS = 6 * 60 * 60 * 1000;
const ACTIVE_DAYS = 90;

export async function enrichInstagramActivity(places: PlaceDetails[]) {
  if (!hasCredentials()) {
    return places.map((place) => instagramUsername(place.websiteUri) ? { ...place, instagramActivity: "unverified" as const } : place);
  }

  const enriched: PlaceDetails[] = [];
  for (let index = 0; index < places.length; index += 5) {
    const batch = places.slice(index, index + 5);
    enriched.push(...await Promise.all(batch.map(enrichPlace)));
  }
  return enriched;
}

async function enrichPlace(place: PlaceDetails): Promise<PlaceDetails> {
  const username = instagramUsername(place.websiteUri);
  if (!username) return place;
  const cached = activityCache.get(username.toLowerCase());
  if (cached && cached.expiresAt > Date.now()) return { ...place, ...cached.value };

  const value = await fetchActivity(username);
  activityCache.set(username.toLowerCase(), { expiresAt: Date.now() + CACHE_MS, value });
  return { ...place, ...value };
}

async function fetchActivity(username: string): Promise<ActivityResult> {
  const accessToken = process.env.META_INSTAGRAM_ACCESS_TOKEN;
  const instagramUserId = process.env.META_INSTAGRAM_USER_ID;
  if (!accessToken || !instagramUserId) return { instagramActivity: "unverified" };
  const versionInput = process.env.META_GRAPH_API_VERSION ?? "v23.0";
  const version = /^v\d+\.\d+$/.test(versionInput) ? versionInput : "v23.0";
  const fields = `business_discovery.username(${username}){username,followers_count,media_count,media.limit(1){timestamp}}`;
  const params = new URLSearchParams({ fields, access_token: accessToken });

  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(instagramUserId)}?${params}`, { cache: "no-store" });
    if (!response.ok) return { instagramActivity: "unverified" };
    const data = await response.json() as { business_discovery?: { followers_count?: number; media_count?: number; media?: { data?: Array<{ timestamp?: string }> } } };
    const profile = data.business_discovery;
    const lastPostAt = profile?.media?.data?.[0]?.timestamp;
    if (!profile || !lastPostAt) return { instagramActivity: profile?.media_count === 0 ? "inactive" : "unverified", instagramFollowers: profile?.followers_count };
    const ageDays = (Date.now() - new Date(lastPostAt).getTime()) / 86_400_000;
    return { instagramActivity: ageDays <= ACTIVE_DAYS ? "active" : "inactive", instagramLastPostAt: lastPostAt, instagramFollowers: profile.followers_count };
  } catch {
    return { instagramActivity: "unverified" };
  }
}

function hasCredentials() {
  return Boolean(process.env.META_INSTAGRAM_ACCESS_TOKEN && process.env.META_INSTAGRAM_USER_ID);
}
