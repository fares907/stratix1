// Imported first by the server entry so variables exist before any module reads
// them. Production (Railway) injects them directly and has no .env file.
try {
  process.loadEnvFile();
} catch {}
