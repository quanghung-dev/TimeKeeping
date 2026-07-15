import { beforeEach, describe, expect, it } from "vitest";
import { resetEnvForTests } from "../src/config/env.js";
import {
  hashToken,
  issueAccessToken,
  issueRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../src/infrastructure/authentication/token-service.js";

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.DATABASE_SSL = "false";
  process.env.JWT_ACCESS_SECRET = "access-secret-that-is-at-least-32-characters";
  process.env.JWT_REFRESH_SECRET = "refresh-secret-that-is-at-least-32-characters";
  process.env.TOKEN_HASH_SECRET = "hash-secret-that-is-at-least-32-characters";
  resetEnvForTests();
});

describe("token service", () => {
  it("issues and verifies an access token", async () => {
    const token = await issueAccessToken({ userId: "user-1", email: "user@example.com" });
    await expect(verifyAccessToken(token)).resolves.toEqual({
      userId: "user-1",
      email: "user@example.com",
    });
  });

  it("issues a refresh token with stable identity claims", async () => {
    const issued = await issueRefreshToken("user-1", "family-1");
    await expect(verifyRefreshToken(issued.token)).resolves.toEqual({
      userId: "user-1",
      tokenId: issued.tokenId,
      familyId: "family-1",
    });
  });

  it("hashes tokens deterministically without returning the token", () => {
    expect(hashToken("secret-token")).toBe(hashToken("secret-token"));
    expect(hashToken("secret-token")).not.toContain("secret-token");
  });
});
