import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { apiRequest, resetApiSessionState } from "@/lib/api/client";

describe("api client csrf concurrency", () => {
  let fetchMock: Mock;

  beforeEach(() => {
    resetApiSessionState();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("1, 2, 3: concurrent mutations only fetch csrf once and share token", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/auth/csrf")) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            message: "Success",
            data: { csrfToken: "token-123" },
            errors: null,
            timestamp: new Date().toISOString(),
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: "Success",
          data: { result: "ok" },
          errors: null,
          timestamp: new Date().toISOString(),
        }),
      };
    });

    const [res1, res2] = await Promise.all([
      apiRequest("/test-endpoint", { method: "POST", body: {} }),
      apiRequest("/test-endpoint", { method: "POST", body: {} }),
    ]);

    expect(res1).toEqual({ result: "ok" });
    expect(res2).toEqual({ result: "ok" });

    const csrfCalls = fetchMock.mock.calls.filter(([url]: unknown[]) => typeof url === "string" && url.endsWith("/auth/csrf"));
    expect(csrfCalls).toHaveLength(1);

    const mutationCalls = fetchMock.mock.calls.filter(([url]: unknown[]) => typeof url === "string" && url.endsWith("/test-endpoint"));
    expect(mutationCalls).toHaveLength(2);
    
    const call1Headers = mutationCalls[0]?.[1] as RequestInit | undefined;
    const call2Headers = mutationCalls[1]?.[1] as RequestInit | undefined;
    
    expect((call1Headers?.headers as Headers | undefined)?.get?.("x-csrf-token")).toBe("token-123");
    expect((call2Headers?.headers as Headers | undefined)?.get?.("x-csrf-token")).toBe("token-123");
  });

  it("4, 5: request fails, resets promise, and subsequent request can succeed", async () => {
    let callCount = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/auth/csrf")) {
        callCount++;
        if (callCount === 1) {
          throw new Error("Network error");
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { csrfToken: "token-456" },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      };
    });

    await expect(apiRequest("/test", { method: "POST", body: {} })).rejects.toThrow();

    const res = await apiRequest<unknown>("/test", { method: "POST", body: {} });
    expect(res).toBeDefined();
    expect(callCount).toBe(2);
  });

  it("6: refreshes a stale csrf token and retries the mutation once", async () => {
    let csrfCalls = 0;
    let mutationCalls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/auth/csrf")) {
        csrfCalls++;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { csrfToken: csrfCalls === 1 ? "stale-token" : "fresh-token" },
          }),
        };
      }

      mutationCalls++;
      return mutationCalls === 1
        ? {
            ok: false,
            status: 403,
            json: async () => ({ success: false, message: "CSRF_TOKEN_INVALID", errors: null }),
          }
        : {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { result: "ok" } }),
          };
    });

    await expect(apiRequest("/test", { method: "POST", body: {} })).resolves.toEqual({ result: "ok" });
    expect(csrfCalls).toBe(2);
    expect(mutationCalls).toBe(2);

    const calls = fetchMock.mock.calls.filter(([url]: unknown[]) => typeof url === "string" && url.endsWith("/test"));
    expect((calls[0]?.[1]?.headers as Headers).get("x-csrf-token")).toBe("stale-token");
    expect((calls[1]?.[1]?.headers as Headers).get("x-csrf-token")).toBe("fresh-token");
  });

  it("7: stops after one retry when the refreshed token is rejected", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/auth/csrf")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { csrfToken: "rejected-token" },
          }),
        };
      }
      return {
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          message: "CSRF_TOKEN_INVALID",
          errors: null,
        }),
      };
    });

    await expect(apiRequest("/test", { method: "POST", body: {} })).rejects.toThrow();
    
    const testCalls = fetchMock.mock.calls.filter(([url]: unknown[]) => typeof url === "string" && url.endsWith("/test"));
    expect(testCalls).toHaveLength(2);
    const csrfCalls = fetchMock.mock.calls.filter(([url]: unknown[]) => typeof url === "string" && url.endsWith("/auth/csrf"));
    expect(csrfCalls).toHaveLength(2);
  });
});
