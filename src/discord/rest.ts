// A small typed client for Discord's REST API (no gateway, so it runs on Vercel). Requests to the same route
// bucket go one at a time; a 429 waits `retry_after` and tries again, and an exhausted bucket waits for its reset.

const API = 'https://discord.com/api/v10';

export class DiscordApiError extends Error {
  constructor(
    public status: number,
    public code: number | undefined,
    message: string,
    public body: unknown,
  ) {
    super(message);
  }
}

export interface RequestOptions {
  body?: unknown;
  /** Shown in the server's audit log. */
  reason?: string;
  /** Multipart upload: `files[n]` parts beside `payload_json`. */
  files?: { name: string; data: Blob | Uint8Array; contentType?: string }[];
  query?: Record<string, string | number | boolean | undefined>;
}

export interface DiscordRest {
  request<T = unknown>(method: string, path: string, opts?: RequestOptions): Promise<T>;
  get<T = unknown>(path: string, opts?: RequestOptions): Promise<T>;
  post<T = unknown>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  put<T = unknown>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  delete<T = unknown>(path: string, opts?: RequestOptions): Promise<T>;
}

/** Route bucket: major parameters (channel, guild, webhook IDs) stay, other IDs collapse. */
export function bucketOf(method: string, path: string): string {
  const major = /^\/(channels|guilds|webhooks)\/(\d+)/.exec(path);
  const rest = path.replace(/^\/(channels|guilds|webhooks)\/\d+/, '').replace(/\/\d{16,}/g, '/:id');
  return `${method} ${major ? `/${major[1]}/${major[2]}` : ''}${rest}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function discordRest(token: string, opts: { fetch?: typeof fetch; maxRetries?: number } = {}): DiscordRest {
  const doFetch = opts.fetch ?? fetch;
  const maxRetries = opts.maxRetries ?? 4;
  const queues = new Map<string, Promise<unknown>>();
  const resetAt = new Map<string, number>();
  let globalUntil = 0;

  async function send<T>(method: string, path: string, o: RequestOptions, bucket: string): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const wait = Math.max(globalUntil, resetAt.get(bucket) ?? 0) - Date.now();
      if (wait > 0) await sleep(wait);
      const url = new URL(API + path);
      for (const [k, v] of Object.entries(o.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
      const headers: Record<string, string> = { Authorization: `Bot ${token}`, 'User-Agent': 'DiscordBot (https://github.com/hameed9012/JohnsonsRealty, 1.0)' };
      if (o.reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(o.reason);
      let body: BodyInit | undefined;
      if (o.files?.length) {
        const form = new FormData();
        form.set('payload_json', JSON.stringify(o.body ?? {}));
        o.files.forEach((f, i) => form.set(`files[${i}]`, f.data instanceof Blob ? f.data : new Blob([f.data as BlobPart], { type: f.contentType }), f.name));
        body = form;
      } else if (o.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(o.body);
      }
      const res = await doFetch(url, { method, headers, body });
      const remaining = res.headers.get('x-ratelimit-remaining');
      const resetAfter = Number(res.headers.get('x-ratelimit-reset-after'));
      if (remaining === '0' && Number.isFinite(resetAfter)) resetAt.set(bucket, Date.now() + resetAfter * 1000);
      if (res.status === 429 && attempt < maxRetries) {
        const j = (await res.json().catch(() => ({}))) as { retry_after?: number; global?: boolean };
        const ms = Math.ceil((j.retry_after ?? 1) * 1000);
        if (j.global) globalUntil = Date.now() + ms;
        else resetAt.set(bucket, Date.now() + ms);
        continue;
      }
      if (res.status >= 500 && attempt < maxRetries) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (res.status === 204) return undefined as T;
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const d = (data ?? {}) as { code?: number; message?: string };
        throw new DiscordApiError(res.status, d.code, `Discord ${method} ${path} failed (${res.status}${d.code ? ` / ${d.code}` : ''}): ${d.message ?? res.statusText}`, data);
      }
      return data as T;
    }
  }

  function request<T>(method: string, path: string, o: RequestOptions = {}): Promise<T> {
    const bucket = bucketOf(method, path);
    const prev = queues.get(bucket) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(() => send<T>(method, path, o, bucket));
    queues.set(bucket, next);
    return next;
  }

  return {
    request,
    get: (p, o) => request('GET', p, o),
    post: (p, b, o) => request('POST', p, { ...o, body: b }),
    patch: (p, b, o) => request('PATCH', p, { ...o, body: b }),
    put: (p, b, o) => request('PUT', p, { ...o, body: b }),
    delete: (p, o) => request('DELETE', p, o),
  };
}
