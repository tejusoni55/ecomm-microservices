import request from "supertest";
import app from "../index.js"; // Assuming your Express app is exported from src/app.js

describe("Health check", () => {
  it("should return 200", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual("ok");
  });
});

describe("Readiness check", () => {
  it("should return 200", async () => {
    const res = await request(app).get("/ready");
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual("ready");
  });
});
