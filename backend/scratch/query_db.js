import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});

async function main() {
  const client = await pool.connect();
  try {
    const users = await client.query("SELECT id, email, created_at FROM users");
    console.log("Users:", users.rows);

    const leaves = await client.query("SELECT * FROM leave_days");
    console.log("Leaves:", leaves.rows);

    const attendance = await client.query("SELECT * FROM attendance_days");
    console.log("Attendance Days:", attendance.rows);

    const audit = await client.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5");
    console.log("Recent Audit Logs:", audit.rows);
  } catch (err) {
    console.error("Database query error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
