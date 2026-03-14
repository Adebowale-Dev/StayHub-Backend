require('dotenv').config();
const notificationService = require('./src/services/notificationService');
async function testPaymentEmail() {
    try {
        console.log('🧪 Testing payment code email...\n');
        const testStudentId = '674f7e0bb09e3d2e10ae2a46';
        const testPaymentCode = 'TEST123';
        const testReference = 'PAY-TEST-' + Date.now();
        console.log('📧 Sending test email with:');
        console.log('   Student ID:', testStudentId);
        console.log('   Payment Code:', testPaymentCode);
        console.log('   Reference:', testReference);
        console.log('   Email Config:', {
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            user: process.env.EMAIL_USER,
            from: process.env.EMAIL_FROM
        });
        console.log('\n⏳ Sending email...\n');
        await notificationService.sendPaymentCode(testStudentId, testPaymentCode, testReference);
        console.log('\n✅ Test email sent successfully!');
        console.log('📬 Check the student\'s email inbox (and spam folder)');
        process.exit(0);
    }
    catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}
testPaymentEmail();
