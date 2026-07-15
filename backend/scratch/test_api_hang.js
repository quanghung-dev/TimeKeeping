import request from "supertest";
import { createApp } from "../src/app.js";
import { issueAccessToken } from "../src/infrastructure/authentication/token-service.js";
import dotenv from "dotenv";

dotenv.config();

// Ensure JWT env variables are loaded
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "access-secret-that-is-at-least-32-characters";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh-secret-that-is-at-least-32-characters";
process.env.TOKEN_HASH_SECRET = process.env.TOKEN_HASH_SECRET || "hash-secret-that-is-at-least-32-characters";

async function main() {
  const token = await issueAccessToken({ userId: "98e52b8d-61b3-4836-8c2f-33b05b18d099", email: "hungd4842@gmail.com" });
  const app = createApp();

  console.log("Fetching /api/leaves via Supertest...");
  let start = Date.now();
  try {
    const res = await request(app)
      .get("/api/leaves?year=2026&page=1&pageSize=100")
      .set("Cookie", [`tk_access=${token}`]);
    
    console.log("Response status:", res.status);
    console.log("Response body:", res.body);
    console.log("Time taken:", Date.now() - start, "ms");
  } catch (err) {
    console.error("Error fetching leaves:", err);
  }

  console.log("\nFetching /api/leaves/balance via Supertest...");
  start = Date.now();
  try {
    const res = await request(app)
      .get("/api/leaves/balance?year=2026")
      .set("Cookie", [`tk_access=${token}`]);
    
    console.log("Response status:", res.status);
    console.log("Response body:", res.body);
    console.log("Time taken:", Date.now() - start, "ms");
  } catch (err) {
    console.error("Error fetching balance:", err);
  }
}

main();
