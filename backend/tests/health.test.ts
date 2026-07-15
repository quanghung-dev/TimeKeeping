import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import * as poolModule from "../src/infrastructure/database/pool.js";

describe("GET /api/health", () => {
  it("returns the standard success envelope", async () => {
    const response = await request(createApp()).get("/api/health").expect(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "API dang hoat dong",
      data: { status: "ok" },
      errors: null,
    });
    expect(response.body.timestamp).toEqual(expect.any(String));
  });

  it("publishes an OpenAPI document without authentication", async () => {
    const response = await request(createApp()).get("/api/openapi.json").expect(200);
    expect(response.body.openapi).toBe("3.1.0");
    expect(response.body.paths["/attendance/check-in"]).toBeDefined();
  });
});

describe("GET /api/health/db", () => {
  it("returns 200 when database connection is successful", async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rows: [{ ok: 1 }] });
    const mockPool = { query: mockQuery } as any;
    const spy = vi.spyOn(poolModule, "getPool").mockReturnValue(mockPool);

    const response = await request(createApp()).get("/api/health/db").expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: "Ket noi database thanh cong",
      data: { status: "ok", database: "connected" },
    });
    expect(mockQuery).toHaveBeenCalledWith("SELECT 1");

    spy.mockRestore();
  });

  it("returns 500 when database connection fails", async () => {
    const spy = vi.spyOn(poolModule, "getPool").mockImplementation(() => {
      throw new Error("Connection failed");
    });

    const response = await request(createApp()).get("/api/health/db").expect(500);

    expect(response.body).toMatchObject({
      success: false,
      message: "Khong the ket noi den database",
      errors: {
        database: ["Connection failed"],
      },
    });

    spy.mockRestore();
  });
});

