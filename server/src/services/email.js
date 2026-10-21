import nodemailer from "nodemailer";

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (!host || !user || !pass) {
    throw new Error("Email SMTP configuration is incomplete.");
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return transporter;
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  const mailer = getTransporter();

  await mailer.sendMail({
    from: {
      name: "Solyce",
      address: process.env.SMTP_USER,
    },
    to,
    subject: "Réinitialisation de votre mot de passe Solyce",
    text: [
      "Bonjour,",
      "",
      "Vous avez demandé à réinitialiser votre mot de passe Solyce.",
      "Ouvrez le lien ci-dessous pour choisir un nouveau mot de passe :",
      "",
      resetUrl,
      "",
      "Ce lien expire dans 30 minutes et ne peut être utilisé qu'une seule fois.",
      "Si vous n'avez pas effectué cette demande, ignorez cet e-mail.",
      "",
      "L'équipe Solyce",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:560px;margin:auto">
        <h2>Réinitialisation de votre mot de passe</h2>
        <p>Bonjour,</p>
        <p>Vous avez demandé à réinitialiser votre mot de passe Solyce.</p>
        <p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px">
            Choisir un nouveau mot de passe
          </a>
        </p>
        <p>Ce lien expire dans 30 minutes et ne peut être utilisé qu'une seule fois.</p>
        <p>Si vous n'avez pas effectué cette demande, ignorez cet e-mail.</p>
        <p>L'équipe Solyce</p>
      </div>
    `,
  });
}
