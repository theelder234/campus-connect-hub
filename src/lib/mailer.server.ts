import nodemailer from "nodemailer";

function transporter() {
  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS).");
  }
  const port = Number(process.env["SMTP_PORT"] ?? 587);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function shell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
    <div style="font-size:18px;font-weight:700;margin-bottom:16px">CampusLink</div>
    <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
    ${body}
    <p style="margin-top:28px;font-size:12px;color:#6b7280">Sent by CampusLink · campusLink.mau.edu.ng</p>
  </div></body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${href}" style="background:#4338ca;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">${label}</a></p>
  <p style="font-size:12px;color:#6b7280;word-break:break-all">${href}</p>`;
}

export async function sendMail(to: string, subject: string, html: string) {
  const from = process.env["SMTP_FROM"] ?? "CampusLink <no-reply@campuslink.mau.edu.ng>";
  await transporter().sendMail({ from, to, subject, html });
}

export async function sendConfirmationMail(to: string, link: string) {
  await sendMail(
    to,
    "Confirm your CampusLink account",
    shell(
      "Confirm your email",
      `<p style="line-height:1.6">Welcome to CampusLink. Confirm this email address to activate your account and get access to campus chat, resources and the AI tutor.</p>${button(link, "Confirm my email")}<p style="font-size:12px;color:#6b7280">If you didn't sign up, you can ignore this message.</p>`,
    ),
  );
}

export async function sendWelcomeMail(to: string, name: string, appUrl: string) {
  await sendMail(
    to,
    "Welcome to CampusLink 🎓",
    shell(
      `Welcome, ${name}!`,
      `<p style="line-height:1.6">Your CampusLink account is ready. Here's what you can do:</p>
       <ul style="line-height:1.8;padding-left:18px">
         <li>Chat in real time with classmates and lecturers</li>
         <li>Share and find course resources</li>
         <li>Turn PDFs into study notes and flashcards</li>
         <li>Ask the 24/7 Socratic AI tutor</li>
       </ul>${button(appUrl, "Open CampusLink")}`,
    ),
  );
}

export async function sendOtpMail(to: string, code: string) {
  await sendMail(
    to,
    `${code} is your CampusLink verification code`,
    shell(
      "Verify your email",
      `<p style="line-height:1.6">Enter this code in CampusLink to activate your account:</p>
       <p style="margin:24px 0;font-size:34px;font-weight:800;letter-spacing:10px;background:#f3f4f6;border-radius:10px;padding:16px;text-align:center">${code}</p>
       <p style="font-size:12px;color:#6b7280">The code expires in 10 minutes. If you didn't sign up, ignore this message.</p>`,
    ),
  );
}
