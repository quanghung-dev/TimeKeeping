import type { ApiEnvelope, ErrorDetails } from "@/types/api";

const API_ROOT = "/api";
let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;
let refreshPromise: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors: ErrorDetails | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!body) throw new ApiError(response.status, "Phản hồi máy chủ không hợp lệ", null);
  if (!response.ok || !body.success) {
    throw new ApiError(response.status, body.message, body.errors);
  }
  return body;
}

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (csrfPromise) return csrfPromise;

  csrfPromise = (async () => {
    try {
      const response = await fetch(`${API_ROOT}/auth/csrf`, {
        credentials: "include",
        cache: "no-store",
      });
      const envelope = await parseEnvelope<{ csrfToken: string }>(response);
      csrfToken = envelope.data!.csrfToken;
      return csrfToken;
    } finally {
      csrfPromise = null;
    }
  })();

  return csrfPromise;
}

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const token = await ensureCsrfToken();
      const response = await fetch(`${API_ROOT}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "x-csrf-token": token },
        cache: "no-store",
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  skipRefresh?: boolean;
  skipCsrfRetry?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    body: rawBody,
    skipRefresh = false,
    skipCsrfRetry = false,
    ...requestOptions
  } = options;
  const method = (requestOptions.method ?? "GET").toUpperCase();
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(method);
  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;

  if (rawBody instanceof FormData || rawBody instanceof Blob) {
    body = rawBody;
  } else if (rawBody !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(rawBody);
  }
  if (isMutation) headers.set("x-csrf-token", await ensureCsrfToken());

  const response = await fetch(`${API_ROOT}${path}`, {
    ...requestOptions,
    method,
    headers,
    body,
    credentials: "include",
    cache: "no-store",
  });

  const cannotRefresh = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/csrf"].includes(path);
  if (response.status === 403 && isMutation && !skipCsrfRetry) {
    csrfToken = null;
    return apiRequest<T>(path, { ...options, skipCsrfRetry: true });
  }
  if (response.status === 401 && !skipRefresh && !cannotRefresh) {
    if (await refreshSession()) return apiRequest<T>(path, { ...options, skipRefresh: true });
  }
  if (response.status === 204 && response.ok) return undefined as T;
  return (await parseEnvelope<T>(response)).data!;
}

export function resetApiSessionState(): void {
  csrfToken = null;
  csrfPromise = null;
  refreshPromise = null;
}
