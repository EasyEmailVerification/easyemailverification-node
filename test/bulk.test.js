// Bulk endpoints against a local fake API (the sandbox key does not work on bulk).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EasyEmailVerification, EEVError } from "../src/index.js";

let server, eev, polls = 0, uploaded = "";
before(async () => {
  server = createServer((req, res) => {
    const send = (code, body, type = "application/json") => { res.writeHead(code, { "Content-Type": type }); res.end(typeof body === "string" ? body : JSON.stringify(body)); };
    if (req.headers["x-api-key"] !== "live_key") return send(401, { status: "error", message: "Invalid API key" });
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      if (req.method === "POST" && req.url === "/bulk/upload") {
        uploaded = data;
        assert.match(req.headers["content-type"], /multipart\/form-data/);
        return send(200, { status: "accepted", list_id: "abc123", filename: "leads.csv", uploaded: 2, message: "ok" });
      }
      if (req.url === "/bulk/status/abc123") {
        polls++;
        return send(200, { list_id: "abc123", status: polls < 2 ? "processing" : "completed", progress: polls < 2 ? 50 : 100 });
      }
      if (req.url === "/bulk/status") return send(200, { status: "ok", total_lists: 1, lists: [{ list_id: "abc123", status: "completed", progress: 100 }] });
      if (req.url === "/bulk/download/abc123") return send(200, "Email,Result\na@example.com,valid\n", "text/plain");
      if (req.method === "DELETE" && req.url === "/bulk/abc123") return send(200, { status: "deleted", list_id: "abc123", message: "deleted" });
      send(404, { status: "error", message: "Not found" });
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  eev = new EasyEmailVerification({ apiKey: "live_key", baseUrl: `http://127.0.0.1:${server.address().port}` });
});
after(() => server.close());

test("upload from a file path sends the file as multipart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eev-"));
  const file = join(dir, "leads.csv");
  await writeFile(file, "a@example.com\nb@example.com\n");
  const r = await eev.bulk.upload(file);
  assert.equal(r.list_id, "abc123");
  assert.match(uploaded, /filename="leads.csv"/);
  assert.match(uploaded, /b@example.com/);
});

test("upload from contents", async () => {
  const r = await eev.bulk.upload(Buffer.from("a@example.com\n"), { filename: "x.csv" });
  assert.equal(r.status, "accepted");
});

test("wait, list, download, delete", async () => {
  const job = await eev.bulk.wait("abc123", { intervalMs: 10 });
  assert.equal(job.status, "completed");
  assert.equal((await eev.bulk.list()).total_lists, 1);
  assert.match(await eev.bulk.download("abc123"), /^Email,Result/);
  assert.equal((await eev.bulk.delete("abc123")).status, "deleted");
});

test("bulk errors carry the HTTP status and message", async () => {
  await assert.rejects(eev.bulk.status("nope"), (e) => e instanceof EEVError && e.status === 404 && e.message === "Not found");
});
