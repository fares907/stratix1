import type { RequestHandler } from "express";

// Umami Cloud serves its script from cloud.umami.is but POSTs collected events
// to a different origin, gateway.umami.is. Deriving connect-src from the script
// origin alone silently blocked every event in production — the browser refused
// the request to gateway.umami.is/api/send and the dashboard recorded zero
// visitors from launch onward. Self-hosted Umami uses one origin for both, so
// the split only applies to the cloud endpoint; ANALYTICS_COLLECT_ENDPOINT
// overrides it if the collection host ever changes again.
const UMAMI_CLOUD_ORIGIN = "https://cloud.umami.is";
const UMAMI_CLOUD_COLLECT_ORIGIN = "https://gateway.umami.is";

function getAllowedExternalOrigin(value: string | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
}

export function createSecurityHeaders(isProduction = process.env.NODE_ENV === "production"): RequestHandler {
  const analyticsOrigin = getAllowedExternalOrigin(process.env.VITE_ANALYTICS_ENDPOINT);
  const externalSource = analyticsOrigin ? ` ${analyticsOrigin}` : "";
  // Only widen connect-src when analytics is actually configured, so disabling
  // it removes the origin from the policy instead of leaving it dangling.
  const collectOrigin = analyticsOrigin
    ? getAllowedExternalOrigin(
        process.env.ANALYTICS_COLLECT_ENDPOINT ??
          (analyticsOrigin === UMAMI_CLOUD_ORIGIN ? UMAMI_CLOUD_COLLECT_ORIGIN : analyticsOrigin),
      )
    : "";
  const connectSources = [analyticsOrigin, collectOrigin]
    .filter((origin, index, all) => origin && all.indexOf(origin) === index)
    .join(" ");
  const connectExternalSource = connectSources ? ` ${connectSources}` : "";
  const developmentScriptSources = isProduction ? "" : " 'unsafe-inline' 'unsafe-eval'";
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
    `script-src 'self'${developmentScriptSources}${externalSource}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    `connect-src 'self'${connectExternalSource}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ];

  return (_req, res, next) => {
    res.setHeader("Content-Security-Policy", directives.join("; "));
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    // frame-ancestors (CSP) is what modern browsers honor for clickjacking
    // protection; X-Frame-Options stays as defense-in-depth for older ones.
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Origin-Agent-Cluster", "?1");
    if (isProduction) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    next();
  };
}
