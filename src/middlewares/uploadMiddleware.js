const multer = require('multer');
const path = require('path');
const fs = require('fs');
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'profile-pictures');
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${req.user._id}-${Date.now()}${ext}`);
    },
});
const fileFilter = (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
    }
};
const _multerUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
}).single('picture');
const uploadProfilePicture = (req, res, next) => {
    _multerUpload(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            const message = err.code === 'LIMIT_FILE_SIZE'
                ? 'Image must be 5 MB or smaller'
                : err.message;
            return res.status(400).json({ success: false, message });
        }
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
};
module.exports = { uploadProfilePicture };
