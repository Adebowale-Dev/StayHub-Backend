require('dotenv').config();
const nodemailer = require('nodemailer');
async function testSMTPConnection() {
    console.log('🔌 Testing SMTP connection to Gmail...\n');
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
        },
    });
    console.log('Configuration:');
    console.log('  Host:', process.env.EMAIL_HOST);
    console.log('  Port:', process.env.EMAIL_PORT);
    console.log('  User:', process.env.EMAIL_USER);
    console.log('  Password:', process.env.EMAIL_PASSWORD ? '****' + process.env.EMAIL_PASSWORD.slice(-4) : 'NOT SET');
    console.log('\n⏳ Verifying connection...\n');
    try {
        await transporter.verify();
        console.log('✅ SMTP connection successful!');
        console.log('📧 Email service is ready to send emails\n');
        console.log('Would you like to send a test email? (Y/n)');
        console.log('Press Ctrl+C to skip or wait 5 seconds for test email...\n');
        setTimeout(async () => {
            try {
                const info = await transporter.sendMail({
                    from: process.env.EMAIL_FROM,
                    to: process.env.EMAIL_USER,
                    subject: 'StayHub Email Test',
                    html: `
            <h2>✅ Email Configuration Successful!</h2>
            <p>This is a test email from StayHub backend.</p>
            <p>If you received this, your email service is working correctly.</p>
            <hr>
            <small>Sent at ${new Date().toLocaleString()}</small>
          `
                });
                console.log('✅ Test email sent successfully!');
                console.log('📬 Message ID:', info.messageId);
                console.log('📧 Check your inbox:', process.env.EMAIL_USER);
                process.exit(0);
            }
            catch (error) {
                console.error('❌ Failed to send test email:', error.message);
                process.exit(1);
            }
        }, 5000);
    }
    catch (error) {
        console.error('❌ SMTP connection failed!');
        console.error('Error:', error.message);
        console.log('\n💡 Common solutions:');
        console.log('  1. Make sure you\'re using a Gmail App Password, not your regular password');
        console.log('  2. Verify EMAIL_USER and EMAIL_PASSWORD in .env');
        console.log('  3. Check your internet connection');
        console.log('  4. Make sure 2-factor authentication is enabled on Gmail');
        process.exit(1);
    }
}
testSMTPConnection();
