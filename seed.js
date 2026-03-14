require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Admin = require("./src/models/Admin");
const College = require("./src/models/College");
const Department = require("./src/models/Department");
const Student = require("./src/models/Student");
const Hostel = require("./src/models/Hostel");
const Porter = require("./src/models/Porter");
const Room = require("./src/models/Room");
const Bunk = require("./src/models/Bunk");
const Payment = require("./src/models/Payment");
const PaymentConfig = require("./src/models/PaymentConfig");
const collegesAndDepartments = {
    "College of Agriculture, Engineering and Science": {
        code: "COAES",
        departments: {
            Microbiology: "MIC",
            "Pure & Applied Biology": "BIO",
            Biochemistry: "BCH",
            "Industrial Chemistry": "CHM",
            Mathematics: "MTH",
            Statistics: "STA",
            Physics: "PHY",
            "Bachelor of Agriculture (B.Agric.)": "AGR",
            "Food Science and Technology": "FST",
            "Electrical/Electronics Engineering": "EEE",
            "Mechatronics Engineering": "MCT",
            "Agricultural Extension & Rural Development": "AER",
        },
    },
    "College of Management and Social Sciences": {
        code: "COMSS",
        departments: {
            Accounting: "ACC",
            "Banking and Finance": "BNF",
            "Business Administration": "BUS",
            "Industrial Relations & Personnel Management": "IRP",
            Economics: "ECO",
            Sociology: "SOC",
            "Political Science": "POL",
            "International Relations": "INT",
            "Political and Law": "PAL",
        },
    },
    "College of Law": {
        code: "COLAW",
        departments: {
            "Law (LL.B.)": "LAW",
        },
    },
    "College of Liberal Studies": {
        code: "COLBS",
        departments: {
            Music: "MUS",
            "Theatre Arts": "THA",
            English: "ENG",
            "History & International Studies": "HIS",
            "Religious Studies": "REL",
        },
    },
    "College of Health Sciences": {
        code: "COHES",
        departments: {
            Anatomy: "ANA",
            Physiology: "PHS",
            "Medicine & Surgery (MBBS)": "MED",
            "Nursing Science": "NUR",
            Physiotherapy: "PHT",
            "Public Health": "PHU",
            "Medical Laboratory Science (BMLS)": "MLS",
            "Nutrition & Dietetics": "NUT",
        },
    },
    "College of Computing and Communication Studies": {
        code: "COCCS",
        departments: {
            "Computer Science": "CSC",
            "Mass Communication": "MAS",
            "Communication Arts": "CMA",
            "Cyber Security": "CYB",
            "Software Engineering": "SEN",
            "Information Technology": "IFT",
        },
    },
    "College of Environmental Sciences": {
        code: "COEVS",
        departments: {
            Architecture: "ARC",
        },
    },
};
const maleNames = [
    "Adebayo", "Emmanuel", "Ibrahim", "Kunle", "Muhammad",
    "Oluwatobi", "Samuel", "Uche", "Williams", "Ahmed",
    "Chinedu", "Daniel", "Felix", "Hassan", "Joshua",
];
const femaleNames = [
    "Chioma", "Fatima", "Jennifer", "Loveth", "Ngozi",
    "Peace", "Temitope", "Victoria", "Yetunde", "Zainab",
    "Blessing", "Esther", "Grace", "Ifeoma", "Kemi",
];
const firstNames = [...maleNames, ...femaleNames];
const lastNames = [
    "Adeyemi", "Bello", "Chukwu", "Danjuma", "Eze",
    "Fawole", "Garba", "Hassan", "Idris", "James",
    "Kalu", "Lawal", "Musa", "Nwosu", "Obi",
    "Peters", "Quadri", "Raji", "Sani", "Taiwo",
    "Usman", "Victor", "Williams", "Yusuf", "Afolabi",
];
function generateMatricNo(year, deptCode, index) {
    const yearCode = year.toString().slice(-2);
    const studentNumber = String(index).padStart(4, "0");
    return `BU${yearCode}${deptCode}${studentNumber}`;
}
function generateEmail(firstName, lastName, matricNo) {
    const cleanFirst = firstName.toLowerCase().replace(/\s/g, "");
    const cleanLast = lastName.toLowerCase().replace(/\s/g, "");
    return `${cleanFirst}.${cleanLast}.${matricNo.toLowerCase()}@student.bowenuniversity.edu.ng`;
}
function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ Connected to MongoDB");
    }
    catch (error) {
        console.error("❌ MongoDB connection error:", error);
        process.exit(1);
    }
}
async function clearDatabase() {
    console.log("\n🗑️  Clearing database...");
    const paymentConfigCount = await PaymentConfig.countDocuments();
    await PaymentConfig.deleteMany({});
    console.log(`   ✓ Deleted ${paymentConfigCount} payment configs`);
    const paymentCount = await Payment.countDocuments();
    await Payment.deleteMany({});
    console.log(`   ✓ Deleted ${paymentCount} payments`);
    const bunkCount = await Bunk.countDocuments();
    await Bunk.deleteMany({});
    console.log(`   ✓ Deleted ${bunkCount} bunks`);
    const roomCount = await Room.countDocuments();
    await Room.deleteMany({});
    console.log(`   ✓ Deleted ${roomCount} rooms`);
    const studentCount = await Student.countDocuments();
    await Student.deleteMany({});
    console.log(`   ✓ Deleted ${studentCount} students`);
    const hostelCount = await Hostel.countDocuments();
    await Hostel.deleteMany({});
    console.log(`   ✓ Deleted ${hostelCount} hostels`);
    const porterCount = await Porter.countDocuments();
    await Porter.deleteMany({});
    console.log(`   ✓ Deleted ${porterCount} porters`);
    const deptCount = await Department.countDocuments();
    await Department.deleteMany({});
    console.log(`   ✓ Deleted ${deptCount} departments`);
    const collegeCount = await College.countDocuments();
    await College.deleteMany({});
    console.log(`   ✓ Deleted ${collegeCount} colleges`);
    const adminCount = await Admin.countDocuments();
    await Admin.deleteMany({});
    console.log(`   ✓ Deleted ${adminCount} admins`);
    console.log("✅ Database cleared - All collections empty");
}
async function seedColleges() {
    console.log("\n🏛️  Creating colleges and departments...");
    const createdColleges = [];
    for (const [collegeName, collegeInfo] of Object.entries(collegesAndDepartments)) {
        const college = await College.create({
            name: collegeName,
            code: collegeInfo.code,
            description: `${collegeName} at Bowen University`,
        });
        createdColleges.push(college);
        for (const [deptName, deptCode] of Object.entries(collegeInfo.departments)) {
            await Department.create({
                name: deptName,
                code: deptCode,
                college: college._id,
                description: `Department of ${deptName}`,
            });
        }
        console.log(`   ✓ ${collegeName} (${collegeInfo.code}) - ${Object.keys(collegeInfo.departments).length} departments`);
    }
    console.log(`✅ Created ${createdColleges.length} colleges with departments`);
    return createdColleges;
}
async function createAdmin() {
    console.log("\n👤 Creating admin account...");
    const existingAdmin = await Admin.findOne({ email: "adebowale235@gmail.com" });
    if (existingAdmin) {
        console.log("⚠️  Admin already exists");
        return existingAdmin;
    }
    const admin = await Admin.create({
        email: "adebowale235@gmail.com",
        password: "Adebowale2001",
        firstName: "Stephen",
        lastName: "Administrator",
        role: "admin",
        isActive: true,
        firstLogin: false,
    });
    console.log("✅ Admin created");
    console.log(" Email: adebowale235@gmail.com");
    console.log(" Password: Adebowale2001");
    return admin;
}
async function createPorter() {
    console.log("\n👮 Creating porter account...");
    const existingPorter = await Porter.findOne({ email: "porter@stayhub.com" });
    if (existingPorter) {
        console.log("⚠️  Porter already exists");
        return existingPorter;
    }
    const porter = await Porter.create({
        email: "porter@stayhub.com",
        password: "Porter123",
        firstName: "John",
        lastName: "Porter",
        phoneNumber: "08012345678",
        employeeId: "EMP001",
        joinedDate: new Date("2024-01-15"),
        status: "active",
        approved: true,
        approvedDate: new Date(),
        shiftSchedule: "Day Shift (8AM - 4PM)",
        firstLogin: false,
    });
    console.log("✅ Porter created");
    console.log(" Email: porter@stayhub.com");
    console.log(" Password: Porter123");
    console.log(" Employee ID: EMP001");
    return porter;
}
async function generateStudents() {
    console.log("\n👨‍🎓 Generating students...");
    const students = [];
    const levels = [100, 200, 300, 400];
    const departmentCounters = {};
    let isFirstComputerScienceStudent = true;
    let isFirstAccountingStudent = true;
    const salt = await bcrypt.genSalt(10);
    console.log(`   🔐 Preparing to hash passwords using first names...`);
    const colleges = await College.find({}).lean();
    for (const college of colleges) {
        const departments = await Department.find({ college: college._id }).lean();
        for (const department of departments) {
            if (!departmentCounters[department.code]) {
                departmentCounters[department.code] = 0;
            }
            const numStudents = Math.floor(Math.random() * 3) + 3;
            for (let i = 0; i < numStudents; i++) {
                departmentCounters[department.code]++;
                let firstName = randomElement(firstNames);
                let lastName = randomElement(lastNames);
                let level = randomElement(levels);
                let enrollmentYear = 2022;
                let matricNo = generateMatricNo(enrollmentYear, department.code, departmentCounters[department.code]);
                let email = generateEmail(firstName, lastName, matricNo);
                let gender = maleNames.includes(firstName) ? 'male' : 'female';
                if (department.code === "CSC" && isFirstComputerScienceStudent) {
                    firstName = "Muhammed";
                    lastName = "Abiodun";
                    matricNo = "BU22CSC1005";
                    email = "muhammedabiodun42@gmail.com";
                    level = 400;
                    gender = 'male';
                    isFirstComputerScienceStudent = false;
                    console.log(`   🎯 Special student: ${firstName} ${lastName} - ${matricNo}`);
                }
                else if (department.code === "ACC" && isFirstAccountingStudent) {
                    firstName = "Mustapha";
                    lastName = "Muhammed";
                    email = "Mustapha.muhammed@bowen.edu.ng";
                    level = randomElement(levels);
                    gender = 'male';
                    isFirstAccountingStudent = false;
                    console.log(`   🎯 Special student: ${firstName} ${lastName} - ${matricNo}`);
                }
                const studentPasswordHash = await bcrypt.hash(firstName, salt);
                const student = {
                    matricNo: matricNo,
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    password: studentPasswordHash,
                    level: level,
                    gender: gender,
                    college: college._id,
                    department: department._id,
                    roommates: [],
                    firstLogin: true,
                    paymentStatus: 'pending',
                    reservationStatus: 'none',
                };
                students.push(student);
            }
        }
    }
    const insertedStudents = await Student.insertMany(students, { validateBeforeSave: false });
    console.log(`✅ Generated ${insertedStudents.length} students`);
    console.log(`   📧 Default password for each student: Their first name`);
    console.log(`\n   Sample Matric Numbers:`);
    console.log(`   - Computer Science: BU22CSC1005 (Muhammed Abiodun) - Password: Muhammed`);
    console.log(`   - Accounting: BU22ACC0001 (Mustapha Muhammed) - Password: Mustapha`);
    return insertedStudents;
}
async function seed() {
    console.log("🌱 Starting StayHub database seed...\n");
    console.log("=".repeat(50));
    try {
        await connectDB();
        await clearDatabase();
        await seedColleges();
        await createAdmin();
        await createPorter();
        const students = await generateStudents();
        console.log("\n" + "=".repeat(50));
        console.log("✅ Seed completed successfully!\n");
        console.log("📋 Summary:");
        console.log(`   - Admin: adebowale235@gmail.com (password: Adebowale2001)`);
        console.log(`   - Porter: porter@stayhub.com (password: Porter123)`);
        console.log(`   - Colleges: 7 colleges created`);
        console.log(`   - Departments: All departments created with codes`);
        console.log(`   - Students: ${students.length} students created`);
        console.log(`   - Special Students:`);
        console.log(`     • Muhammed Abiodun (BU22CSC1005) - muhammedabiodun42@gmail.com - Password: Muhammed`);
        console.log(`     • Mustapha Muhammed (BU22ACC0001) - Mustapha.muhammed@bowen.edu.ng - Password: Mustapha`);
        console.log(`   - Default password for all students: Their first name (e.g., firstName)`);
        console.log(`   - All students can continue using their default password or change it`);
        console.log(`\n🚀 You can now start the server with: npm run dev`);
        console.log("=".repeat(50));
    }
    catch (error) {
        console.error("\n❌ Seed failed:", error);
        console.error(error.stack);
    }
    finally {
        await mongoose.connection.close();
        console.log("\n🔌 Database connection closed");
        process.exit(0);
    }
}
seed();
