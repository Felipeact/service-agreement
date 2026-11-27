# Sign-in email templates

The emails Supabase Auth sends, in the Service Pacts look ([docs/DESIGN.md](../../docs/DESIGN.md), "Field Protocol"): the blue mark,
a white card on the pale ground, one big blue button, the link written out for clients that block buttons, and a plain "ignore this
if it was not you" line. Tables, inline styles and system fonts only, because email clients drop most CSS; the logo is
`web/public/brand/email-mark.png` (PNG, since Gmail and Outlook do not show SVG), loaded from `{{ .SiteURL }}/brand/email-mark.png`.

Edit `build.mjs` (one shared layout, then each message) and run `node supabase/templates/build.mjs` to rewrite the `.html` files.
The `.html` files are what you paste into the dashboard: **Authentication > Emails > Templates**, one per tab, with the subject below.

| Template (dashboard tab) | File | Subject | Sent when |
|---|---|---|---|
| **Magic link** | `magic-link.html` | Your Service Pacts sign-in link | A member asks for a sign-in link; also a teammate who already has an account is re-invited |
| **Confirm sign up** | `confirm-signup.html` | Welcome to Service Pacts: open your workspace | The first email to a new person: a new owner after checkout, or a newly invited teammate (the app sends both with `signInWithOtp`, `shouldCreateUser: true`) |
| Invite user | `invite-user.html` | You have been invited to Service Pacts | Only if the app one day uses `inviteUserByEmail` (it does not today) |
| Change email address | `change-email.html` | Confirm your new Service Pacts email address | Only if a change-email screen is built (none yet) |
| Reauthentication | `reauthentication.html` | Your Service Pacts confirmation code | Only if a flow asks for a re-check code (none yet) |

**The two that matter today are Magic link and Confirm sign up.** Both link to
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, the address the app verifies itself, so the link works from any
browser or phone ([auth-magic-link plan](../../.specs/features/auth-magic-link/plan.md)). The other three use Supabase's own
`{{ .ConfirmationURL }}` and are ready for when those flows exist; the app's `/auth/confirm` route accepts only `type=email`, so
widen it first if you start using them.

## Check before pasting

- **Site URL** (Authentication > URL Configuration) is `https://servicepacts.com`. The link and the logo are built from it.
- **Variables used:** `{{ .SiteURL }}`, `{{ .TokenHash }}`, `{{ .Token }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .ConfirmationURL }}`.
- After pasting, send yourself a sign-in link and open it on your phone: the button should be full width of the card and the logo visible.
- Sender: with custom SMTP (Resend, `servicepacts.com` is verified) set the sender name to "Service Pacts" so the inbox shows it, not the address.

## Possible next step

The Confirm sign up email cannot say who invited the person or to which company, because the app does not pass that along. Passing
`org_name` and the inviter in `signInWithOtp({ options: { data } })` would let the template say "Pat invited you to Acme HVAC" with
`{{ .Data.org_name }}`. Not done yet.
