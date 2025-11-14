require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Admin = require("./src/models/Admin");
const College = require("./src/models/College");
const Department = require("./src/models/Department");
const Student = require("./src/models/Student");

// College and Department mappings (Bowen University)
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

// Student names for realistic data
const firstNames = [
  "Adebayo", "Chioma", "Emmanuel", "Fatima", "Ibrahim",
  "Jennifer", "Kunle", "Loveth", "Muhammad", "Ngozi",
  "Oluwatobi", "Peace", "Samuel", "Temitope", "Uche",
  "Victoria", "Williams", "Yetunde", "Zainab", "Ahmed",
  "Blessing", "Chinedu", "Daniel", "Esther", "Felix",
  "Grace", "Hassan", "Ifeoma", "Joshua", "Kemi",
];

const lastNames = [
  "Adeyemi", "Bello", "Chukwu", "Danjuma", "Eze",
  "Fawole", "Garba", "Hassan", "Idris", "James",
  "Kalu", "Lawal", "Musa", "Nwosu", "Obi",
  "Peters", "Quadri", "Raji", "Sani", "Taiwo",
  "Usman", "Victor", "Williams", "Yusuf", "Afolabi",
];

/**
 * Generate matric number in BU format with department code
 * Format: BU{YY}{DEPT_CODE}{NUMBER}
 * Example: BU22CSC1005 (Computer Science)
 */
function generateMatricNo(year, deptCode, index) {
  const yearCode = year.toString().slice(-2);
  const studentNumber = String(index).padStart(4, "0");
  return `BU${yearCode}${deptCode}${studentNumber}`;
}

/**
 * Generate email using matric number to ensure uniqueness
 */
function generateEmail(firstName, lastName, matricNo) {
  const cleanFirst = firstName.toLowerCase().replace(/\s/g, "");
  const cleanLast = lastName.toLowerCase().replace(/\s/g, "");
  // Add matric number suffix to ensure uniqueness
  return `${cleanFirst}.${cleanLast}.${matricNo.toLowerCase()}@student.bowenuniversity.edu.ng`;
}

/**
 * Get random element from array
 */
function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
}

/**
 * Clear all collections
 */
async function clearDatabase() {
  console.log("\n🗑️  Clearing database...");
  await Student.deleteMany({});
  await Department.deleteMany({});
  await College.deleteMany({});
  await Admin.deleteMany({});
  console.log("✅ Database cleared");
}

/**
 * Create colleges and departments
 */
async function seedColleges() {
  console.log("\n🏛️  Creating colleges and departments...");

  const createdColleges = [];

  for (const [collegeName, collegeInfo] of Object.entries(collegesAndDepartments)) {
    // Create college
    const college = await College.create({
      name: collegeName,
      code: collegeInfo.code,
      description: `${collegeName} at Bowen University`,
    });

    createdColleges.push(college);

    // Create departments for this college
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

/**
 * Create admin account
 */
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

/**
 * Generate students
 */
async function generateStudents() {
  console.log("\n👨‍🎓 Generating students...");

  const students = [];
  const levels = [100, 200, 300, 400]; // Numbers, not strings
  
  // Track department counters for unique matric numbers
  const departmentCounters = {};
  let isFirstComputerScienceStudent = true;
  let isFirstAccountingStudent = true;

  // Hash salt for all passwords
  const salt = await bcrypt.genSalt(10);
  
  console.log(`   🔐 Preparing to hash passwords using first names...`);

  // Fetch all colleges and departments
  const colleges = await College.find({}).lean();
  
  for (const college of colleges) {
    const departments = await Department.find({ college: college._id }).lean();
    
    for (const department of departments) {
      // Initialize counter for this department
      if (!departmentCounters[department.code]) {
        departmentCounters[department.code] = 0;
      }

      // Determine number of students per department (3-5 students)
      const numStudents = Math.floor(Math.random() * 3) + 3;

      for (let i = 0; i < numStudents; i++) {
        departmentCounters[department.code]++;

        // Default values
        let firstName = randomElement(firstNames);
        let lastName = randomElement(lastNames);
        let level = randomElement(levels);
        let enrollmentYear = 2022;
        let matricNo = generateMatricNo(enrollmentYear, department.code, departmentCounters[department.code]);
        let email = generateEmail(firstName, lastName, matricNo);

        // Special case 1: First student in Computer Science department
        if (department.code === "CSC" && isFirstComputerScienceStudent) {
          firstName = "Muhammed";
          lastName = "Abiodun";
          matricNo = "BU22CSC1005";
          email = "muhammedabiodun42@gmail.com"; // Keep custom email
          level = 400;
          isFirstComputerScienceStudent = false;
          console.log(`   🎯 Special student: ${firstName} ${lastName} - ${matricNo}`);
        }
        // Special case 2: First student in Accounting
        else if (department.code === "ACC" && isFirstAccountingStudent) {
          firstName = "Mustapha";
          lastName = "Muhammed";
          email = "Mustapha.muhammed@bowen.edu.ng"; // Keep custom email
          level = randomElement(levels);
          isFirstAccountingStudent = false;
          console.log(`   🎯 Special student: ${firstName} ${lastName} - ${matricNo}`);
        }

        // Hash the password using firstName for each student
        const studentPasswordHash = await bcrypt.hash(firstName, salt);

        const student = {
          matricNo: matricNo,
          firstName: firstName,
          lastName: lastName,
          email: email,
          password: studentPasswordHash, // Password is firstName, hashed
          level: level,
          college: college._id, // Add college reference
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

  // Insert all students (passwords already hashed, so insertMany is safe)
  const insertedStudents = await Student.insertMany(students, { validateBeforeSave: false });

  console.log(`✅ Generated ${insertedStudents.length} students`);
  console.log(`   📧 Default password for each student: Their first name`);
  console.log(`\n   Sample Matric Numbers:`);
  console.log(`   - Computer Science: BU22CSC1005 (Muhammed Abiodun) - Password: Muhammed`);
  console.log(`   - Accounting: BU22ACC0001 (Mustapha Muhammed) - Password: Mustapha`);

  return insertedStudents;
}

/**
 * Main seed function
 */
async function seed() {
  console.log("🌱 Starting StayHub database seed...\n");
  console.log("=".repeat(50));

  try {
    await connectDB();
    await clearDatabase();
    await seedColleges();
    await createAdmin();
    const students = await generateStudents();

    console.log("\n" + "=".repeat(50));
    console.log("✅ Seed completed successfully!\n");
    console.log("📝 Summary:");
    console.log(`   - Admin: adebowale235@gmail.com (password: Adebowale2001)`);
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
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
    process.exit(0);
  }
}

// Run seed
seed();
