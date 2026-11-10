import type { NextConfig } from "next";

// اللوحة بتتبني كملفات ثابتة وبتتعرض جوه موقع STRATIX على /hq
// (السيرفر بتاع الموقع هو اللي بيعرضها، بحماية headers خاصة بيها).
// مفيش سيرفر خاص باللوحة: الحماية كلها في Supabase (تسجيل الدخول + RLS)،
// والشات بيروح لـ edge function في Supabase.
const config: NextConfig = {
  output: "export",
  basePath: "/hq",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default config;
