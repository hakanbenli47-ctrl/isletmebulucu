const SOCIAL_HOSTS = [
  "instagram.com", "facebook.com", "fb.com", "tiktok.com", "linktr.ee",
  "linktree.com", "youtube.com", "youtu.be", "x.com", "twitter.com",
];

export type SocialProfileType = "instagram" | "facebook" | "tiktok" | "other" | null;

export function isIndependentWebsite(uri: string | null | undefined): boolean {
  if (!uri?.trim()) return false;
  try {
    const parsed = new URL(uri.startsWith("http") ? uri : `https://${uri}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return !SOCIAL_HOSTS.some((social) => host === social || host.endsWith(`.${social}`));
  } catch {
    return false;
  }
}

export function socialProfileType(uri: string | null | undefined): SocialProfileType {
  const host = normalizedHost(uri);
  if (!host) return null;
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
  if (["facebook.com", "fb.com"].some((value) => host === value || host.endsWith(`.${value}`))) return "facebook";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
  if (SOCIAL_HOSTS.some((value) => host === value || host.endsWith(`.${value}`))) return "other";
  return null;
}

export function isInstagramProfile(uri: string | null | undefined) {
  return instagramUsername(uri) !== null;
}

export function instagramUsername(uri: string | null | undefined) {
  if (socialProfileType(uri) !== "instagram" || !uri) return null;
  try {
    const parsed = new URL(uri.startsWith("http") ? uri : `https://${uri}`);
    const username = parsed.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "");
    if (!username || ["p", "reel", "reels", "stories", "explore", "accounts", "tv"].includes(username.toLowerCase())) return null;
    return /^[a-zA-Z0-9._]{1,30}$/.test(username) ? username : null;
  } catch {
    return null;
  }
}

function normalizedHost(uri: string | null | undefined) {
  if (!uri?.trim()) return null;
  try {
    return new URL(uri.startsWith("http") ? uri : `https://${uri}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}


