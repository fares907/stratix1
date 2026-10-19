// Generates a two-factor secret for one dashboard account.
//
//   node scripts/totp-setup.mjs fares
//   node scripts/totp-setup.mjs youssef
//
// 1. Add the printed key to an authenticator app (Google Authenticator,
//    Microsoft Authenticator, 1Password…) with "Enter a setup key", or open
//    the otpauth link on the phone.
// 2. Put the key in Railway → Variables as ADMIN_TOTP_SECRET_FARES (or
//    _YOUSSEF) and redeploy. From then on sign-in asks for the 6-digit code.
//
// The key is shown once, here, on your own machine. Never paste it into chat
// or commit it. To reset, run this again and replace the Railway variable.
import { randomBytes } from "node:crypto";

const account = process.argv[2];
if (account !== "fares" && account !== "youssef") {
  console.error("Usage: node scripts/totp-setup.mjs <fares|youssef>");
  process.exit(1);
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
let bits = 0;
let value = 0;
let secret = "";
for (const byte of randomBytes(20)) {
  value = (value << 8) | byte;
  bits += 8;
  while (bits >= 5) {
    secret += ALPHABET[(value >>> (bits - 5)) & 31];
    bits -= 5;
  }
}

const label = encodeURIComponent(`STRATIX:${account}`);
const uri = `otpauth://totp/${label}?secret=${secret}&issuer=STRATIX&algorithm=SHA1&digits=6&period=30`;

console.log(`
Account:          ${account}
Setup key:        ${secret.match(/.{1,4}/g).join(" ")}
Railway variable: ADMIN_TOTP_SECRET_${account.toUpperCase()}=${secret}

otpauth link (open on the phone, or paste into a QR generator you trust offline):
${uri}
`);
