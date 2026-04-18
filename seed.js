require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Admin = require('./src/models/Admin');
const College = require('./src/models/College');
const Department = require('./src/models/Department');
const Student = require('./src/models/Student');
const Hostel = require('./src/models/Hostel');
const Porter = require('./src/models/Porter');
const Room = require('./src/models/Room');
const Bunk = require('./src/models/Bunk');
const Payment = require('./src/models/Payment');
const PaymentConfig = require('./src/models/PaymentConfig');

const DEFAULT_USER_PASSWORD = '123456789';
const DEFAULT_ROOMS_PER_HOSTEL = 60;
const DEFAULT_BUNKS_PER_ROOM = 4;
const STUDENT_MATRIC_YEAR = '22';
const COMPUTER_SCIENCE_ANCHOR = {
    departmentCode: 'CSC',
    matricNo: 'BU22CSC1005',
    firstName: 'Muhammed',
    lastName: 'Abiodun',
};

const DEFAULT_HOSTELS = [100, 200, 300, 400, 500, 600].map((level) => ({
    name: `StayHub Level ${level} Hostel`,
    level,
    gender: 'mixed',
    totalRooms: DEFAULT_ROOMS_PER_HOSTEL,
    description: `Default mixed hostel for level ${level} students`,
    isActive: true,
}));

const BOWEN_SEED_PROFILE = [
    {
        name: 'College of Agriculture, Engineering and Science',
        code: 'COAES',
        description: 'Agriculture, science, and engineering programs at Bowen University.',
        deanName: 'Prof. Olusola Adegoke',
        deanEmail: 'dean.coaes@bowenuniversity.edu.ng',
        departments: [
            {
                name: 'Microbiology',
                code: 'MIC',
                description: 'Department of Microbiology.',
                hodName: 'Dr. Esther Adeyemi',
                hodEmail: 'hod.mic@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Fisayo', lastName: 'Adeyemi', gender: 'male' },
            },
            {
                name: 'Pure & Applied Biology',
                code: 'BIO',
                description: 'Department of Pure and Applied Biology.',
                hodName: 'Dr. Mercy Adeniran',
                hodEmail: 'hod.bio@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Tolulope', lastName: 'Adeniran', gender: 'female' },
            },
            {
                name: 'Biochemistry',
                code: 'BCH',
                description: 'Department of Biochemistry.',
                hodName: 'Dr. Daniel Olatunji',
                hodEmail: 'hod.bch@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Daniel', lastName: 'Olatunji', gender: 'male' },
            },
            {
                name: 'Industrial Chemistry',
                code: 'CHM',
                description: 'Department of Industrial Chemistry.',
                hodName: 'Dr. Kemi Ogunleye',
                hodEmail: 'hod.chm@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Temilola', lastName: 'Ogunleye', gender: 'female' },
            },
            {
                name: 'Mathematics',
                code: 'MTH',
                description: 'Department of Mathematics.',
                hodName: 'Dr. Samuel Akinola',
                hodEmail: 'hod.mth@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Samuel', lastName: 'Akinola', gender: 'male' },
            },
            {
                name: 'Statistics',
                code: 'STA',
                description: 'Department of Statistics.',
                hodName: 'Dr. Grace Adediran',
                hodEmail: 'hod.sta@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Grace', lastName: 'Adediran', gender: 'female' },
            },
            {
                name: 'Physics',
                code: 'PHY',
                description: 'Department of Physics.',
                hodName: 'Dr. Michael Akande',
                hodEmail: 'hod.phy@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Michael', lastName: 'Akande', gender: 'male' },
            },
            {
                name: 'Bachelor of Agriculture (B.Agric.)',
                code: 'AGR',
                description: 'Department of Agriculture.',
                hodName: 'Dr. Fatimah Bello',
                hodEmail: 'hod.agr@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400, 500],
                student: { firstName: 'Zainab', lastName: 'Bello', gender: 'female' },
            },
            {
                name: 'Food Science and Technology',
                code: 'FST',
                description: 'Department of Food Science and Technology.',
                hodName: 'Dr. Deborah Oladipo',
                hodEmail: 'hod.fst@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Deborah', lastName: 'Oladipo', gender: 'female' },
            },
            {
                name: 'Electrical/Electronics Engineering',
                code: 'EEE',
                description: 'Department of Electrical and Electronics Engineering.',
                hodName: 'Dr. Kehinde Arowolo',
                hodEmail: 'hod.eee@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400, 500],
                student: { firstName: 'Kehinde', lastName: 'Arowolo', gender: 'male' },
            },
            {
                name: 'Mechatronics Engineering',
                code: 'MCT',
                description: 'Department of Mechatronics Engineering.',
                hodName: 'Dr. Ayomide Ogunlana',
                hodEmail: 'hod.mct@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400, 500],
                student: { firstName: 'Ayomide', lastName: 'Ogunlana', gender: 'male' },
            },
            {
                name: 'Agricultural Extension & Rural Development',
                code: 'AER',
                description: 'Department of Agricultural Extension and Rural Development.',
                hodName: 'Dr. Blessing Fadeyi',
                hodEmail: 'hod.aer@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Blessing', lastName: 'Fadeyi', gender: 'female' },
            },
        ],
    },
    {
        name: 'College of Management and Social Sciences',
        code: 'COMSS',
        description: 'Management, economics, and social science programs.',
        deanName: 'Prof. Yetunde Ojo',
        deanEmail: 'dean.comss@bowenuniversity.edu.ng',
        departments: [
            {
                name: 'Accounting',
                code: 'ACC',
                description: 'Department of Accounting.',
                hodName: 'Dr. Chidinma Nwosu',
                hodEmail: 'hod.acc@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Chidinma', lastName: 'Nwosu', gender: 'female' },
            },
            {
                name: 'Banking and Finance',
                code: 'BNF',
                description: 'Department of Banking and Finance.',
                hodName: 'Dr. Emeka Ibekwe',
                hodEmail: 'hod.bnf@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Emeka', lastName: 'Ibekwe', gender: 'male' },
            },
            {
                name: 'Business Administration',
                code: 'BUS',
                description: 'Department of Business Administration.',
                hodName: 'Dr. Pelumi Shittu',
                hodEmail: 'hod.bus@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Pelumi', lastName: 'Shittu', gender: 'female' },
            },
            {
                name: 'Industrial Relations & Personnel Management',
                code: 'IRP',
                description: 'Department of Industrial Relations and Personnel Management.',
                hodName: 'Dr. Sodiq Lawal',
                hodEmail: 'hod.irp@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Sodiq', lastName: 'Lawal', gender: 'male' },
            },
            {
                name: 'Economics',
                code: 'ECO',
                description: 'Department of Economics.',
                hodName: 'Dr. Ifeoluwa Balogun',
                hodEmail: 'hod.eco@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Ifeoluwa', lastName: 'Balogun', gender: 'female' },
            },
            {
                name: 'Sociology',
                code: 'SOC',
                description: 'Department of Sociology.',
                hodName: 'Dr. Joshua Eze',
                hodEmail: 'hod.soc@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Joshua', lastName: 'Eze', gender: 'male' },
            },
            {
                name: 'Political Science',
                code: 'POL',
                description: 'Department of Political Science.',
                hodName: 'Dr. Motunrayo Adewale',
                hodEmail: 'hod.pol@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Motunrayo', lastName: 'Adewale', gender: 'female' },
            },
            {
                name: 'International Relations',
                code: 'INT',
                description: 'Department of International Relations.',
                hodName: 'Dr. David Opeyemi',
                hodEmail: 'hod.int@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'David', lastName: 'Opeyemi', gender: 'male' },
            },
            {
                name: 'Political and Law',
                code: 'PAL',
                description: 'Department of Political and Law Studies.',
                hodName: 'Dr. Esther Olamide',
                hodEmail: 'hod.pal@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Esther', lastName: 'Olamide', gender: 'female' },
            },
        ],
    },
    {
        name: 'College of Law',
        code: 'COLAW',
        description: 'Legal studies and professional law training.',
        deanName: 'Prof. Bamidele Adekunle',
        deanEmail: 'dean.colaw@bowenuniversity.edu.ng',
        departments: [
            {
                name: 'Law (LL.B.)',
                code: 'LAW',
                description: 'Department of Law.',
                hodName: 'Dr. Tobi Adedokun',
                hodEmail: 'hod.law@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400, 500, 600],
                student: { firstName: 'Tobi', lastName: 'Adedokun', gender: 'male' },
            },
        ],
    },
    {
        name: 'College of Liberal Studies',
        code: 'COLBS',
        description: 'Humanities and liberal arts programs.',
        deanName: 'Prof. Adesola Ige',
        deanEmail: 'dean.colbs@bowenuniversity.edu.ng',
        departments: [
            {
                name: 'Music',
                code: 'MUS',
                description: 'Department of Music.',
                hodName: 'Dr. Chiamaka Okafor',
                hodEmail: 'hod.mus@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Chiamaka', lastName: 'Okafor', gender: 'female' },
            },
            {
                name: 'Theatre Arts',
                code: 'THA',
                description: 'Department of Theatre Arts.',
                hodName: 'Dr. Seun Adekunle',
                hodEmail: 'hod.tha@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Seun', lastName: 'Adekunle', gender: 'male' },
            },
            {
                name: 'English',
                code: 'ENG',
                description: 'Department of English.',
                hodName: 'Dr. Omotola Afolabi',
                hodEmail: 'hod.eng@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Omotola', lastName: 'Afolabi', gender: 'female' },
            },
            {
                name: 'History & International Studies',
                code: 'HIS',
                description: 'Department of History and International Studies.',
                hodName: 'Dr. Ibrahim Abdullahi',
                hodEmail: 'hod.his@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Ibrahim', lastName: 'Abdullahi', gender: 'male' },
            },
            {
                name: 'Religious Studies',
                code: 'REL',
                description: 'Department of Religious Studies.',
                hodName: 'Dr. Ruth Eniola',
                hodEmail: 'hod.rel@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Ruth', lastName: 'Eniola', gender: 'female' },
            },
        ],
    },
    {
        name: 'College of Health Sciences',
        code: 'COHES',
        description: 'Clinical and allied health science programs.',
        deanName: 'Prof. Adebimpe Alabi',
        deanEmail: 'dean.cohes@bowenuniversity.edu.ng',
        departments: [
            {
                name: 'Anatomy',
                code: 'ANA',
                description: 'Department of Anatomy.',
                hodName: 'Dr. Adeola Omisore',
                hodEmail: 'hod.ana@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Adeola', lastName: 'Omisore', gender: 'female' },
            },
            {
                name: 'Physiology',
                code: 'PHS',
                description: 'Department of Physiology.',
                hodName: 'Dr. Oluwaseun Ajayi',
                hodEmail: 'hod.phs@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Oluwaseun', lastName: 'Ajayi', gender: 'male' },
            },
            {
                name: 'Medicine & Surgery (MBBS)',
                code: 'MED',
                description: 'Department of Medicine and Surgery.',
                hodName: 'Dr. Kikelomo Adebisi',
                hodEmail: 'hod.med@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400, 500, 600],
                student: { firstName: 'Kikelomo', lastName: 'Adebisi', gender: 'female' },
            },
            {
                name: 'Nursing Science',
                code: 'NUR',
                description: 'Department of Nursing Science.',
                hodName: 'Dr. Funmilayo Onasanya',
                hodEmail: 'hod.nur@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400, 500],
                student: { firstName: 'Funmilayo', lastName: 'Onasanya', gender: 'female' },
            },
            {
                name: 'Physiotherapy',
                code: 'PHT',
                description: 'Department of Physiotherapy.',
                hodName: 'Dr. Haruna Musa',
                hodEmail: 'hod.pht@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400, 500],
                student: { firstName: 'Haruna', lastName: 'Musa', gender: 'male' },
            },
            {
                name: 'Public Health',
                code: 'PHU',
                description: 'Department of Public Health.',
                hodName: 'Dr. Amarachi Nnaji',
                hodEmail: 'hod.phu@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Amarachi', lastName: 'Nnaji', gender: 'female' },
            },
            {
                name: 'Medical Laboratory Science (BMLS)',
                code: 'MLS',
                description: 'Department of Medical Laboratory Science.',
                hodName: 'Dr. Chukwudi Ekwueme',
                hodEmail: 'hod.mls@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400, 500],
                student: { firstName: 'Chukwudi', lastName: 'Ekwueme', gender: 'male' },
            },
            {
                name: 'Nutrition & Dietetics',
                code: 'NUT',
                description: 'Department of Nutrition and Dietetics.',
                hodName: 'Dr. Morenike Alabi',
                hodEmail: 'hod.nut@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Morenike', lastName: 'Alabi', gender: 'female' },
            },
        ],
    },
    {
        name: 'College of Computing and Communication Studies',
        code: 'COCCS',
        description: 'Computing, communication, and digital technology programs.',
        deanName: 'Prof. Damilola Aina',
        deanEmail: 'dean.coccs@bowenuniversity.edu.ng',
        departments: [
            {
                name: 'Computer Science',
                code: 'CSC',
                description: 'Department of Computer Science.',
                hodName: 'Dr. Abdulrahman Bello',
                hodEmail: 'hod.csc@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Muhammed', lastName: 'Abiodun', gender: 'male' },
            },
            {
                name: 'Mass Communication',
                code: 'MAS',
                description: 'Department of Mass Communication.',
                hodName: 'Dr. Anita Ojo',
                hodEmail: 'hod.mas@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Anita', lastName: 'Ojo', gender: 'female' },
            },
            {
                name: 'Communication Arts',
                code: 'CMA',
                description: 'Department of Communication Arts.',
                hodName: 'Dr. Emmanuel Ilesanmi',
                hodEmail: 'hod.cma@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Emmanuel', lastName: 'Ilesanmi', gender: 'male' },
            },
            {
                name: 'Cyber Security',
                code: 'CYB',
                description: 'Department of Cyber Security.',
                hodName: 'Dr. Favour Ajibola',
                hodEmail: 'hod.cyb@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Favour', lastName: 'Ajibola', gender: 'female' },
            },
            {
                name: 'Software Engineering',
                code: 'SEN',
                description: 'Department of Software Engineering.',
                hodName: 'Dr. Ridwan Olatunde',
                hodEmail: 'hod.sen@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Ridwan', lastName: 'Olatunde', gender: 'male' },
            },
            {
                name: 'Information Technology',
                code: 'IFT',
                description: 'Department of Information Technology.',
                hodName: 'Dr. Joy Ekanem',
                hodEmail: 'hod.ift@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400],
                student: { firstName: 'Joy', lastName: 'Ekanem', gender: 'female' },
            },
        ],
    },
    {
        name: 'College of Environmental Sciences',
        code: 'COEVS',
        description: 'Built environment and design studies.',
        deanName: 'Prof. Abayomi Olanrewaju',
        deanEmail: 'dean.coevs@bowenuniversity.edu.ng',
        departments: [
            {
                name: 'Architecture',
                code: 'ARC',
                description: 'Department of Architecture.',
                hodName: 'Dr. Nifemi Akinyemi',
                hodEmail: 'hod.arc@bowenuniversity.edu.ng',
                availableLevels: [100, 200, 300, 400, 500, 600],
                student: { firstName: 'Nifemi', lastName: 'Akinyemi', gender: 'female' },
            },
        ],
    },
];

const normalizeNamePart = (value) => String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '');

const buildInstitutionalEmail = (firstName, lastName, matricNo) => {
    const cleanFirstName = normalizeNamePart(firstName) || 'student';
    const cleanLastName = normalizeNamePart(lastName) || 'seed';
    return `${cleanFirstName}.${cleanLastName}.${matricNo.toLowerCase()}@student.bowenuniversity.edu.ng`;
};

const buildMatricNo = (departmentCode) => {
    if (departmentCode === COMPUTER_SCIENCE_ANCHOR.departmentCode) {
        return COMPUTER_SCIENCE_ANCHOR.matricNo;
    }
    return `BU${STUDENT_MATRIC_YEAR}${departmentCode}1001`;
};

async function connectDatabase() {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is required to run seed');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('1/7 Connected to MongoDB');
}

async function destructiveReset() {
    console.log('2/7 Resetting database with dropDatabase()...');
    await mongoose.connection.db.dropDatabase();
    console.log(`   Database "${mongoose.connection.name}" dropped successfully`);
}

async function seedAccessAccounts() {
    console.log('3/7 Seeding access accounts...');

    const admin = await Admin.create({
        email: 'admin@gmail.com',
        password: DEFAULT_USER_PASSWORD,
        firstName: 'Stephen',
        lastName: 'Administrator',
        role: 'admin',
        isActive: true,
    });

    const porter = await Porter.create({
        email: 'porter@gmail.com',
        password: DEFAULT_USER_PASSWORD,
        firstName: 'John',
        lastName: 'Porter',
        phoneNumber: '08012345678',
        employeeId: 'EMP001',
        joinedDate: new Date('2024-01-15'),
        status: 'active',
        approved: true,
        approvedDate: new Date('2024-01-15'),
        shiftSchedule: 'Day Shift (8AM - 4PM)',
        firstLogin: false,
        isActive: true,
    });

    console.log(`   Admin recreated: ${admin.email}`);
    console.log(`   Porter recreated: ${porter.email}`);
}

async function seedAcademicCatalog() {
    console.log('4/7 Seeding academic catalog...');

    const departmentSeedQueue = [];

    for (const collegeProfile of BOWEN_SEED_PROFILE) {
        const college = await College.create({
            name: collegeProfile.name,
            code: collegeProfile.code,
            description: collegeProfile.description,
            deanName: collegeProfile.deanName,
            deanEmail: collegeProfile.deanEmail,
            isActive: true,
        });

        for (const departmentProfile of collegeProfile.departments) {
            const department = await Department.create({
                name: departmentProfile.name,
                code: departmentProfile.code,
                description: departmentProfile.description,
                hodName: departmentProfile.hodName,
                hodEmail: departmentProfile.hodEmail,
                availableLevels: departmentProfile.availableLevels,
                college: college._id,
                isActive: true,
            });

            departmentSeedQueue.push({
                collegeId: college._id,
                collegeCode: college.code,
                departmentId: department._id,
                departmentCode: department.code,
                availableLevels: department.availableLevels,
                student: departmentProfile.student,
            });
        }

        console.log(`   ${college.code}: ${collegeProfile.departments.length} departments`);
    }

    console.log(`   Seeded ${BOWEN_SEED_PROFILE.length} colleges and ${departmentSeedQueue.length} departments`);
    return departmentSeedQueue;
}

async function seedStudents(departmentSeedQueue) {
    console.log('5/7 Seeding deterministic students...');

    const sharedPasswordHash = await bcrypt.hash(DEFAULT_USER_PASSWORD, 10);
    const studentDocs = departmentSeedQueue.map((entry) => {
        const matricNo = buildMatricNo(entry.departmentCode);
        const representativeLevel = Math.max(...entry.availableLevels);

        return {
            matricNo,
            firstName: entry.student.firstName,
            lastName: entry.student.lastName,
            email: buildInstitutionalEmail(entry.student.firstName, entry.student.lastName, matricNo),
            password: sharedPasswordHash,
            level: representativeLevel,
            gender: entry.student.gender,
            college: entry.collegeId,
            department: entry.departmentId,
            roommates: [],
            paymentStatus: 'pending',
            reservationStatus: 'none',
            isActive: true,
            firstLogin: true,
        };
    });

    const insertedStudents = await Student.insertMany(studentDocs, { ordered: true });
    console.log(`   Seeded ${insertedStudents.length} students (${DEFAULT_USER_PASSWORD} shared password)`);
    return insertedStudents;
}

async function seedHousingInventory() {
    console.log('6/7 Seeding default hostels, rooms, and bunks...');

    const hostels = await Hostel.insertMany(DEFAULT_HOSTELS, { ordered: true });
    const rooms = [];
    const bunks = [];

    for (const hostel of hostels) {
        for (let roomNumber = 1; roomNumber <= DEFAULT_ROOMS_PER_HOSTEL; roomNumber += 1) {
            const roomId = new mongoose.Types.ObjectId();

            rooms.push({
                _id: roomId,
                roomNumber: String(roomNumber),
                floor: Math.ceil(roomNumber / 10),
                capacity: DEFAULT_BUNKS_PER_ROOM,
                currentOccupants: 0,
                level: hostel.level,
                hostel: hostel._id,
                status: 'available',
                isActive: true,
            });

            for (let bunkNumber = 1; bunkNumber <= DEFAULT_BUNKS_PER_ROOM; bunkNumber += 1) {
                bunks.push({
                    bunkNumber: `B${bunkNumber}`,
                    room: roomId,
                    status: 'available',
                    isActive: true,
                });
            }
        }
    }

    await Room.insertMany(rooms, { ordered: true });
    await Bunk.insertMany(bunks, { ordered: true });

    console.log(`   Seeded ${hostels.length} hostels`);
    console.log(`   Seeded ${rooms.length} rooms (1-${DEFAULT_ROOMS_PER_HOSTEL} in each hostel)`);
    console.log(`   Seeded ${bunks.length} bunks (${DEFAULT_BUNKS_PER_ROOM} per room)`);

    return {
        hostelsSeeded: hostels.length,
        roomsSeeded: rooms.length,
        bunksSeeded: bunks.length,
    };
}

async function buildSummary() {
    const [
        adminCount,
        porterCount,
        collegeCount,
        departmentCount,
        studentCount,
        hostelCount,
        roomCount,
        bunkCount,
        paymentCount,
        paymentConfigCount,
    ] = await Promise.all([
        Admin.countDocuments(),
        Porter.countDocuments(),
        College.countDocuments(),
        Department.countDocuments(),
        Student.countDocuments(),
        Hostel.countDocuments(),
        Room.countDocuments(),
        Bunk.countDocuments(),
        Payment.countDocuments(),
        PaymentConfig.countDocuments(),
    ]);

    const anchor = await Student.findOne({ matricNo: COMPUTER_SCIENCE_ANCHOR.matricNo })
        .populate('department', 'name code')
        .lean();

    return {
        adminCount,
        porterCount,
        collegeCount,
        departmentCount,
        studentCount,
        hostelCount,
        roomCount,
        bunkCount,
        paymentCount,
        paymentConfigCount,
        anchor,
    };
}

function printSummary(summary) {
    console.log('7/7 Seed summary');
    console.log('='.repeat(64));
    console.log(` Admins: ${summary.adminCount}`);
    console.log(` Porters: ${summary.porterCount}`);
    console.log(` Colleges: ${summary.collegeCount}`);
    console.log(` Departments: ${summary.departmentCount}`);
    console.log(` Students: ${summary.studentCount}`);
    console.log(` Hostels: ${summary.hostelCount}`);
    console.log(` Rooms: ${summary.roomCount}`);
    console.log(` Bunks: ${summary.bunkCount}`);
    console.log(` Payments: ${summary.paymentCount}`);
    console.log(` Payment configs: ${summary.paymentConfigCount}`);

    if (summary.anchor) {
        console.log(
            ` Anchor: ${summary.anchor.firstName} ${summary.anchor.lastName} (${summary.anchor.matricNo}) - ${summary.anchor.department?.name}`,
        );
    }
    else {
        console.log(` Anchor: Missing ${COMPUTER_SCIENCE_ANCHOR.matricNo}`);
    }

    console.log(` Default password for admin, porter, and students: ${DEFAULT_USER_PASSWORD}`);
    console.log('='.repeat(64));
}

async function runSeed() {
    console.log('Starting deterministic StayHub seed...');
    try {
        await connectDatabase();
        await destructiveReset();
        await seedAccessAccounts();
        const departmentSeedQueue = await seedAcademicCatalog();
        await seedStudents(departmentSeedQueue);
        await seedHousingInventory();
        const summary = await buildSummary();
        printSummary(summary);
        console.log('Seed completed successfully');
        process.exitCode = 0;
    }
    catch (error) {
        console.error('Seed failed:', error);
        process.exitCode = 1;
    }
    finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
        process.exit(process.exitCode || 0);
    }
}

runSeed();
