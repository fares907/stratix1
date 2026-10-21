export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromAddress: process.env.RESEND_FROM_ADDRESS ?? "",
  bookingEmailTo: process.env.BOOKING_EMAIL_TO ?? "",
  // One dashboard account. ADMIN_PASSWORD_FARES is read only as a fallback so
  // a deploy made before the new variable is set in Railway keeps the current
  // password working instead of refusing to boot; drop it once ADMIN_PASSWORD
  // is in place.
  adminPassword: process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD_FARES || "",
  adminSessionSecret: process.env.JWT_SECRET ?? "",
  // Optional second factor: a base32 TOTP secret from scripts/totp-setup.mjs.
  // Unset means password-only.
  adminTotpSecret: process.env.ADMIN_TOTP_SECRET ?? "",

  // Where a client sends the transfer. Configuration, not secrets — they are
  // shown to a paying client by design — but kept in the environment so the
  // real account details never enter the repository and can be corrected
  // without a deploy. An empty value simply hides that payment option.
  paymentInstapay: process.env.PAYMENT_INSTAPAY ?? "",
  paymentIban: process.env.PAYMENT_IBAN ?? "",
  paymentBankName: process.env.PAYMENT_BANK_NAME ?? "",
  paymentAccountName: process.env.PAYMENT_ACCOUNT_NAME ?? "",
};

// HS256 keys shorter than this are brute-forceable offline against a single
// captured cookie, and recovering the key means minting admin sessions at will.
const MIN_SIGNING_SECRET_LENGTH = 32;

// Every secret here used to fall back to a constant when unset, so a missing
// environment variable produced a running server that signed admin sessions
// with a value published in this repository. Booting is now refused instead:
// an outage is recoverable, a silently forgeable admin session is not.
export function assertProductionSecrets() {
  if (!ENV.isProduction) return;

  const problems: string[] = [];

  if (!ENV.cookieSecret) {
    problems.push("JWT_SECRET is not set — admin sessions cannot be signed safely");
  } else if (ENV.cookieSecret.length < MIN_SIGNING_SECRET_LENGTH) {
    problems.push(
      `JWT_SECRET is ${ENV.cookieSecret.length} characters; at least ${MIN_SIGNING_SECRET_LENGTH} are required`,
    );
  }

  if (!ENV.adminPassword) {
    problems.push("ADMIN_PASSWORD must be set");
  } else if (ENV.adminPassword.length < 12) {
    // A warning, not a refusal: rejecting the live password at boot would take
    // the whole site down to fix a dashboard setting.
    console.warn("[Security] ADMIN_PASSWORD is shorter than 12 characters; choose a longer one.");
  }

  if (problems.length > 0) {
    throw new Error(
      ["Refusing to start: insecure production configuration.", ...problems.map(item => `  - ${item}`)].join("\n"),
    );
  }
}
