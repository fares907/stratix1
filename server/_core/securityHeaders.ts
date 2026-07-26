import type { RequestHandler } from "express";

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
    `connect-src 'self'${externalSource}`,
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
