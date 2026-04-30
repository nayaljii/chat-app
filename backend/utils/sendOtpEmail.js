const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // TLS
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function sendOtpEmail(to, otp) {
    const mailOptions = {
        from: `"Vish'sUp" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: "Your OTP for Vish'sUp",
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Email Verification</h2>
                <p>Your OTP is:</p>
                <h1 style="letter-spacing: 5px;">${otp}</h1>
                <p>This OTP will expire in 5 minutes.</p>
            </div>
            `,
    };
    await transporter.sendMail(mailOptions);
}

module.exports = sendOtpEmail;