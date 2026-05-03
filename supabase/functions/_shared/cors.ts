import { SITE_URL } from "./env.ts";

const siteOrigin = new URL(SITE_URL).origin;

function isAllowedDevelopmentOrigin(origin: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

export function getCorsHeaders(originHeader: string | null = null) {
  const allowOrigin = originHeader && (originHeader === siteOrigin || isAllowedDevelopmentOrigin(originHeader))
    ? originHeader
    : siteOrigin;

  return {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": allowOrigin,
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
}

export function jsonResponse(
  payload: unknown,
  init: ResponseInit = {},
  originHeader: string | null = null,
) {
  const headers = new Headers(getCorsHeaders(originHeader));

  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}
