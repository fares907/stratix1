import nodemailer from "nodemailer";
import { describe, expect, it } from "vitest";

describe("Gmail SMTP configuration", () => {
  it(
    "authenticates with the configured App Password without sending mail",
    async () => {
      const user = process.env.GMAIL_SMTP_USER?.trim();
      const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

      expect(user, "GMAIL_SMTP_USER must be configured").toBeTruthy();
      expect(appPassword, "GMAIL_APP_PASSWORD must be configured").toBeTruthy();

      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user,
          pass: appPassword,
        },
        connectionTimeout: 8_000,
        greetingTimeout: 8_000,
        socketTimeout: 8_000,
      });

      await expect(transporter.verify()).resolves.toBe(true);
      transporter.close();
    },
    15_000,
  );
});
