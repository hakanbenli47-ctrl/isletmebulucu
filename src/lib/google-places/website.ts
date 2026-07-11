const SOCIAL_HOSTS = [
  "instagram.com", "facebook.com", "fb.com", "tiktok.com", "linktr.ee",
  "linktree.com", "youtube.com", "youtu.be", "x.com", "twitter.com",
];

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
