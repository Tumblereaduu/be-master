// utils/email.js
const nodemailer = require('nodemailer');
require('dotenv').config();
const path = require('path');
const fs = require('fs');

let transporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
} else {
  // fallback to logger (useful for dev)
  transporter = {
    sendMail: async (mailOptions) => {
      console.log('--- EMAIL SEND FALLBACK ---');
      console.log('To:', mailOptions.to);
      console.log('Subject:', mailOptions.subject);
      console.log('Text:', mailOptions.text);
      console.log('HTML:', mailOptions.html);
      console.log('---------------------------');
      return Promise.resolve();
    }
  };
}

// Template for sending the email otp
async function sendOtpEmail(toEmail, otp) {
  // Local paths for images
  const logopath = path.join(process.cwd(), 'public/images/DoinFx.png');
  const passpath = path.join(process.cwd(), 'public/images/Password.png');
  const instagrampath = path.join(process.cwd(), 'public/images/instagram.png');
  const linkedinpath = path.join(process.cwd(), 'public/images/linkedin.png');
  const twitterpath = path.join(process.cwd(), 'public/images/twitter.png');
  const youtubepath = path.join(process.cwd(), 'public/images/youtube.png');
  const facebookpath = path.join(process.cwd(), 'public/images/facebook.png');

  const subject = "🔐 DOINFX | Your Verification OTP";
  const text = `Your OTP is ${otp}. It is valid for 10 minutes.`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color:#333; padding:20px; text-align:center;">

      <!-- Top Logo with background -->
      <div style="margin-bottom:15px; background-color:#FEF9F3; padding:20px; border-radius:8px; display:block; max-width:1200px;margin-left:auto; margin-right:auto;text-align:center;">
        <img src="cid:doinfx_logo" alt="DOINFX Logo" style="width:120px; height:auto;" />
      </div>

      <p><b>OTP Verification</b></p>

      <!-- Password icon -->
      <div style="margin-top:20px; margin-bottom:20px;">
        <img src="cid:pass_logo" alt="Password Logo" style="width:100px; height:auto;" />
      </div>

      <p>Your One-Time Password (OTP) is:</p>
      <h3 style="display:inline-block; padding:10px 20px; border-radius:4px; letter-spacing:2px;"><b>${otp}</b></h3>

      <p>Please use this code to complete your verification. This OTP is valid for <b>10 minutes</b>.</p>
      <p><b>This is an automated email, please do not reply.</b></p>

      <hr style="margin:25px 0; border-top:1px solid #eee;" />

      <!-- Social Media Icons -->
      <div style="text-align:center; margin-bottom:15px;">
        <a href="https://www.instagram.com/doin.fx/" target="_blank" style="margin:0 5px;"><img src="cid:instagram_logo" alt="Instagram" style="width:40px; height:40px; border-radius:50%;" /></a>
        <a href="https://www.youtube.com/@DoinFX" target="_blank" style="margin:0 5px;"><img src="cid:youtube_logo" alt="Youtube" style="width:40px; height:40px; border-radius:50%;" /></a>
        <a href="https://www.facebook.com/profile.php?id=61584918815314" target="_blank" style="margin:0 5px;"><img src="cid:facebook_logo" alt="Facebook" style="width:40px; height:40px; border-radius:50%;" /></a>
        <a href="https://x.com/DoinFX" target="_blank" style="margin:0 5px;"><img src="cid:twitter_logo" alt="Twitter" style="width:40px; height:40px; border-radius:50%;" /></a>
        <a href="https://www.linkedin.com/in/doin-fx-85b124394/" target="_blank" style="margin:0 5px;"><img src="cid:linkedin_logo" alt="LinkedIn" style="width:40px; height:40px; border-radius:50%;" /></a>
      </div>

      <p style="font-size:12px; color:#777;">Website: www.doinfx.com</p>
      <p style="font-size:12px; color:#777;">Email: support@doinfx.com</p>

    </div>
  `;

  await transporter.sendMail({
    from: "no-reply@rifafx.com",
    to: toEmail,
    subject,
    text,
    html,
    attachments: [
      { filename: "DoinFx.png", path: logopath, cid: "doinfx_logo" },
      { filename: "Password.png", path: passpath, cid: "pass_logo" },
      { filename: "instagram.png", path: instagrampath, cid: "instagram_logo" },
      { filename: "linkedin.png", path: linkedinpath, cid: "linkedin_logo" },
      { filename: "twitter.png", path: twitterpath, cid: "twitter_logo" },
      { filename: "youtube.png", path: youtubepath, cid: "youtube_logo" },
      { filename: "facebook.png", path: facebookpath, cid: "facebook_logo" },
    ]
  });
}

// Template for sending the forgot password OTP email
async function sendForgotPasswordOtpEmail(toEmail, otp) {

  // Local paths for images
  const logopath = path.join(process.cwd(), 'public/images/DoinFx.png');
  const passpath = path.join(process.cwd(), 'public/images/Password.png');
  const instagrampath = path.join(process.cwd(), 'public/images/instagram.png');
  const linkedinpath = path.join(process.cwd(), 'public/images/linkedin.png');
  const twitterpath = path.join(process.cwd(), 'public/images/twitter.png');
  const youtubepath = path.join(process.cwd(), 'public/images/youtube.png');
  const facebookpath = path.join(process.cwd(), 'public/images/facebook.png');

  const subject = 'DOINFX | Password Reset Verification Code';
  
  const text = `
          You have requested to reset your password.

          Your One-Time Password (OTP) is: ${otp}

          This code is valid for 10 minutes. 
          Please do not disclose or share this code with anyone.

          If you did not request a password reset, Please contact us: contact@rifafx.com

          This is an automated email. Do not reply.
  `;

  const html = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color:#333; padding:20px; text-align:center;">

      <!-- Top Logo with background -->
      <div style="margin-bottom:15px; background-color:#FEF9F3; padding:20px; border-radius:8px; display:block; max-width:1200px;margin-left:auto; margin-right:auto;text-align:center;">
        <img src="cid:doinfx_logo" alt="DOINFX Logo" style="width:120px; height:auto;" />
      </div>

      <p><b>Password Reset OTP Verification</b></p>

      <!-- Password icon -->
      <div style="margin-top:20px; margin-bottom:20px;">
        <img src="cid:pass_logo" alt="Password Logo" style="width:100px; height:auto;" />
      </div>

      <p>Your One-Time Password (OTP) is:</p>
      <h3 style="display:inline-block; padding:10px 20px; border-radius:4px; letter-spacing:2px;"><b>${otp}</b></h3>

      <p>Please use this code to complete your verification. This OTP is valid for <b>10 minutes</b>.</p>
      <p><b>This is an automated email, please do not reply.</b></p>

      <hr style="margin:25px 0; border-top:1px solid #eee;" />

      <!-- Social Media Icons -->
      <div style="text-align:center; margin-bottom:15px;">
        <a href="https://www.instagram.com/doin.fx/" target="_blank" style="margin:0 5px;"><img src="cid:instagram_logo" alt="Instagram" style="width:40px; height:40px; border-radius:50%;" /></a>
        <a href="https://www.youtube.com/@DoinFX" target="_blank" style="margin:0 5px;"><img src="cid:youtube_logo" alt="Youtube" style="width:40px; height:40px; border-radius:50%;" /></a>
        <a href="https://www.facebook.com/profile.php?id=61584918815314" target="_blank" style="margin:0 5px;"><img src="cid:facebook_logo" alt="Facebook" style="width:40px; height:40px; border-radius:50%;" /></a>
        <a href="https://x.com/DoinFX" target="_blank" style="margin:0 5px;"><img src="cid:twitter_logo" alt="Twitter" style="width:40px; height:40px; border-radius:50%;" /></a>
        <a href="https://www.linkedin.com/in/doin-fx-85b124394/" target="_blank" style="margin:0 5px;"><img src="cid:linkedin_logo" alt="LinkedIn" style="width:40px; height:40px; border-radius:50%;" /></a>
      </div>

      <p style="font-size:12px; color:#777;">Website: www.doinfx.com</p>
      <p style="font-size:12px; color:#777;">Email: support@doinfx.com</p>

    </div>

  `;
console.log("LOGO EXISTS:", fs.existsSync(logopath));
  await transporter.sendMail({
    from: 'no-reply@example.com',
    to: toEmail,
    subject,
    text: text.trim(),
    html,
      attachments: [
      { filename: "DoinFx.png", path: logopath, cid: "doinfx_logo" },
      { filename: "Password.png", path: passpath, cid: "pass_logo" },
      { filename: "instagram.png", path: instagrampath, cid: "instagram_logo" },
      { filename: "linkedin.png", path: linkedinpath, cid: "linkedin_logo" },
      { filename: "twitter.png", path: twitterpath, cid: "twitter_logo" },
      { filename: "youtube.png", path: youtubepath, cid: "youtube_logo" },
      { filename: "facebook.png", path: facebookpath, cid: "facebook_logo" },
    ]
  });
}

// ================= KYC VERIFIED =================
async function sendKycEmail({ toEmail, username, status, reason }) {

  let subject = "";
  let text = "";
  let html = "";

  const PHOTO_LABELS = {
  photo_id_1: "FRONT PROOF",
  photo_id_2: "BACK PROOF",
  photo_id_3: "BANK PROOF",
};

if (reason) {
  const readableReason = Object.entries(reason)
    .map(([key, val]) => `${PHOTO_LABELS[key] || key}: ${val}`)
    .join(", ");
}

  if (status === "approved") {
    subject = "✔️ RIFAFX | KYC Verification Successful";
    text = `Hello ${username}, your KYC has been successfully verified.`;

    html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color:#333; padding:20px;">
        
        <h2 style="color:#0A74DA;">KYC Verification Successful</h2>

        <p>Dear <b>${username}</b>,</p>

        <p>Your <b>KYC verification has been successfully approved</b>.</p>

        <p>Thank you for completing your verification with <b>RIFAFX</b>.</p>

        <hr style="margin:25px 0; border-top:1px solid #eee;" />

        <p style="font-size:12px; color:#777;">This is an automated email. Please do not reply.</p>
        <p>Best Regards,<br/><b>The RIFAFX Team</b></p>

      </div>
    `;
  }

  else if (status === "rejected") {

    subject = "❌ RIFAFX | KYC Verification Rejected";

    let formattedReasons = Object.entries(reason).map(([key, val]) => {
    const label = PHOTO_LABELS[key] || key.replace(/_/g, " ").toUpperCase();
    return `<li>${label}: ${val}</li>`;
  }).join("");

    text = `Hi ${username}, your KYC was rejected for the following reason: ${formattedReasons.replace(/<[^>]*>/g, '')}`;

    html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color:#333; padding:20px;">
        
        <h2 style="color:#d9534f;">KYC Verification Rejected</h2>

        <p>Dear <b>${username}</b>,</p>

        <p>Your KYC verification has been <b style="color:#d9534f;">rejected</b>.</p>
        <p><b>Reason:</b></p>
        <h4>${formattedReasons || "<li>No reason provided.</li>"}</h4>
        <p>Please re-upload valid documents for successful verification.</p>

        <hr style="margin:25px 0; border-top:1px solid #eee;" />

        <p style="font-size:12px; color:#777;">This is an automated email. Please do not reply.</p>
        <p>Best Regards,<br/><b>The RIFAFX Team</b></p>

      </div>
    `;
  }

  await transporter.sendMail({
    from: "no-reply@rifafx.com",
    to: toEmail,
    subject,
    text,
    html
  });
}

// ================= DEPOSIT =================
async function getDepositEmail({ toEmail, amount, username, status, reject_reason }) {

  const formattedAmount = parseFloat(amount).toFixed(2);

  let subject = "";
  let text = "";
  let html = "";

  // SUCCESS
  if (status === "completed") {

    subject = "RIFAFX | Deposit Successful";
    text = `Hello ${username}, your deposit of $${formattedAmount} was successful`;

    html = `
      <div style="font-family:Arial; padding:20px; color:#333;">

        <h2 style="color:#0A74DA;">Deposit Successful</h2>

        <p>Dear <b>${username}</b>,</p>

        <p>Your deposit has been successfully processed.</p>

        <table style="border-collapse:collapse; margin-top:15px;">
          <tr>
            <td style="padding:10px; border:1px solid #ddd;"><b>Amount</b></td>
            <td style="padding:10px; border:1px solid #ddd; color:green;"><b>$${formattedAmount}</b></td>
          </tr>
          <tr>
            <td style="padding:10px; border:1px solid #ddd;"><b>Status</b></td>
            <td style="padding:10px; border:1px solid #ddd; color:green;">Completed</td>
          </tr>
        </table>

        <p style="margin-top:20px;">Thank you for choosing <b>RIFAFX</b>.</p>

        <hr style="margin:25px 0; border-top:1px solid #eee;" />

        <p style="font-size:12px; color:#777;">This is an automated email. Please do not reply.</p>
        <p>Best Regards,<br/><b>The RIFAFX Team</b></p>
      </div>
    `;
  }

  // REJECTED
  else if (status === "rejected") {

    subject = "RIFAFX | Deposit Rejected";
    text = `Hello ${username}, your deposit was rejected. Reason: ${reject_reason}`;

    html = `
      <div style="font-family:Arial; padding:20px; color:#333;">

        <h2 style="color:#d9534f;">Deposit Rejected</h2>

        <p>Dear <b>${username}</b>,</p>

        <p>Your deposit request could not be processed.</p>

        <table style="border-collapse:collapse; margin-top:15px;">
          <tr>
            <td style="padding:10px; border:1px solid #ddd;"><b>Amount</b></td>
            <td style="padding:10px; border:1px solid #ddd;">$${formattedAmount}</td>
          </tr>
          <tr>
            <td style="padding:10px; border:1px solid #ddd;"><b>Status</b></td>
            <td style="padding:10px; border:1px solid #ddd; color:#d9534f;">Rejected</td>
          </tr>
          <tr>
            <td style="padding:10px; border:1px solid #ddd;"><b>Reason</b></td>
            <td style="padding:10px; border:1px solid #ddd;">${reject_reason}</td>
          </tr>
        </table>

        <p style="margin-top:20px;">If you need help, please contact support.</p>

        <hr style="margin:25px 0; border-top:1px solid #eee;" />

        <p style="font-size:12px; color:#777;">This is an automated email. Please do not reply.</p>
        <p>Best Regards,<br/><b>The RIFAFX Team</b></p>

      </div>
    `;
  }

  await transporter.sendMail({
    from: "no-reply@rifafx.com",
    to: toEmail,
    subject,
    text: text.trim(),
    html
  });
}

// ================= WITHDRAWAL =================
async function getWithdrawalEmail({ toEmail, username, amount, status, withdrawal_reject_reason }) {

  const subject = "RIFAFX | Withdrawal Update";

  const html = `
  <div style="font-family:Arial; padding:20px; color:#333;">

    <h2 style="color:#0A74DA;">Withdrawal Update</h2>

    <p>Dear <b>${username}</b>,</p>

    <p>Your withdrawal request has been updated.</p>

    <table style="border-collapse:collapse; margin-top:20px;">
      <tr>
        <td style="padding:10px;border:1px solid #ddd;"><b>Amount</b></td>
        <td style="padding:10px;border:1px solid #ddd;">$${amount}</td>
      </tr>

      <tr>
        <td style="padding:10px;border:1px solid #ddd;"><b>Status</b></td>
        <td style="padding:10px;border:1px solid #ddd; text-transform:capitalize;">
          ${status}
        </td>
      </tr>

      ${
        status === "rejected"
          ? `
      <tr>
        <td style="padding:10px;border:1px solid #ddd;"><b>Reject Reason</b></td>
        <td style="padding:10px;border:1px solid #ddd;">${withdrawal_reject_reason}</td>
      </tr>
      `
          : ""
      }
    </table>

    <p style="margin-top:20px;">For any questions, please contact support.</p>

    <hr style="margin:25px 0; border-top:1px solid #eee;" />

    <p style="font-size:12px; color:#777;">This is an automated email. Please do not reply.</p>
    <p>Best Regards,<br/><b>The RIFAFX Team</b></p>

  </div>
  `;

  await transporter.sendMail({
    from: "no-reply@rifafx.com",
    to: toEmail,
    subject,
    text: html.replace(/<[^>]*>?/gm, ""), // plain text fallback
    html
  });
}

// ================= SUPPORT =================
async function getSupportEmail({ toEmail, username, reply }) {

  const subject = "RIFAFX | Support Reply";

  const html = `
    <div style="font-family:Arial; padding:20px; line-height:1.6; color:#333;">

      <h2 style="color:#0A74DA;">Support Reply</h2>

      <p>Dear <b>${username}</b>,</p>

      <p>You have received a new reply from our support team:</p>

      <blockquote style="border-left:4px solid #0A74DA; padding-left:12px; color:#555;">
        ${reply}
      </blockquote>

      <p>Please log in to your RIFAFX account to view full details.</p>

      <hr style="margin:25px 0; border-top:1px solid #eee;" />

      <p style="font-size:12px; color:#777;">This is an automated email. Please do not reply.</p>
      <p>Best Regards,<br/><b>The RIFAFX Team</b></p>

    </div>
  `;

  await transporter.sendMail({
    from: "no-reply@rifafx.com",
    to: toEmail,
    subject,
    text: html.replace(/<[^>]*>?/gm, ""),
    html
  });
}


module.exports = { sendOtpEmail, sendForgotPasswordOtpEmail, sendKycEmail, getDepositEmail, getWithdrawalEmail, getSupportEmail };
