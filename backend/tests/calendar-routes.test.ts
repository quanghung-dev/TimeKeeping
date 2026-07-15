import request from "supertest";
import { describe, expect, it, beforeEach } from "vitest";
import { createApp } from "../src/app.js";
import { resetEnvForTests } from "../src/config/env.js";
import { issueAccessToken } from "../src/infrastructure/authentication/token-service.js";

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.DATABASE_SSL = "false";
  process.env.JWT_ACCESS_SECRET = "access-secret-that-is-at-least-32-characters";
  process.env.JWT_REFRESH_SECRET = "refresh-secret-that-is-at-least-32-characters";
  process.env.TOKEN_HASH_SECRET = "hash-secret-that-is-at-least-32-characters";
  resetEnvForTests();
});

describe("Google Calendar Integration routes", () => {
  it("1, 5, 6: returns 401 when calling connect or sync without authentication", async () => {
    await request(createApp())
      .post("/api/integrations/google-calendar/connect")
      .expect(401);

    await request(createApp())
      .post("/api/integrations/google-calendar/sync")
      .expect(401);
  });

  it("2, 3, 4: returns 501 when calling connect or sync with valid auth and CSRF, pointing to their respective handlers", async () => {
    const token = await issueAccessToken({ userId: "user-123", email: "user@example.com" });
    const app = createApp();

    // Verify /connect endpoint
    const connectResponse = await request(app)
      .post("/api/integrations/google-calendar/connect")
      .set("Cookie", [`tk_access=${token}`, "tk_csrf=csrf-token-123"])
      .set("x-csrf-token", "csrf-token-123")
      .expect(501);

    expect(connectResponse.body.message).toBe("Chua cau hinh Google OAuth credentials");

    // Verify /sync endpoint
    const syncResponse = await request(app)
      .post("/api/integrations/google-calendar/sync")
      .set("Cookie", [`tk_access=${token}`, "tk_csrf=csrf-token-123"])
      .set("x-csrf-token", "csrf-token-123")
      .expect(501);

    expect(syncResponse.body.message).toBe("Chua cau hinh Google OAuth credentials");
  });
});
