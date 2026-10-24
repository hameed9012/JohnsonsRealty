/** The Discord callback URL without its `iss` parameter, or null when there is nothing to change. */
export function withoutDiscordIssuer(href: string): string | null {
  const url = new URL(href);
  if (!url.pathname.endsWith('/api/auth/callback/discord') || !url.searchParams.has('iss')) return null;
  url.searchParams.delete('iss');
  return url.toString();
}
