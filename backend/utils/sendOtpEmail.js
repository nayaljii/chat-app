const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendOtpEmail(to, otp) {
    const { data, error } = await resend.emails.send({
        from: "Vish'sUp <no-reply@vishsup.duckdns.org>",
        to: [to],
        subject: "Your OTP for Vish'sUp",
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Email Verification</h2>
                <p>Your OTP is:</p>
                <h1 style="letter-spacing: 5px;">${otp}</h1>
                <p>This OTP will expire in 5 minutes.</p>
            </div>
        `,
    });

    if (error) {
        console.error("Resend email error:", error);
        throw new Error(error.message || "Failed to send email");
    }

    return data;
}

module.exports = sendOtpEmail;