# Easy Email Verification for Node.js

Official Node.js client for the [Easy Email Verification API](https://www.easyemailverification.com/en-US/api): check whether email addresses exist and are safe to send to, one by one, in batches of 50 or as bulk lists of up to 16 MB. No email is sent to the addresses you verify.

- No dependencies (uses the `fetch` built into Node.js 18+)
- TypeScript types included
- Free sandbox key to test without an account or credits

## Install

```bash
npm install easyemailverification
```

## Quick start

```js
import { EasyEmailVerification, SANDBOX_API_KEY, decide } from "easyemailverification";

// Use SANDBOX_API_KEY to try it, or your own key (by default read from EEV_API_KEY)
const eev = new EasyEmailVerification({ apiKey: SANDBOX_API_KEY });

const result = await eev.verify("valid@sandbox.easyemailverification.com");
console.log(result.result, result.reason, result.safe_to_send); // valid accepted_email true
console.log(decide(result)); // accept
```

Get your API key in the dashboard under [API settings](https://dashboard.easyemailverification.com/apisettings) and keep it on the server, in the `EEV_API_KEY` environment variable. Never put it in browser code; for web forms use the [email verification widget](https://www.easyemailverification.com/en-US/email-verification-widget).

## Results

Every verification returns `result` (`valid`, `invalid` or `unknown`), a `reason` and risk signals:

| Field | Meaning |
| --- | --- |
| `result` | `valid`: the mail server accepted the mailbox. `invalid`: it will bounce. `unknown`: no reliable answer (not invalid). |
| `reason` | Why, for example `accepted_email`, `rejected_email`, `invalid_domain`, `no_mx_record`, `timeout`. |
| `safe_to_send` | Overall recommendation. `false` for invalid and unknown results, catch-all domains and disposable addresses. |
| `did_you_mean` | Corrected address when a typo is detected (`gmial.com` → `gmail.com`), otherwise `""`. |
| `disposable`, `accept_all`, `role`, `free` | Risk signals: temporary inbox, catch-all domain, role address (info@), free provider. |

`decide(result)` turns a result into `"accept"`, `"reject"`, `"suggest"` (show `did_you_mean`) or `"review"` (unknown, catch-all or disposable: your policy decides). Every result code is explained at [easyemailverification.com/en-US/help/result-codes](https://www.easyemailverification.com/en-US/help/result-codes).

## Batch: up to 50 addresses

```js
const results = await eev.verifyBatch(["anna@example.com", "mark@gmial.com"]);
for (const r of results) console.log(r.email, decide(r));
```

## Bulk lists

For files with thousands of addresses (TXT or CSV, one address per line, up to 16 MB). The account needs enough credits for every address. Bulk does not work with the sandbox key.

```js
const job = await eev.bulk.upload("leads.csv");      // a path, or a Buffer with the contents
const done = await eev.bulk.wait(job.list_id);       // polls until completed (or failed)
if (done.status === "completed") {
  const csv = await eev.bulk.download(job.list_id);  // Email,Result,Reason,...,IsSafeToSend,DidYouMean,...
}
await eev.bulk.list();                               // all jobs of the account
await eev.bulk.delete(job.list_id);                  // results are also deleted after 30 days
```

## Credits

```js
const { credits_remaining } = await eev.credits(); // free call
```

Each verified address uses one credit; unknown results do not. The free plan includes 50 verifications a day. See [pricing](https://www.easyemailverification.com/en-US/pricing).

## Errors

API errors throw `EEVError` with the HTTP `status` and the API `message`:

```js
import { EEVError } from "easyemailverification";

try {
  await eev.verify("someone@example.com");
} catch (e) {
  if (e instanceof EEVError && e.status === 402) {
    // no credits left
  }
}
```

| Status | Meaning |
| --- | --- |
| 400 | Missing key or parameter, or a non-sandbox address with the sandbox key |
| 401 | Unknown key, or a widget-only key |
| 402 | No credits left |
| 404 | Bulk job not found |
| 429 | Sandbox rate limit |
| 0 | Raised by the client (network error, timeout, more than 50 addresses in a batch) |

Do not retry verifications in a tight loop: a request that timed out may already have used a credit.

## Sandbox addresses

With `SANDBOX_API_KEY`, these addresses return fixed answers: `valid@`, `invalid@`, `unknown@`, `disposable@`, `catchall@`, `role@`, `quota@` (402) and `ratelimit@` (429) at `sandbox.easyemailverification.com`, plus `typo@gmial.com` (did you mean). Sandbox calls are limited to 60 per minute per IP.

## Links

- [Email verification API](https://www.easyemailverification.com/en-US/api) and [API reference](https://www.easyemailverification.com/en-US/api/reference)
- [Email validation in Node.js](https://www.easyemailverification.com/en-US/guides/validate-email-nodejs): from regex to mailbox checks, with an Express signup example
- [OpenAPI specification](https://www.easyemailverification.com/openapi.json)
- [MCP server for AI assistants](https://www.easyemailverification.com/en-US/mcp)
- Support: support@easyemailverification.com

## License

MIT
