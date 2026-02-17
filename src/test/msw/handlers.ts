import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("https://example.com/health", () => {
    return HttpResponse.json({ ok: true });
  }),
];
