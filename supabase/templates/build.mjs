// Builds the Supabase Auth email templates from one layout, so they all look the same and a change is made once.
//   node supabase/templates/build.mjs
// Writes one .html file per template into this folder, and prints the subject lines. The files are what you paste into the
// Supabase dashboard (Authentication > Emails > Templates); see README.md. The design is docs/DESIGN.md ("Field Protocol"):
// ground #f6f8fe, white card with a hairline border, ink #0f172a, action blue #2563eb. Email clients ignore most CSS, so everything
// is a table with inline styles, a bulletproof button and system fonts; images are PNG because SVG does not show in Gmail or Outlook.
import { writeFileSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif";

/** The link every template that signs a person in uses: the app verifies the hashed token itself, so it works from any device. */
const CONFIRM_LINK = "{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email";

const button = (href, label) => `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
                <tr>
                  <td align="center" bgcolor="#2563eb" style="border-radius:8px;">
                    <a href="${href}" target="_blank" style="display:inline-block;min-width:200px;padding:14px 28px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;text-align:center;">${label}</a>
                  </td>
                </tr>
              </table>`;

const fallback = (href) => `
              <p style="margin:20px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:#64748b;">Button not working? Copy this address into your browser:</p>
              <p style="margin:4px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:18px;color:#334155;word-break:break-all;"><a href="${href}" style="color:#1d4ed8;text-decoration:underline;">${href}</a></p>`;

const note = (text) => `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
                <tr>
                  <td style="border-top:1px solid #e2e8f0;padding-top:20px;font-family:${FONT};font-size:13px;line-height:20px;color:#64748b;">${text}</td>
                </tr>
              </table>`;

/** The Service Pacts lockup (mark and name, ink, transparent PNG) hosted on Cloudinary; PNG because Gmail and Outlook do not show SVG. 1256 x 256 pixels, shown at 177 x 36. */
const LOGO = "https://res.cloudinary.com/ddilbzpki/image/upload/v1795633958/lockup-ink-transparent_hgb2hd.png";

/** The shared frame. `body` is the card's content; `preheader` is the grey preview line an inbox shows beside the subject. */
const layout = ({ title, preheader, body }) => `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light only" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f8fe;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f6f8fe;font-size:1px;line-height:1px;">${preheader}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f8fe" style="background:#f6f8fe;">
      <tr>
        <td align="center" style="padding:32px 16px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
            <tr>
              <td style="padding:0 4px 20px;">
                <img src="${LOGO}" width="177" height="36" alt="Service Pacts" style="display:block;border:0;outline:none;height:36px;width:177px;" />
              </td>
            </tr>
            <tr>
              <td bgcolor="#ffffff" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:36px 32px 32px;">
${body}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:18px;color:#64748b;text-align:center;">
                Sent to {{ .Email }}<br />
                Service Pacts &middot; Recurring service agreements for trade contractors<br />
                Questions? <a href="mailto:support@servicepacts.com" style="color:#1d4ed8;text-decoration:underline;">support@servicepacts.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

const heading = (text) => `
              <h1 style="margin:0 0 12px;font-family:${FONT};font-size:24px;line-height:30px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;">${text}</h1>`;
const paragraph = (text) => `
              <p style="margin:0 0 12px;font-family:${FONT};font-size:16px;line-height:26px;color:#334155;">${text}</p>`;

const IGNORE = "If you did not ask for this, you can ignore this email: nothing happens until the button is pressed, and no one can open your account without it.";

/** Each template: the dashboard's name, the subject line, the preheader and the card content. */
const TEMPLATES = [
  {
    file: "magic-link.html",
    name: "Magic link",
    subject: "Your Service Pacts sign-in link",
    title: "Sign in to Service Pacts",
    preheader: "Press the button to sign in. No password needed.",
    body: [
      heading("Sign in to Service Pacts"),
      paragraph("Press the button to sign in. There is no password to remember: this link is yours alone, works once and expires soon."),
      button(CONFIRM_LINK, "Sign in"),
      fallback(CONFIRM_LINK),
      note(IGNORE),
    ],
  },
  {
    file: "confirm-signup.html",
    name: "Confirm sign up",
    subject: "Welcome to Service Pacts: open your workspace",
    title: "Welcome to Service Pacts",
    preheader: "One press confirms your email and opens your workspace.",
    body: [
      heading("Welcome to Service Pacts"),
      paragraph("You are one press away from your workspace. Confirm your email address and we will sign you in: from a customer's equipment list to a signed recurring agreement, all in one place."),
      button(CONFIRM_LINK, "Open my workspace"),
      fallback(CONFIRM_LINK),
      note("This is how you sign in the first time. Next time, ask for a sign-in link from the sign-in page. " + IGNORE),
    ],
  },
  {
    file: "invite-user.html",
    name: "Invite user",
    subject: "You have been invited to Service Pacts",
    title: "You have been invited to Service Pacts",
    preheader: "Accept the invitation to join your team's workspace.",
    body: [
      heading("You have been invited to Service Pacts"),
      paragraph("A teammate has invited you to join their company's workspace, where your team builds and sends recurring service agreements to customers."),
      button("{{ .ConfirmationURL }}", "Accept the invitation"),
      fallback("{{ .ConfirmationURL }}"),
      note("Not expecting this? You can ignore it; the invitation does nothing until it is accepted."),
    ],
  },
  {
    file: "change-email.html",
    name: "Change email address",
    subject: "Confirm your new Service Pacts email address",
    title: "Confirm your new email address",
    preheader: "Confirm the change from {{ .Email }} to {{ .NewEmail }}.",
    body: [
      heading("Confirm your new email address"),
      paragraph("You asked to change the email on your Service Pacts account from <strong style=\"color:#0f172a;\">{{ .Email }}</strong> to <strong style=\"color:#0f172a;\">{{ .NewEmail }}</strong>."),
      button("{{ .ConfirmationURL }}", "Confirm the change"),
      fallback("{{ .ConfirmationURL }}"),
      note("If you did not ask for this, do not press the button and tell us at support@servicepacts.com."),
    ],
  },
  {
    file: "reauthentication.html",
    name: "Reauthentication",
    subject: "Your Service Pacts confirmation code",
    title: "Your confirmation code",
    preheader: "Your code is {{ .Token }}.",
    body: [
      heading("Your confirmation code"),
      paragraph("Enter this code to confirm it is really you:"),
      `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 8px;">
                <tr>
                  <td bgcolor="#eff6ff" style="border:1px solid #bfdbfe;border-radius:12px;padding:16px 28px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:32px;line-height:36px;font-weight:700;letter-spacing:0.28em;color:#1e40af;">{{ .Token }}</td>
                </tr>
              </table>`,
      note("The code works once and expires soon. Never share it with anyone. If you did not ask for it, you can ignore this email and nothing will change."),
    ],
  },
];

for (const template of TEMPLATES) {
  writeFileSync(path.join(HERE, template.file), layout({ title: template.title, preheader: template.preheader, body: template.body.join("") }));
  console.log(`${template.file.padEnd(22)} ${template.name.padEnd(22)} ${template.subject}`);
}
