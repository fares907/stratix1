// Generates the two-factor secret for the dashboard account.
//
//   node scripts/totp-setup.mjs
//
// 1. Add the printed key to an authenticator app (Google Authenticator,
//    Microsoft Authenticator, 1Password…) with "Enter a setup key", or open
//    the otpauth link on the phone.
// 2. Put the key in Railway → Variables as ADMIN_TOTP_SECRET and redeploy.
//    From then on sign-in asks for the 6-digit code. Add the same key to every
//    phone that should be able to sign in.
//
// The key is shown once, here, on your own machine. Never paste it into chat
// or commit it. To reset, run this again and replace the Railway variable.
import { randomBytes } from "node:crypto";


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

const label = encodeURIComponent("STRATIX:dashboard");
const uri = `otpauth://totp/${label}?secret=${secret}&issuer=STRATIX&algorithm=SHA1&digits=6&period=30`;

console.log(`
Setup key:        ${secret.match(/.{1,4}/g).join(" ")}
Railway variable: ADMIN_TOTP_SECRET=${secret}

otpauth link (open on the phone, or paste into a QR generator you trust offline):
${uri}
`);
