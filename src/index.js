// Official Node.js client for the Easy Email Verification API.
// API reference: https://www.easyemailverification.com/en-US/api/reference
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export const VERSION = "1.0.0";
export const DEFAULT_BASE_URL = "https://api.easyemailverification.com/v1";

/**
 * Public test key: no account and no credits. Works on verify, verifyBatch and credits (not bulk),
 * only for addresses at sandbox.easyemailverification.com (plus typo@gmial.com), with fixed answers.
 */
export const SANDBOX_API_KEY = "eev_sandbox_key";

/** Maximum addresses per verifyBatch call. */
export const MAX_BATCH = 50;

/** Error returned by the API (status is the HTTP status) or raised by the client (status 0). */
export class EEVError extends Error {
  constructor(message, status = 0, body = null) {
    super(message);
    this.name = "EEVError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Turns a verification result into a decision:
 * "accept"  valid and safe to send;
 * "reject"  invalid (will bounce);
 * "suggest" did_you_mean has a corrected address (ask the user);
 * "review"  unknown, catch-all or disposable: your own policy decides.
 */
export function decide(result) {
  if (result.did_you_mean) return "suggest";
  if (result.result === "valid" && result.safe_to_send) return "accept";
  if (result.result === "invalid") return "reject";
  return "review";
}

export class EasyEmailVerification {
  /**
   * @param {object} [options]
   * @param {string} [options.apiKey]    defaults to the EEV_API_KEY environment variable
   * @param {string} [options.baseUrl]
   * @param {number} [options.timeoutMs] per request, default 30000 (bulk uploads use 5 minutes)
   */
  constructor({ apiKey, baseUrl = DEFAULT_BASE_URL, timeoutMs = 30_000 } = {}) {
    this.apiKey = apiKey ?? process.env.EEV_API_KEY;
    if (!this.apiKey) {
      throw new EEVError("Missing API key: pass { apiKey } or set EEV_API_KEY (use SANDBOX_API_KEY to test)");
    }
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.timeoutMs = timeoutMs;
    this.bulk = new Bulk(this);
  }

  async _request(method, path, { body, form, timeoutMs, raw = false } = {}) {
    const headers = { "X-API-Key": this.apiKey, "User-Agent": `easyemailverification-node/${VERSION}` };
    let payload;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    } else if (form) {
      payload = form;
    }
    let response;
    try {
      response = await fetch(this.baseUrl + path, {
        method,
        headers,
        body: payload,
        signal: AbortSignal.timeout(timeoutMs ?? this.timeoutMs),
      });
    } catch (err) {
      throw new EEVError(`Request failed: ${err.message}`);
    }
    const text = await response.text();
    if (response.ok && raw) return text;
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      if (response.ok) throw new EEVError("Unexpected response from the API", response.status, text);
    }
    if (!response.ok) {
      throw new EEVError((data && data.message) || `HTTP ${response.status}`, response.status, data ?? text);
    }
    return data;
  }

  /** Verifies one address. Uses one credit; unknown results do not. */
  verify(email) {
    return this._request("GET", `/verify?email=${encodeURIComponent(email)}`);
  }

  /** Verifies up to 50 addresses in one request; returns one result per address. */
  verifyBatch(emails) {
    if (!Array.isArray(emails) || emails.length === 0) throw new EEVError("verifyBatch needs a non-empty array");
    if (emails.length > MAX_BATCH) throw new EEVError(`verifyBatch accepts at most ${MAX_BATCH} addresses; use bulk for larger lists`);
    return this._request("POST", "/verify", { body: { emails }, timeoutMs: Math.max(this.timeoutMs, 120_000) });
  }

  /** Remaining credits (free). */
  credits() {
    return this._request("GET", "/credits");
  }
}

class Bulk {
  constructor(client) {
    this.client = client;
  }

  /**
   * Uploads a TXT or CSV list (one address per line, max 16 MB) and starts a job.
   * @param {string|Buffer|Uint8Array} file  a file path, or the file contents
   * @param {object} [options]
   * @param {string} [options.filename] name shown in the dashboard (default: the file name, or list.csv)
   * @returns {Promise<{status: string, list_id: string, filename: string, uploaded: number, message: string}>}
   */
  async upload(file, { filename } = {}) {
    let content = file;
    if (typeof file === "string") {
      content = await readFile(file);
      filename ??= basename(file);
    }
    const form = new FormData();
    form.append("file", new Blob([content], { type: "text/csv" }), filename ?? "list.csv");
    return this.client._request("POST", "/bulk/upload", { form, timeoutMs: 300_000 });
  }

  /** Status of one job: status, progress (0-100), totals. */
  status(listId) {
    return this.client._request("GET", `/bulk/status/${encodeURIComponent(listId)}`);
  }

  /** All jobs of the account. */
  list() {
    return this.client._request("GET", "/bulk/status");
  }

  /** Results of a completed job, as CSV text. */
  download(listId) {
    return this.client._request("GET", `/bulk/download/${encodeURIComponent(listId)}`, { raw: true, timeoutMs: 300_000 });
  }

  /** Deletes a job and its results. */
  delete(listId) {
    return this.client._request("DELETE", `/bulk/${encodeURIComponent(listId)}`);
  }

  /**
   * Polls status() until the job is completed, failed, deleted or not_enough_credits.
   * @param {string} listId
   * @param {object} [options]
   * @param {number} [options.intervalMs] default 5000
   * @param {number} [options.timeoutMs]  default 1 hour
   */
  async wait(listId, { intervalMs = 5_000, timeoutMs = 3_600_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const job = await this.status(listId);
      if (["completed", "failed", "deleted", "not_enough_credits"].includes(job.status)) return job;
      if (Date.now() + intervalMs > deadline) throw new EEVError(`Bulk job ${listId} did not finish in time (status: ${job.status})`);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}

export default EasyEmailVerification;
