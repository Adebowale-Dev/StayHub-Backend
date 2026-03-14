require('dotenv').config();
const mongoose = require('mongoose');
async function listPaymentCodes() {
    try {
        console.log('📊 Connecting to database...\n');
        await mongoose.connect(process.env.MONGODB_URI);
        const Payment = require('./src/models/Payment');
        const Student = require('./src/models/Student');
        console.log('🔍 Fetching recent payments...\n');
        console.log('='.repeat(100));
        console.log(`${'Code'.padEnd(10)} | ${'Status'.padEnd(12)} | ${'Student'.padEnd(30)} | ${'Email'.padEnd(30)} | ${'Date'}`);
        console.log('='.repeat(100));
        const payments = await Payment.find()
            .populate('student', 'firstName lastName email matricNo paymentStatus')
            .sort({ createdAt: -1 })
            .limit(20);
        if (payments.length === 0) {
            console.log('No payments found in database.');
        }
        else {
            payments.forEach(payment => {
                const student = payment.student;
                const studentName = student
                    ? `${student.firstName} ${student.lastName}`.padEnd(30)
                    : 'Unknown'.padEnd(30);
                const email = student?.email?.padEnd(30) || 'N/A'.padEnd(30);
                const date = new Date(payment.createdAt).toLocaleString();
                console.log(`${payment.paymentCode.padEnd(10)} | ` +
                    `${payment.status.padEnd(12)} | ` +
                    `${studentName} | ` +
                    `${email} | ` +
                    `${date}`);
            });
            console.log('='.repeat(100));
            console.log(`\n📊 Summary:`);
            console.log(`   Total payments shown: ${payments.length}`);
            const statusCounts = payments.reduce((acc, p) => {
                acc[p.status] = (acc[p.status] || 0) + 1;
                return acc;
            }, {});
            console.log('\n   Status breakdown:');
            Object.entries(statusCounts).forEach(([status, count]) => {
                console.log(`     ${status}: ${count}`);
            });
            const pendingPayments = payments.filter(p => p.status === 'pending');
            if (pendingPayments.length > 0) {
                console.log('\n⏳ Pending Payments (waiting for verification):');
                pendingPayments.forEach(p => {
                    const student = p.student;
                    console.log(`   Code: ${p.paymentCode} | Student: ${student?.firstName} ${student?.lastName} | Email: ${student?.email}`);
                });
            }
            console.log('\n✅ Payment codes you can test with:');
            const testable = payments.filter(p => p.status === 'pending' || p.status === 'completed');
            if (testable.length > 0) {
                testable.slice(0, 5).forEach(p => {
                    const student = p.student;
                    console.log(`   ${p.paymentCode} - ${student?.firstName} ${student?.lastName} (${p.status})`);
                });
            }
            else {
                console.log('   No testable payment codes found. Initialize a payment first.');
            }
        }
        await mongoose.disconnect();
        console.log('\n✅ Done!\n');
    }
    catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}
listPaymentCodes();
