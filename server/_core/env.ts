export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromAddress: process.env.RESEND_FROM_ADDRESS ?? "",
  bookingEmailTo: process.env.BOOKING_EMAIL_TO ?? "",
  adminPasswordFares: process.env.ADMIN_PASSWORD_FARES ?? "",
  adminPasswordYoussef: process.env.ADMIN_PASSWORD_YOUSSEF ?? "",
  adminSessionSecret: process.env.JWT_SECRET ?? "",

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

  if (!ENV.adminPasswordFares || !ENV.adminPasswordYoussef) {
    problems.push("ADMIN_PASSWORD_FARES and ADMIN_PASSWORD_YOUSSEF must both be set");
  }

  if (problems.length > 0) {
    throw new Error(
      ["Refusing to start: insecure production configuration.", ...problems.map(item => `  - ${item}`)].join("\n"),
    );
  }
}
