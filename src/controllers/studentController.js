const Student = require('../models/Student');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Bunk = require('../models/Bunk');
const Department = require('../models/Department');
const notificationService = require('../services/notificationService');
const invitationAuditService = require('../services/invitationAuditService');
const cacheService = require('../services/cacheService');
const { addHours, getCurrentAcademicYear, getCurrentSemester } = require('../utils/dateUtils');
const config = require('../config/env');
const ACTIVE_RESERVATION_STATUSES = ['temporary', 'confirmed', 'checked_in'];
const EXPO_PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;
const NOTIFICATION_PREFERENCE_KEYS = Object.keys(notificationService.normalizeStudentNotificationPreferences({}));
const normalizeRoomForClient = (room, occupantCount) => {
    if (!room)
        return null;
    const roomObject = typeof room.toObject === 'function' ? room.toObject() : { ...room };
    const currentOccupants = occupantCount ?? roomObject.currentOccupants ?? roomObject.currentOccupancy ?? 0;
    return {
        ...roomObject,
        currentOccupants,
        currentOccupancy: currentOccupants,
        availableSpaces: roomObject.availableSpaces ?? Math.max(0, (roomObject.capacity || 0) - currentOccupants),
    };
};
const normalizeStudentForClient = (student) => {
    if (!student)
        return null;
    return {
        _id: student._id,
        id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        matricNo: student.matricNo,
        matricNumber: student.matricNo,
        level: student.level,
        department: student.department,
        reservationStatus: student.reservationStatus,
    };
};
const normalizeDepartmentForClient = (department) => {
    if (!department)
        return null;
    if (typeof department === 'object') {
        return {
            _id: department._id,
            name: department.name,
            code: department.code,
        };
    }
    return department;
};
const maskEmailAddress = (email) => {
    if (!email || typeof email !== 'string' || !email.includes('@'))
        return null;
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain)
        return null;
    const visibleLocal = localPart.length <= 2
        ? `${localPart[0] || ''}*`
        : `${localPart.slice(0, 2)}${'*'.repeat(Math.max(localPart.length - 2, 1))}`;
    return `${visibleLocal}@${domain}`;
};
const buildInvitationDeliveryChannels = (student) => {
    const preferences = notificationService.normalizeStudentNotificationPreferences(student?.notificationPreferences);
    const pushDeviceCount = (student?.pushDevices || [])
        .filter((device) => device?.enabled && EXPO_PUSH_TOKEN_PATTERN.test(String(device?.token || '')))
        .length;
    return {
        email: {
            available: Boolean(student?.email),
            addressMasked: maskEmailAddress(student?.email),
            willSend: Boolean(student?.email),
        },
        inApp: {
            available: true,
            willSend: true,
        },
        push: {
            available: pushDeviceCount > 0,
            deviceCount: pushDeviceCount,
            willSend: pushDeviceCount > 0 && preferences.pushEnabled && preferences.invitationCreated !== false,
        },
    };
};
const validateInvitationCandidate = ({ inviter, invitee, hostel }) => {
    if (!invitee) {
        return {
            valid: false,
            status: 404,
            code: 'student_not_found',
            message: 'Student not found',
        };
    }
    if (String(invitee._id) === String(inviter?._id) || invitee.matricNo === inviter?.matricNo) {
        return {
            valid: false,
            status: 400,
            code: 'self_invite',
            message: 'You cannot add your own matric number as a friend invitation',
        };
    }
    if (!invitee.isActive) {
        return {
            valid: false,
            status: 400,
            code: 'inactive_student',
            message: `${invitee.firstName} ${invitee.lastName} is not active in StayHub`,
        };
    }
    if (ACTIVE_RESERVATION_STATUSES.includes(invitee.reservationStatus)) {
        return {
            valid: false,
            status: 400,
            code: 'existing_reservation',
            message: `${invitee.firstName} ${invitee.lastName} already has a reservation or pending invitation`,
        };
    }
    if (hostel?.gender && hostel.gender !== 'mixed' && invitee.gender && invitee.gender !== hostel.gender) {
        return {
            valid: false,
            status: 400,
            code: 'gender_mismatch',
            message: `${invitee.firstName} ${invitee.lastName} is not eligible for ${hostel.name} because of hostel gender restrictions`,
        };
    }
    if (hostel?.level != null && invitee.level != null && Number(invitee.level) !== Number(hostel.level)) {
        return {
            valid: false,
            status: 400,
            code: 'level_mismatch',
            message: `${invitee.firstName} ${invitee.lastName} is not eligible for ${hostel.name} because it is assigned to level ${hostel.level}`,
        };
    }
    return {
        valid: true,
        status: 200,
        code: 'ready',
        message: 'Invitation can be sent',
    };
};
const buildInvitationPreviewPayload = ({ invitee, room, hostel, validation }) => ({
    friend: {
        ...normalizeStudentForClient(invitee),
        department: normalizeDepartmentForClient(invitee?.department),
        gender: invitee?.gender || null,
        paymentStatus: invitee?.paymentStatus || 'pending',
        emailMasked: maskEmailAddress(invitee?.email),
    },
    room: room
        ? {
            _id: room._id,
            roomNumber: room.roomNumber,
            floor: room.floor,
            capacity: room.capacity,
            currentOccupants: room.currentOccupants,
            availableSpaces: Math.max(0, (room.capacity || 0) - (room.currentOccupants || 0)),
        }
        : null,
    hostel: hostel
        ? {
            _id: hostel._id,
            name: hostel.name,
            code: hostel.code,
            gender: hostel.gender,
            level: hostel.level,
        }
        : null,
    eligibility: {
        canInvite: validation.valid,
        reason: validation.valid ? null : validation.message,
        code: validation.code,
    },
    invitation: {
        approvalWindowHours: config.RESERVATION_EXPIRY_HOURS,
        requiresPaymentBeforeApproval: invitee?.paymentStatus !== 'paid',
        notificationChannels: buildInvitationDeliveryChannels(invitee),
    },
});
const getEntityId = (entity) => entity?._id || entity?.id || entity || null;
const getInvitationEntryStudentId = (entry) => getEntityId(entry?.relatedStudent || entry?.actor);
const getInvitationEntryRoomId = (entry) => getEntityId(entry?.room);
const getInvitationEntriesForStudent = (entries = [], relatedStudentId, roomId, role) => entries
    .filter((entry) => {
    if (!entry || entry.role !== role) {
        return false;
    }
    if (relatedStudentId && String(getInvitationEntryStudentId(entry)) !== String(relatedStudentId)) {
        return false;
    }
    if (roomId && getInvitationEntryRoomId(entry) && String(getInvitationEntryRoomId(entry)) !== String(roomId)) {
        return false;
    }
    return true;
})
    .sort((left, right) => new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime());
const getInviteTrackerStatus = (action, reservationStatus) => {
    if (action === 'viewed') {
        return 'seen';
    }
    if (action === 'approved' || action === 'rejected' || action === 'expired') {
        return action;
    }
    if (reservationStatus === 'confirmed' || reservationStatus === 'checked_in') {
        return 'approved';
    }
    if (reservationStatus === 'expired') {
        return 'expired';
    }
    return 'sent';
};
const getInviteTrackerLabel = (status) => {
    const labels = {
        sent: 'Sent',
        seen: 'Seen',
        approved: 'Approved',
        rejected: 'Rejected',
        expired: 'Expired',
    };
    return labels[status] || 'Sent';
};
const getInviteTrackerMessage = (status, member) => {
    const friendName = getStudentDisplayName(member, 'Your friend');
    if (status === 'seen') {
        return `${friendName} has opened the room invitation.`;
    }
    if (status === 'approved') {
        return `${friendName} approved the room invitation.`;
    }
    if (status === 'rejected') {
        return `${friendName} rejected the room invitation.`;
    }
    if (status === 'expired') {
        return `${friendName}'s room invitation expired and the space was released.`;
    }
    return `${friendName}'s invitation has been sent and is waiting for a response.`;
};
const buildInviteTracker = (student) => {
    const reservedById = getEntityId(student?.reservedBy);
    const ownerId = getEntityId(student);
    const roomId = getEntityId(student?.assignedRoom);
    if (!ownerId || !reservedById || String(reservedById) !== String(ownerId)) {
        return [];
    }
    return (student?.roommates || []).map((member) => {
        const latestEntry = getInvitationEntriesForStudent(student?.invitationHistory || [], member?._id, roomId, 'inviter')[0] || null;
        const status = getInviteTrackerStatus(latestEntry?.action, member?.reservationStatus);
        return {
            student: normalizeStudentForClient(member),
            status,
            label: getInviteTrackerLabel(status),
            action: latestEntry?.action || 'invited',
            lastUpdatedAt: latestEntry?.createdAt || member?.updatedAt || student?.reservedAt || null,
            message: getInviteTrackerMessage(status, member),
            requiresPaymentBeforeApproval: member?.paymentStatus !== 'paid',
            emailMasked: maskEmailAddress(member?.email),
        };
    });
};
const markReservationInvitationViewed = async (student) => {
    const inviterId = getEntityId(student?.reservedBy);
    const inviteeId = getEntityId(student);
    const roomId = getEntityId(student?.assignedRoom);
    if (!inviteeId || !inviterId || String(inviterId) === String(inviteeId) || student?.reservationStatus !== 'temporary') {
        return false;
    }
    const inviteEntries = getInvitationEntriesForStudent(student?.invitationHistory || [], inviterId, roomId, 'invitee');
    const latestInvite = inviteEntries.find((entry) => entry.action === 'invited');
    const latestView = inviteEntries.find((entry) => entry.action === 'viewed');
    if (!latestInvite) {
        return false;
    }
    if (latestView && new Date(latestView.createdAt || 0).getTime() >= new Date(latestInvite.createdAt || 0).getTime()) {
        return false;
    }
    await invitationAuditService.logInvitationOutcome({
        invitee: student,
        inviter: inviterId,
        actor: student._id,
        action: 'viewed',
        room: student.assignedRoom,
        hostel: student.assignedHostel,
        bunk: student.assignedBunk,
        notes: 'Invitation viewed by the invited student',
    });
    return true;
};
const normalizeGroupMembers = (roommates = []) => roommates.map((roommate) => ({
    _id: roommate._id,
    id: roommate._id,
    matricNo: roommate.matricNo,
    matricNumber: roommate.matricNo,
    firstName: roommate.firstName,
    lastName: roommate.lastName,
    status: roommate.reservationStatus || 'confirmed',
}));
const normalizeInvitationParticipant = (participant) => {
    if (!participant)
        return null;
    if (typeof participant === 'object' &&
        (participant.firstName ||
            participant.lastName ||
            participant.matricNo ||
            participant.matricNumber ||
            participant.email ||
            participant._id)) {
        return normalizeStudentForClient(participant);
    }
    return {
        _id: participant?._id || participant?.id || participant,
        id: participant?._id || participant?.id || participant,
    };
};
const normalizeInvitationHistoryEntry = (entry) => {
    if (!entry)
        return null;
    const hostel = entry.hostel && typeof entry.hostel === 'object'
        ? {
            _id: entry.hostel._id,
            name: entry.hostel.name,
            code: entry.hostel.code,
        }
        : entry.hostel
            ? {
                _id: entry.hostel,
                name: entry.hostelName,
            }
            : null;
    const room = entry.room && typeof entry.room === 'object'
        ? {
            _id: entry.room._id,
            roomNumber: entry.room.roomNumber,
        }
        : entry.room
            ? {
                _id: entry.room,
                roomNumber: entry.roomNumber,
            }
            : null;
    const bunk = entry.bunk && typeof entry.bunk === 'object'
        ? {
            _id: entry.bunk._id,
            bunkNumber: entry.bunk.bunkNumber,
        }
        : entry.bunk
            ? {
                _id: entry.bunk,
                bunkNumber: entry.bunkNumber,
            }
            : null;
    return {
        _id: entry._id,
        action: entry.action,
        role: entry.role,
        notes: entry.notes,
        createdAt: entry.createdAt,
        actor: normalizeInvitationParticipant(entry.actor),
        relatedStudent: normalizeInvitationParticipant(entry.relatedStudent),
        hostel,
        hostelName: hostel?.name || entry.hostelName || null,
        room,
        roomNumber: room?.roomNumber || entry.roomNumber || null,
        bunk,
        bunkNumber: bunk?.bunkNumber != null
            ? String(bunk.bunkNumber)
            : entry.bunkNumber != null
                ? String(entry.bunkNumber)
                : null,
    };
};
const getStudentDisplayName = (studentLike, fallback = 'A student') => {
    if (!studentLike)
        return fallback;
    const fullName = [studentLike.firstName, studentLike.lastName].filter(Boolean).join(' ').trim();
    return fullName || studentLike.matricNo || studentLike.matricNumber || fallback;
};
const getInvitationLocationLabel = (entry) => {
    const roomNumber = entry?.roomNumber || entry?.room?.roomNumber;
    const hostelName = entry?.hostelName || entry?.hostel?.name;
    if (roomNumber && hostelName) {
        return `Room ${roomNumber} in ${hostelName}`;
    }
    if (roomNumber) {
        return `Room ${roomNumber}`;
    }
    if (hostelName) {
        return hostelName;
    }
    return 'the reserved room';
};
const formatAlertDateTime = (value) => {
    if (!value)
        return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return null;
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};
const buildInvitationAlert = (entry, reservationExpiresAt) => {
    const historyEntry = normalizeInvitationHistoryEntry(entry);
    if (!historyEntry)
        return null;
    const relatedStudent = historyEntry.relatedStudent || historyEntry.actor;
    const relatedName = getStudentDisplayName(relatedStudent);
    const location = getInvitationLocationLabel(historyEntry);
    const deadline = formatAlertDateTime(reservationExpiresAt);
    if (historyEntry.action === 'invited' && historyEntry.role === 'inviter') {
        return {
            type: 'info',
            icon: 'account-clock-outline',
            message: `${relatedName} has been invited to ${location}. Waiting for approval.`,
            createdAt: historyEntry.createdAt,
        };
    }
    if (historyEntry.action === 'invited' && historyEntry.role === 'invitee') {
        return {
            type: 'warning',
            icon: 'email-fast-outline',
            message: deadline
                ? `${relatedName} reserved ${location} for you. Approve it before ${deadline}.`
                : `${relatedName} reserved ${location} for you. Review and approve it soon.`,
            createdAt: historyEntry.createdAt,
        };
    }
    if (historyEntry.action === 'viewed' && historyEntry.role === 'inviter') {
        return {
            type: 'info',
            icon: 'eye-outline',
            message: `${relatedName} viewed the invitation for ${location}.`,
            createdAt: historyEntry.createdAt,
        };
    }
    if (historyEntry.action === 'viewed' && historyEntry.role === 'invitee') {
        return {
            type: 'info',
            icon: 'eye-outline',
            message: `You opened the invitation for ${location}.`,
            createdAt: historyEntry.createdAt,
        };
    }
    if (historyEntry.action === 'approved' && historyEntry.role === 'inviter') {
        return {
            type: 'success',
            icon: 'check-decagram-outline',
            message: `${relatedName} approved the invitation for ${location}.`,
            createdAt: historyEntry.createdAt,
        };
    }
    if (historyEntry.action === 'approved' && historyEntry.role === 'invitee') {
        return {
            type: 'success',
            icon: 'check-circle-outline',
            message: `You approved ${location}.`,
            createdAt: historyEntry.createdAt,
        };
    }
    if (historyEntry.action === 'rejected' && historyEntry.role === 'inviter') {
        return {
            type: 'warning',
            icon: 'close-circle-outline',
            message: `${relatedName} rejected the invitation for ${location}.`,
            createdAt: historyEntry.createdAt,
        };
    }
    if (historyEntry.action === 'rejected' && historyEntry.role === 'invitee') {
        return {
            type: 'info',
            icon: 'close-box-outline',
            message: `You rejected ${location}.`,
            createdAt: historyEntry.createdAt,
        };
    }
    if (historyEntry.action === 'expired' && historyEntry.role === 'inviter') {
        return {
            type: 'error',
            icon: 'timer-sand-empty',
            message: `${relatedName}'s invitation for ${location} expired and the bed was released.`,
            createdAt: historyEntry.createdAt,
        };
    }
    if (historyEntry.action === 'expired' && historyEntry.role === 'invitee') {
        return {
            type: 'error',
            icon: 'timer-off-outline',
            message: `Your invitation for ${location} expired.`,
            createdAt: historyEntry.createdAt,
        };
    }
    return null;
};
const sortNotificationsByDate = (left, right) => {
    const leftTime = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right?.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
};
const getNotificationDestination = (type) => {
    if (type === 'profile') {
        return '/student/profile';
    }
    if (type === 'payment') {
        return '/student/payment';
    }
    return '/student/reservation';
};
const loadStudentNotificationContext = (studentId) => Student.findById(studentId)
    .populate('assignedHostel', 'name code')
    .populate('assignedRoom', 'roomNumber')
    .populate('reservedBy', 'firstName lastName matricNo email')
    .populate('invitationHistory.actor', 'firstName lastName matricNo email')
    .populate('invitationHistory.relatedStudent', 'firstName lastName matricNo email');
const buildActiveAlertNotifications = (student) => {
    const alerts = [];
    if (student.reservationStatus === 'temporary') {
        const inviterName = getStudentDisplayName(student.reservedBy, 'A friend');
        const roomNumber = student.assignedRoom?.roomNumber;
        const hostelName = student.assignedHostel?.name;
        const deadline = formatAlertDateTime(student.reservationExpiresAt);
        const roomLabel = roomNumber && hostelName
            ? `Room ${roomNumber} in ${hostelName}`
            : roomNumber
                ? `Room ${roomNumber}`
                : hostelName || 'the reserved room';
        const invitationKey = [
            student.assignedRoom?._id || student.assignedRoom || 'room',
            student.reservationExpiresAt ? new Date(student.reservationExpiresAt).toISOString() : 'open',
        ].join(':');
        alerts.push({
            _id: `temporary-invitation:${invitationKey}`,
            type: 'warning',
            icon: 'bed-clock',
            category: 'invitation',
            title: 'Invitation Awaiting Approval',
            message: deadline
                ? `${inviterName} reserved ${roomLabel} for you. Approve it before ${deadline}.`
                : `${inviterName} reserved ${roomLabel} for you. Approve or reject it soon.`,
            createdAt: student.reservedAt || student.updatedAt || new Date(),
            destination: '/student/reservation?focus=invitation',
        });
        if (student.paymentStatus !== 'paid') {
            alerts.push({
                _id: `temporary-invitation-payment:${invitationKey}`,
                type: 'info',
                icon: 'credit-card-refresh-outline',
                category: 'payment',
                title: 'Payment Needed',
                message: 'Complete your payment before approving this room invitation.',
                createdAt: student.updatedAt || student.createdAt || new Date(),
                destination: '/student/payment',
            });
        }
    }
    if (student.reservationStatus === 'confirmed' && student.reservationExpiresAt) {
        const msLeft = new Date(student.reservationExpiresAt) - Date.now();
        const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
        if (hoursLeft > 0) {
            alerts.push({
                _id: `reservation-expiry:${new Date(student.reservationExpiresAt).toISOString()}`,
                type: 'warning',
                icon: 'clock-alert-outline',
                category: 'reservation',
                title: 'Reservation Expiring Soon',
                message: `Reservation expires in ${hoursLeft}h`,
                createdAt: student.reservedAt || student.updatedAt || new Date(),
                destination: '/student/reservation',
            });
        }
    }
    if (student.reservationStatus === 'confirmed') {
        const now = new Date();
        const day = now.getDay();
        const daysToMonday = (8 - day) % 7 || 7;
        const nextMonday = new Date(now);
        nextMonday.setDate(now.getDate() + daysToMonday);
        const dayName = nextMonday.toLocaleDateString('en-US', { weekday: 'long' });
        alerts.push({
            _id: `check-in-window:${nextMonday.toISOString().slice(0, 10)}`,
            type: 'info',
            icon: 'calendar-clock',
            category: 'reservation',
            title: 'Upcoming Check-in Window',
            message: `Check-in opens ${dayName} 9am`,
            createdAt: nextMonday,
            destination: '/student/reservation',
        });
    }
    if (!student.emergencyContact) {
        alerts.push({
            _id: 'missing-emergency-contact',
            type: 'error',
            icon: 'account-alert',
            category: 'profile',
            title: 'Profile Needs Attention',
            message: 'Complete profile: add emergency contact',
            createdAt: student.updatedAt || student.createdAt || new Date(),
            destination: '/student/profile',
        });
    }
    return alerts;
};
const buildInvitationNotifications = (student) => (student.invitationHistory || [])
    .slice(-20)
    .reverse()
    .map((entry) => normalizeInvitationHistoryEntry(entry))
    .filter(Boolean)
    .map((entry) => {
    const alert = buildInvitationAlert(entry, student.reservationExpiresAt);
    if (!alert)
        return null;
    return {
        _id: (entry._id ? String(entry._id) : null) ||
            `invitation:${entry.action}:${entry.role}:${entry.roomNumber || 'room'}:${entry.createdAt || 'time'}`,
        type: alert.type,
        icon: alert.icon,
        category: 'invitation',
        title: 'Invitation Update',
        message: alert.message,
        createdAt: alert.createdAt || entry.createdAt || student.updatedAt || new Date(),
        destination: entry.action === 'invited' && entry.role === 'invitee'
            ? '/student/reservation?focus=invitation'
            : '/student/reservation?focus=history',
    };
})
    .filter(Boolean);
const buildStoredCustomNotifications = (student) => (student.customNotifications || [])
    .slice(-25)
    .reverse()
    .map((notification) => ({
    _id: String(notification.notificationId || notification._id || '') ||
        `announcement:${notification.createdAt || Date.now()}`,
    type: notification.type || 'info',
    icon: notification.icon || 'bullhorn',
    category: notification.category || 'announcement',
    title: notification.title || 'StayHub Update',
    message: notification.message || '',
    createdAt: notification.createdAt || student.updatedAt || new Date(),
    destination: notification.destination || '/student/notifications',
}))
    .filter((notification) => notification.message);
const buildStudentNotifications = (student) => {
    const notifications = [
        ...buildStoredCustomNotifications(student),
        ...buildActiveAlertNotifications(student),
        ...buildInvitationNotifications(student),
    ];
    const seen = new Set();
    return notifications
        .filter((notification) => {
        if (!notification?._id || seen.has(notification._id)) {
            return false;
        }
        seen.add(notification._id);
        return true;
    })
        .sort(sortNotificationsByDate);
};
const applyNotificationReadState = (student, notifications) => {
    const readIds = new Set((student.notificationReads || []).map((entry) => entry.notificationId));
    return notifications.map((notification) => ({
        ...notification,
        _id: String(notification._id),
        destination: notification.destination || getNotificationDestination(notification.category),
        read: readIds.has(String(notification._id)),
    }));
};
const extractNotificationPreferenceUpdates = (payload = {}) => NOTIFICATION_PREFERENCE_KEYS.reduce((updates, key) => {
    if (typeof payload?.[key] === 'boolean') {
        updates[key] = payload[key];
    }
    return updates;
}, {});
const maskPushToken = (token) => {
    const value = String(token || '');
    if (value.length <= 12)
        return value;
    return `${value.slice(0, 8)}...${value.slice(-4)}`;
};
const buildNotificationSettings = (student) => {
    const preferences = notificationService.normalizeStudentNotificationPreferences(student?.notificationPreferences);
    const devices = (student?.pushDevices || [])
        .filter((device) => device?.token)
        .sort((left, right) => new Date(right.lastSeenAt || right.lastRegisteredAt || 0).getTime() -
        new Date(left.lastSeenAt || left.lastRegisteredAt || 0).getTime())
        .map((device) => ({
        tokenPreview: maskPushToken(device.token),
        platform: device.platform || 'unknown',
        enabled: device.enabled !== false,
        deviceName: device.deviceName || null,
        appOwnership: device.appOwnership || null,
        lastRegisteredAt: device.lastRegisteredAt || null,
        lastSeenAt: device.lastSeenAt || null,
    }));
    return {
        preferences,
        devices,
        registeredDevicesCount: devices.length,
        hasActiveDevice: devices.some((device) => device.enabled),
        lastRegisteredAt: devices[0]?.lastRegisteredAt || null,
    };
};
const buildReservationData = async (student) => {
    if (!student?.assignedRoom || student.reservationStatus === 'none') {
        return null;
    }
    const roomId = student.assignedRoom._id || student.assignedRoom;
    const occupantCount = await Student.countDocuments({
        assignedRoom: roomId,
        reservationStatus: { $in: ACTIVE_RESERVATION_STATUSES },
    });
    const reservedBy = student.reservedBy && typeof student.reservedBy === 'object' && student.reservedBy._id
        ? normalizeStudentForClient(student.reservedBy)
        : student.reservedBy && String(student.reservedBy) === String(student._id)
            ? normalizeStudentForClient(student)
            : null;
    return {
        _id: student._id,
        status: student.reservationStatus,
        reservationStatus: student.reservationStatus,
        createdAt: student.reservedAt || student.createdAt,
        updatedAt: student.updatedAt,
        reservedAt: student.reservedAt,
        expiresAt: student.reservationExpiresAt,
        hostel: student.assignedHostel,
        room: normalizeRoomForClient(student.assignedRoom, occupantCount),
        bunk: student.assignedBunk,
        student: normalizeStudentForClient(student),
        roommates: student.roommates || [],
        groupMembers: normalizeGroupMembers(student.roommates || []),
        inviteTracker: buildInviteTracker(student),
        reservedBy,
        approvalRequired: student.reservationStatus === 'temporary',
        invitationHistory: (student.invitationHistory || [])
            .slice(-10)
            .reverse()
            .map(normalizeInvitationHistoryEntry)
            .filter(Boolean),
    };
};
const buildAvailableHostelQuery = (student) => {
    const genderFilter = student.gender === 'male'
        ? { gender: { $in: ['male', 'mixed'] } }
        : { gender: { $in: ['female', 'mixed'] } };
    return {
        level: student.level,
        isActive: true,
        ...genderFilter,
    };
};
const countAvailableHostelsForStudent = async (student) => {
    const hostels = await Hostel.find(buildAvailableHostelQuery(student)).select('_id').lean();
    if (!hostels.length) {
        return 0;
    }
    const hostelIds = hostels.map((hostel) => hostel._id);
    const availability = await Room.aggregate([
        {
            $match: {
                hostel: { $in: hostelIds },
                isActive: true,
            },
        },
        {
            $group: {
                _id: '$hostel',
                availableRooms: {
                    $sum: {
                        $cond: [{ $lt: ['$currentOccupants', '$capacity'] }, 1, 0],
                    },
                },
            },
        },
        {
            $match: {
                availableRooms: { $gt: 0 },
            },
        },
        {
            $count: 'count',
        },
    ]);
    return availability[0]?.count || 0;
};
const releaseStudentReservation = async (student) => {
    if (student.reservationStatus === 'checked_in') {
        throw new Error('Checked-in reservations cannot be canceled from the student portal');
    }
    const roomId = student.assignedRoom?._id || student.assignedRoom;
    const bunkId = student.assignedBunk?._id || student.assignedBunk;
    const roommateIds = (student.roommates || []).map((roommate) => roommate._id || roommate);
    if (bunkId) {
        await Bunk.findByIdAndUpdate(bunkId, {
            status: 'available',
            occupiedByStudent: null,
            reservedUntil: null,
        });
    }
    if (roomId) {
        const room = await Room.findById(roomId);
        if (room) {
            room.currentOccupants = Math.max(0, room.currentOccupants - 1);
            await room.updateStatus();
        }
    }
    if (roommateIds.length > 0) {
        await Student.updateMany({ _id: { $in: roommateIds } }, { $pull: { roommates: student._id } });
    }
    student.assignedHostel = null;
    student.assignedRoom = null;
    student.assignedBunk = null;
    student.roommates = [];
    student.reservationStatus = 'none';
    student.reservedAt = null;
    student.reservationExpiresAt = null;
    student.reservedBy = null;
    student.invitationReminderMarks = [];
    student.checkInDate = null;
    await student.save();
    cacheService.del(cacheService.cacheKeys.availableRooms(student.level));
};
exports.updateProfile = async (req, res) => {
    try {
        const studentId = req.user._id;
        const updateData = req.body;
        console.log('Updating student profile:', studentId);
        console.log('Update data:', updateData);
        const studentUpdate = {};
        if (updateData.firstName !== undefined) {
            if (typeof updateData.firstName !== 'string' || updateData.firstName.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'First name must be a non-empty string'
                });
            }
            studentUpdate.firstName = updateData.firstName.trim();
        }
        if (updateData.lastName !== undefined) {
            if (typeof updateData.lastName !== 'string' || updateData.lastName.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Last name must be a non-empty string'
                });
            }
            studentUpdate.lastName = updateData.lastName.trim();
        }
        if (updateData.email !== undefined) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(updateData.email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email format'
                });
            }
            const existingStudent = await Student.findOne({
                email: updateData.email.toLowerCase(),
                _id: { $ne: studentId }
            });
            if (existingStudent) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already in use by another student'
                });
            }
            studentUpdate.email = updateData.email.toLowerCase();
        }
        if (updateData.phoneNumber !== undefined) {
            studentUpdate.phoneNumber = updateData.phoneNumber.trim();
        }
        if (updateData.department !== undefined) {
            const departmentExists = await Department.findById(updateData.department);
            if (!departmentExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid department'
                });
            }
            studentUpdate.department = updateData.department;
        }
        if (updateData.level !== undefined) {
            const validLevels = [100, 200, 300, 400, 500];
            const levelNum = parseInt(updateData.level);
            if (!validLevels.includes(levelNum)) {
                return res.status(400).json({
                    success: false,
                    message: 'Level must be one of: 100, 200, 300, 400, 500'
                });
            }
            studentUpdate.level = levelNum;
        }
        if (updateData.matricNumber !== undefined) {
            const matricNo = updateData.matricNumber.toUpperCase().trim();
            const existingStudent = await Student.findOne({
                matricNo: matricNo,
                _id: { $ne: studentId }
            });
            if (existingStudent) {
                return res.status(400).json({
                    success: false,
                    message: 'Matriculation number already in use'
                });
            }
            studentUpdate.matricNo = matricNo;
        }
        if (updateData.gender !== undefined) {
            if (!['male', 'female'].includes(updateData.gender.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: 'Gender must be either "male" or "female"'
                });
            }
            studentUpdate.gender = updateData.gender.toLowerCase();
        }
        if (Object.keys(studentUpdate).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields provided for update'
            });
        }
        const updatedStudent = await Student.findByIdAndUpdate(studentId, studentUpdate, { new: true, runValidators: true })
            .select('-password')
            .populate('college', 'name code')
            .populate('department', 'name code')
            .populate('assignedHostel', 'name')
            .populate('assignedRoom', 'roomNumber')
            .populate('assignedBunk', 'bunkNumber');
        if (!updatedStudent) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }
        console.log('Profile updated successfully:', updatedStudent._id);
        const userData = {
            _id: updatedStudent._id,
            firstName: updatedStudent.firstName,
            lastName: updatedStudent.lastName,
            matricNumber: updatedStudent.matricNo,
            email: updatedStudent.email,
            phoneNumber: updatedStudent.phoneNumber,
            department: updatedStudent.department?.name || updatedStudent.department,
            level: updatedStudent.level,
            gender: updatedStudent.gender,
            role: updatedStudent.role,
            college: updatedStudent.college,
            assignedHostel: updatedStudent.assignedHostel,
            assignedRoom: updatedStudent.assignedRoom,
            assignedBunk: updatedStudent.assignedBunk,
            paymentStatus: updatedStudent.paymentStatus,
            reservationStatus: updatedStudent.reservationStatus
        };
        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                user: userData
            }
        });
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while updating profile'
        });
    }
};
exports.uploadProfilePicture = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided' });
        }
        const pictureUrl = `${req.protocol}://${req.get('host')}/uploads/profile-pictures/${req.file.filename}`;
        const student = await Student.findByIdAndUpdate(req.user._id, { profilePicture: pictureUrl }, { new: true })
            .select('-password')
            .populate('college', 'name code')
            .populate('department', 'name code')
            .populate('assignedHostel', 'name')
            .populate('assignedRoom', 'roomNumber')
            .populate('assignedBunk', 'bunkNumber');
        res.status(200).json({ data: { student } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAvailableHostels = async (req, res) => {
    try {
        const student = req.user;
        const hostels = await Hostel.find(buildAvailableHostelQuery(student)).populate('portersAssigned');
        const hostelsWithAvailability = await Promise.all(hostels.map(async (hostel) => {
            const rooms = await Room.find({ hostel: hostel._id });
            const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
            const currentOccupants = await Student.countDocuments({
                assignedHostel: hostel._id,
                reservationStatus: { $in: ['confirmed', 'checked_in'] },
            });
            const availableCapacity = Math.max(0, totalCapacity - currentOccupants);
            const availableRoomsCount = rooms.filter(room => room.currentOccupants < room.capacity).length;
            const occupancyRate = totalCapacity > 0
                ? Math.round((currentOccupants / totalCapacity) * 100)
                : 0;
            return {
                _id: hostel._id,
                name: hostel.name,
                code: hostel.code,
                location: hostel.location,
                totalRooms: hostel.totalRooms,
                totalCapacity: totalCapacity,
                currentOccupants: currentOccupants,
                availableCapacity: availableCapacity,
                gender: hostel.gender,
                level: hostel.level,
                isActive: hostel.isActive,
                description: hostel.description,
                portersAssigned: hostel.portersAssigned,
                availableRooms: availableRoomsCount,
                occupancyRate: occupancyRate,
                createdAt: hostel.createdAt,
                updatedAt: hostel.updatedAt
            };
        }));
        res.status(200).json({
            success: true,
            data: hostelsWithAvailability,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAvailableRooms = async (req, res) => {
    try {
        const { hostelId } = req.params;
        const rooms = await Room.find({
            hostel: hostelId,
            isActive: true,
        })
            .populate('bunks')
            .lean();
        const roomsWithAvailability = rooms.map(room => {
            const totalCapacity = room.capacity || 0;
            const activeBunks = room.bunks?.filter(bunk => bunk.isActive) || [];
            const availableBunks = activeBunks.filter(bunk => bunk.status === 'available').length || 0;
            const takenBunks = activeBunks.filter(bunk => bunk.status === 'occupied' || bunk.status === 'reserved').length || 0;
            const reservedBunks = activeBunks.filter(bunk => bunk.status === 'reserved').length || 0;
            const currentOccupants = Math.max(room.currentOccupants || 0, takenBunks);
            const availableSpaces = Math.max(0, totalCapacity - currentOccupants);
            return {
                ...room,
                capacity: totalCapacity,
                currentOccupants,
                currentOccupancy: currentOccupants,
                availableSpaces,
                availableBunks,
                reservedSpaces: reservedBunks,
                isAvailable: availableSpaces > 0,
            };
        });
        res.status(200).json({
            success: true,
            data: roomsWithAvailability,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAvailableBunks = async (req, res) => {
    try {
        const { roomId } = req.params;
        const bunks = await Bunk.find({
            room: roomId,
            status: 'available',
            isActive: true,
        });
        res.status(200).json({
            success: true,
            data: bunks,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.previewReservationInvite = async (req, res) => {
    try {
        const inviter = req.user;
        const matricNo = String(req.body.matricNo || req.body.matricNumber || '').toUpperCase().trim();
        const { roomId, hostelId } = req.body;
        if (!matricNo) {
            return res.status(400).json({
                success: false,
                message: 'Matric number is required',
            });
        }
        if (!roomId) {
            return res.status(400).json({
                success: false,
                message: 'Room ID is required',
            });
        }
        const room = await Room.findById(roomId).populate('hostel').lean();
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found or no longer available',
            });
        }
        if (hostelId && String(room.hostel?._id || room.hostel) !== String(hostelId)) {
            return res.status(400).json({
                success: false,
                message: 'Room does not belong to the selected hostel',
            });
        }
        const invitee = await Student.findOne({
            matricNo,
            isActive: true,
        })
            .select('firstName lastName matricNo email gender level department reservationStatus paymentStatus notificationPreferences pushDevices isActive')
            .populate('department', 'name code');
        const validation = validateInvitationCandidate({
            inviter,
            invitee,
            hostel: room.hostel,
        });
        if (!invitee) {
            return res.status(validation.status).json({
                success: false,
                message: validation.message,
            });
        }
        const payload = buildInvitationPreviewPayload({
            invitee,
            room,
            hostel: room.hostel,
            validation,
        });
        if (!validation.valid) {
            return res.status(validation.status).json({
                success: false,
                message: validation.message,
                data: payload,
            });
        }
        res.status(200).json({
            success: true,
            message: `${invitee.firstName} ${invitee.lastName} is ready to receive a room invitation`,
            data: payload,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to preview room invitation',
        });
    }
};
exports.reserveRoom = async (req, res) => {
    try {
        const student = req.user;
        const { roomId, bunkId, roommates, isGroupReservation } = req.body;
        if (student.paymentStatus !== 'paid') {
            console.log('❌ Payment required');
            return res.status(403).json({
                success: false,
                message: 'Payment required before reservation',
            });
        }
        if (ACTIVE_RESERVATION_STATUSES.includes(student.reservationStatus)) {
            console.log('❌ Already reserved:', student.reservationStatus);
            return res.status(400).json({
                success: false,
                message: 'You already have an active reservation or pending invitation',
            });
        }
        const room = await Room.findById(roomId).populate('hostel');
        console.log('Room found:', room ? `${room.roomNumber} (${room._id})` : 'Not found');
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found or no longer available',
            });
        }
        console.log('Room details:', {
            number: room.roomNumber,
            floor: room.floor,
            capacity: room.capacity,
            currentOccupants: room.currentOccupants,
            status: room.status,
            hostel: room.hostel.name
        });
        if (isGroupReservation && roommates && roommates.length > 0) {
            const requiredBunks = roommates.length + 1;
            const availableSpace = room.capacity - room.currentOccupants;
            console.log('Group reservation check:', {
                requiredBunks,
                availableSpace,
                roommates: roommates.length
            });
            if (availableSpace < requiredBunks) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient space. Room has ${availableSpace} available bunks, but you need ${requiredBunks} for your group`,
                });
            }
            for (const roommateId of roommates) {
                const roommate = await Student.findById(roommateId);
                if (!roommate) {
                    return res.status(404).json({
                        success: false,
                        message: `Roommate with ID ${roommateId} not found`,
                    });
                }
                if (ACTIVE_RESERVATION_STATUSES.includes(roommate.reservationStatus)) {
                    return res.status(400).json({
                        success: false,
                        message: `${roommate.firstName} ${roommate.lastName} already has a reservation or pending invitation`,
                    });
                }
            }
        }
        let bunk;
        if (bunkId) {
            bunk = await Bunk.findById(bunkId);
            console.log('✓ Specific bunk requested:', bunk ? bunk.bunkNumber : 'Not found');
            if (!bunk) {
                return res.status(404).json({
                    success: false,
                    message: 'Bunk not found',
                });
            }
            if (bunk.room.toString() !== room._id.toString()) {
                console.log('❌ Bunk-room mismatch:', { bunkRoom: bunk.room, roomId: room._id });
                return res.status(400).json({
                    success: false,
                    message: 'Selected bunk does not belong to this room',
                });
            }
            if (bunk.status !== 'available') {
                console.log('Bunk not available:', bunk.status);
                return res.status(400).json({
                    success: false,
                    message: 'Bunk is not available',
                });
            }
        }
        else {
            bunk = await Bunk.findOne({
                room: room._id,
                status: 'available',
                isActive: true
            });
            console.log('✓ Auto-selected bunk:', bunk ? bunk.bunkNumber : 'None available');
            if (!bunk) {
                return res.status(404).json({
                    success: false,
                    message: 'No available bunks in this room',
                });
            }
        }
        if (room.currentOccupants >= room.capacity) {
            console.log('Room full:', { current: room.currentOccupants, capacity: room.capacity });
            return res.status(400).json({
                success: false,
                message: 'Room is full',
            });
        }
        bunk.status = 'reserved';
        bunk.occupiedByStudent = student._id;
        bunk.reservedUntil = addHours(new Date(), config.RESERVATION_EXPIRY_HOURS);
        await bunk.save();
        student.assignedHostel = room.hostel._id;
        student.assignedRoom = room._id;
        student.assignedBunk = bunk._id;
        student.reservationStatus = 'confirmed';
        student.reservedAt = new Date();
        student.reservationExpiresAt = bunk.reservedUntil;
        let roommateDetails = [];
        if (isGroupReservation && roommates && roommates.length > 0) {
            student.roommates = roommates;
            console.log(`🤝 Processing group reservation for ${roommates.length} roommates...`);
            for (const roommateId of roommates) {
                const roommateBunk = await Bunk.findOne({
                    room: room._id,
                    status: 'available',
                    isActive: true
                });
                if (!roommateBunk) {
                    bunk.status = 'available';
                    bunk.occupiedByStudent = null;
                    bunk.reservedUntil = null;
                    await bunk.save();
                    return res.status(400).json({
                        success: false,
                        message: 'Not enough available bunks for group reservation',
                    });
                }
                roommateBunk.status = 'reserved';
                roommateBunk.occupiedByStudent = roommateId;
                roommateBunk.reservedUntil = bunk.reservedUntil;
                await roommateBunk.save();
                const roommateStudent = await Student.findById(roommateId);
                roommateStudent.assignedHostel = room.hostel._id;
                roommateStudent.assignedRoom = room._id;
                roommateStudent.assignedBunk = roommateBunk._id;
                roommateStudent.reservationStatus = 'temporary';
                roommateStudent.reservedAt = new Date();
                roommateStudent.reservationExpiresAt = bunk.reservedUntil;
                roommateStudent.roommates = [student._id, ...roommates.filter(id => id !== roommateId)];
                roommateStudent.reservedBy = student._id;
                roommateStudent.invitationReminderMarks = [];
                await roommateStudent.save();
                roommateDetails.push({
                    id: roommateStudent._id,
                    name: `${roommateStudent.firstName} ${roommateStudent.lastName}`,
                    bunk: roommateBunk.bunkNumber
                });
                room.currentOccupants += 1;
                await room.save();
                await Promise.allSettled([
                    invitationAuditService.logInvitationCreated({
                        invitee: roommateStudent,
                        inviter: student,
                        room,
                        hostel: room.hostel,
                        bunk: roommateBunk,
                        notes: 'Group room invitation created',
                    }),
                ]);
                await notificationService.notifyRoommateReserved(roommateId, student._id, room._id, room.hostel._id, bunk.reservedUntil);
                console.log(`✅ Reserved bunk ${roommateBunk.bunkNumber} for ${roommateStudent.firstName} ${roommateStudent.lastName}`);
            }
        }
        else if (roommates && roommates.length > 0) {
            student.roommates = roommates;
            for (const roommateId of roommates) {
                await Promise.allSettled([
                    invitationAuditService.logInvitationCreated({
                        invitee: roommateId,
                        inviter: student,
                        room,
                        hostel: room.hostel,
                        notes: 'Roommate invitation created from legacy reservation flow',
                    }),
                ]);
                await notificationService.notifyRoommateReserved(roommateId, student._id, room._id, room.hostel._id, bunk.reservedUntil);
            }
        }
        await student.save();
        room.currentOccupants += 1;
        await room.updateStatus();
        await notificationService.notifyReservationConfirmed(student._id, room._id, bunk._id, room.hostel._id);
        cacheService.del(cacheService.cacheKeys.availableRooms(student.level));
        console.log('✅ Reservation successful:', {
            studentId: student._id,
            hostel: room.hostel.name,
            room: room.roomNumber,
            bunk: bunk.bunkNumber,
            isGroupReservation,
            roommatesAssigned: roommateDetails.length
        });
        console.log('=============================================================');
        const responseData = {
            hostel: room.hostel.name,
            hostelId: room.hostel._id,
            room: room.roomNumber,
            roomId: room._id,
            bunk: bunk.bunkNumber,
            bunkId: bunk._id,
            expiresAt: bunk.reservedUntil,
        };
        if (isGroupReservation && roommateDetails.length > 0) {
            responseData.groupMembers = roommateDetails;
            responseData.totalReserved = roommateDetails.length + 1;
        }
        res.status(200).json({
            success: true,
            message: isGroupReservation
                ? `Group reservation successful! ${roommateDetails.length} invitation(s) sent to your friends.`
                : 'Room reserved successfully',
            data: responseData,
        });
    }
    catch (error) {
        console.error('Reserve room error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to reserve room',
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
exports.getReservation = async (req, res) => {
    try {
        const student = await Student.findById(req.user._id)
            .populate('assignedHostel assignedBunk reservedBy')
            .populate({
            path: 'assignedRoom',
            select: 'roomNumber floor capacity currentOccupants status hostel',
        })
            .populate({
            path: 'roommates',
            select: 'firstName lastName matricNo level department reservationStatus email paymentStatus updatedAt',
        });
        if (!student.assignedRoom || student.reservationStatus === 'none') {
            return res.status(404).json({ message: 'No reservation found' });
        }
        if (!student.reservedAt) {
            const fallback = student.updatedAt || student.createdAt;
            await Student.updateOne({ _id: student._id }, { $set: { reservedAt: fallback } });
            student.reservedAt = fallback;
        }
        await markReservationInvitationViewed(student);
        const reservationData = await buildReservationData(student);
        res.status(200).json({
            success: true,
            data: reservationData,
            ...reservationData,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getDashboard = async (req, res) => {
    try {
        const student = await Student.findById(req.user._id)
            .populate('college department assignedHostel assignedBunk reservedBy')
            .populate({
            path: 'assignedRoom',
            select: 'roomNumber floor capacity currentOccupants status hostel',
        })
            .populate({
            path: 'roommates',
            select: 'firstName lastName matricNo email reservationStatus paymentStatus updatedAt',
        });
        const availableHostels = await countAvailableHostelsForStudent(student);
        const hasReservation = Boolean(student.assignedRoom && ACTIVE_RESERVATION_STATUSES.includes(student.reservationStatus));
        const reservation = hasReservation ? await buildReservationData(student) : null;
        res.status(200).json({
            success: true,
            data: {
                student,
                profile: student,
                paymentStatus: student.paymentStatus,
                reservationStatus: student.reservationStatus,
                hasReservation,
                availableHostels,
                reservation,
                currentSession: `${getCurrentAcademicYear()} ${getCurrentSemester()}`,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAlerts = async (req, res) => {
    try {
        const student = await Student.findById(req.user._id)
            .populate('assignedHostel', 'name code')
            .populate('assignedRoom', 'roomNumber')
            .populate('reservedBy', 'firstName lastName matricNo email')
            .populate('invitationHistory.actor', 'firstName lastName matricNo email')
            .populate('invitationHistory.relatedStudent', 'firstName lastName matricNo email');
        const alerts = [];
        let id = 1;
        if (student.reservationStatus === 'temporary') {
            const inviterName = getStudentDisplayName(student.reservedBy, 'A friend');
            const roomNumber = student.assignedRoom?.roomNumber;
            const hostelName = student.assignedHostel?.name;
            const deadline = formatAlertDateTime(student.reservationExpiresAt);
            const roomLabel = roomNumber && hostelName
                ? `Room ${roomNumber} in ${hostelName}`
                : roomNumber
                    ? `Room ${roomNumber}`
                    : hostelName || 'the reserved room';
            alerts.push({
                _id: String(id++),
                type: 'warning',
                icon: 'bed-clock',
                message: deadline
                    ? `${inviterName} reserved ${roomLabel} for you. Approve it before ${deadline}.`
                    : `${inviterName} reserved ${roomLabel} for you. Approve or reject it soon.`,
            });
            if (student.paymentStatus !== 'paid') {
                alerts.push({
                    _id: String(id++),
                    type: 'info',
                    icon: 'credit-card-refresh-outline',
                    message: 'Complete your payment before approving this room invitation.',
                });
            }
        }
        if (student.reservationStatus === 'confirmed' && student.reservationExpiresAt) {
            const msLeft = new Date(student.reservationExpiresAt) - Date.now();
            const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
            if (hoursLeft > 0) {
                alerts.push({
                    _id: String(id++),
                    type: 'warning',
                    icon: 'clock-alert-outline',
                    message: `Reservation expires in ${hoursLeft}h`,
                });
            }
        }
        if (student.reservationStatus === 'confirmed') {
            const now = new Date();
            const day = now.getDay();
            const daysToMonday = (8 - day) % 7 || 7;
            const nextMonday = new Date(now);
            nextMonday.setDate(now.getDate() + daysToMonday);
            const dayName = nextMonday.toLocaleDateString('en-US', { weekday: 'long' });
            alerts.push({
                _id: String(id++),
                type: 'info',
                icon: 'calendar-clock',
                message: `Check-in opens ${dayName} 9am`,
            });
        }
        if (!student.emergencyContact) {
            alerts.push({
                _id: String(id++),
                type: 'error',
                icon: 'account-alert',
                message: 'Complete profile: add emergency contact',
            });
        }
        res.status(200).json({ data: alerts });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getNotifications = async (req, res) => {
    try {
        const student = await loadStudentNotificationContext(req.user._id);
        const notifications = applyNotificationReadState(student, buildStudentNotifications(student));
        const unreadCount = notifications.filter((notification) => !notification.read).length;
        res.status(200).json({
            success: true,
            data: notifications,
            meta: {
                unreadCount,
                total: notifications.length,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to load notifications',
        });
    }
};
exports.markNotificationsRead = async (req, res) => {
    try {
        const requestedIds = Array.isArray(req.body.ids)
            ? req.body.ids.map((id) => String(id).trim()).filter(Boolean)
            : [];
        const markAll = Boolean(req.body.markAll);
        if (!markAll && requestedIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Provide notification ids or use markAll',
            });
        }
        const student = await loadStudentNotificationContext(req.user._id);
        const notifications = buildStudentNotifications(student);
        const availableIds = new Set(notifications.map((notification) => String(notification._id)));
        const targetIds = markAll
            ? [...availableIds]
            : requestedIds.filter((id) => availableIds.has(id));
        const existingReads = Array.isArray(student.notificationReads)
            ? student.notificationReads.map((entry) => ({
                notificationId: entry.notificationId,
                readAt: entry.readAt,
            }))
            : [];
        const readMap = new Map(existingReads.map((entry) => [entry.notificationId, entry]));
        targetIds.forEach((notificationId) => {
            if (!readMap.has(notificationId)) {
                readMap.set(notificationId, {
                    notificationId,
                    readAt: new Date(),
                });
            }
        });
        student.notificationReads = Array.from(readMap.values())
            .sort((left, right) => new Date(right.readAt).getTime() - new Date(left.readAt).getTime())
            .slice(0, 200);
        await student.save();
        const notificationsWithState = applyNotificationReadState(student, notifications);
        const unreadCount = notificationsWithState.filter((notification) => !notification.read).length;
        res.status(200).json({
            success: true,
            message: markAll ? 'All notifications marked as read' : 'Notifications updated',
            data: {
                readIds: targetIds,
                unreadCount,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update notifications',
        });
    }
};
exports.getNotificationSettings = async (req, res) => {
    try {
        const student = await Student.findById(req.user._id).select('notificationPreferences pushDevices theme');
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found',
            });
        }
        res.status(200).json({
            success: true,
            data: {
                ...buildNotificationSettings(student),
                theme: student.theme || 'light',
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to load notification settings',
        });
    }
};
exports.updateNotificationPreferences = async (req, res) => {
    try {
        const payload = req.body?.preferences && typeof req.body.preferences === 'object'
            ? req.body.preferences
            : req.body;
        const updates = extractNotificationPreferenceUpdates(payload);
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Provide at least one notification preference to update',
            });
        }
        const student = await Student.findById(req.user._id).select('notificationPreferences pushDevices theme');
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found',
            });
        }
        const currentPreferences = notificationService.normalizeStudentNotificationPreferences(student.notificationPreferences);
        student.notificationPreferences = notificationService.normalizeStudentNotificationPreferences({
            ...currentPreferences,
            ...updates,
        });
        await student.save();
        res.status(200).json({
            success: true,
            message: 'Notification preferences updated',
            data: {
                ...buildNotificationSettings(student),
                theme: student.theme || 'light',
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update notification preferences',
        });
    }
};
exports.registerPushDevice = async (req, res) => {
    try {
        const token = String(req.body.token || '').trim();
        const platform = ['android', 'ios', 'web'].includes(String(req.body.platform || '').toLowerCase())
            ? String(req.body.platform).toLowerCase()
            : 'unknown';
        const deviceName = typeof req.body.deviceName === 'string' ? req.body.deviceName.trim().slice(0, 80) : undefined;
        const appOwnership = typeof req.body.appOwnership === 'string'
            ? req.body.appOwnership.trim().slice(0, 40)
            : undefined;
        const projectId = typeof req.body.projectId === 'string' ? req.body.projectId.trim().slice(0, 80) : undefined;
        if (!EXPO_PUSH_TOKEN_PATTERN.test(token)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Expo push token',
            });
        }
        await Student.updateMany({ _id: { $ne: req.user._id } }, { $pull: { pushDevices: { token } } });
        const student = await Student.findById(req.user._id).select('notificationPreferences pushDevices theme');
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found',
            });
        }
        const now = new Date();
        const existingDevices = (student.pushDevices || []).filter((device) => device?.token !== token);
        existingDevices.unshift({
            token,
            platform,
            deviceName,
            appOwnership,
            projectId,
            enabled: true,
            lastRegisteredAt: now,
            lastSeenAt: now,
        });
        student.pushDevices = existingDevices.slice(0, 5);
        await student.save();
        res.status(200).json({
            success: true,
            message: 'Push notifications enabled for this device',
            data: {
                ...buildNotificationSettings(student),
                theme: student.theme || 'light',
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to register device for push notifications',
        });
    }
};
exports.unregisterPushDevice = async (req, res) => {
    try {
        const token = String(req.body.token || '').trim();
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Device token is required',
            });
        }
        const student = await Student.findById(req.user._id).select('notificationPreferences pushDevices theme');
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found',
            });
        }
        student.pushDevices = (student.pushDevices || []).filter((device) => device?.token !== token);
        await student.save();
        res.status(200).json({
            success: true,
            message: 'Push device removed',
            data: {
                ...buildNotificationSettings(student),
                theme: student.theme || 'light',
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to remove push device',
        });
    }
};
exports.createReservation = async (req, res) => {
    try {
        const { roomId, hostelId } = req.body;
        const friends = Array.isArray(req.body.friends)
            ? req.body.friends
            : Array.isArray(req.body.groupMembers)
                ? req.body.groupMembers
                : [];
        const normalizedFriends = friends
            .map((friend) => String(friend).toUpperCase().trim())
            .filter(Boolean);
        const uniqueFriends = [...new Set(normalizedFriends)];
        const isGroupReservation = typeof req.body.isGroupReservation === 'boolean'
            ? req.body.isGroupReservation
            : uniqueFriends.length > 0;
        const student = req.user;
        console.log('📋 Room reservation request:', {
            studentId: student._id,
            roomId,
            hostelId,
            isGroupReservation,
            friendsCount: uniqueFriends.length
        });
        if (student.paymentStatus !== 'paid') {
            return res.status(403).json({
                success: false,
                message: 'Payment required before reservation'
            });
        }
        if (ACTIVE_RESERVATION_STATUSES.includes(student.reservationStatus)) {
            return res.status(400).json({
                success: false,
                message: 'You already have an active reservation or pending invitation. Please clear it first.'
            });
        }
        if (normalizedFriends.length !== uniqueFriends.length) {
            return res.status(400).json({
                success: false,
                message: 'Each invited matric number must be unique'
            });
        }
        if (uniqueFriends.includes(student.matricNo)) {
            return res.status(400).json({
                success: false,
                message: 'You cannot add your own matric number as a friend invitation'
            });
        }
        const room = await Room.findById(roomId).populate('hostel');
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found or no longer available'
            });
        }
        if (hostelId && room.hostel._id.toString() !== hostelId) {
            return res.status(400).json({
                success: false,
                message: 'Room does not belong to the selected hostel'
            });
        }
        const requiredBunks = isGroupReservation ? uniqueFriends.length + 1 : 1;
        const availableSpace = room.capacity - room.currentOccupants;
        if (availableSpace < requiredBunks) {
            return res.status(400).json({
                success: false,
                message: `Insufficient space. Room has ${availableSpace} available bunks, but ${requiredBunks} needed.`
            });
        }
        let roommateIds = [];
        if (isGroupReservation && uniqueFriends.length > 0) {
            const friendStudents = await Student.find({
                matricNo: { $in: uniqueFriends },
                isActive: true,
            }).populate('department', 'name code');
            if (friendStudents.length !== uniqueFriends.length) {
                return res.status(400).json({
                    success: false,
                    message: 'One or more friend matric numbers not found'
                });
            }
            for (const friend of friendStudents) {
                const invitationValidation = validateInvitationCandidate({
                    inviter: student,
                    invitee: friend,
                    hostel: room.hostel,
                });
                if (!invitationValidation.valid) {
                    return res.status(400).json({
                        success: false,
                        message: invitationValidation.message,
                    });
                }
            }
            roommateIds = friendStudents.map(f => f._id);
        }
        const bunk = await Bunk.findOne({
            room: room._id,
            status: 'available',
            isActive: true
        });
        if (!bunk) {
            return res.status(404).json({
                success: false,
                message: 'No available bunks in this room'
            });
        }
        bunk.status = 'reserved';
        bunk.occupiedByStudent = student._id;
        bunk.reservedUntil = addHours(new Date(), config.RESERVATION_EXPIRY_HOURS);
        await bunk.save();
        student.assignedHostel = room.hostel._id;
        student.assignedRoom = room._id;
        student.assignedBunk = bunk._id;
        student.reservationStatus = 'confirmed';
        student.reservedAt = new Date();
        student.reservationExpiresAt = bunk.reservedUntil;
        student.roommates = roommateIds;
        student.reservedBy = student._id;
        await student.save();
        room.currentOccupants += 1;
        let roommateDetails = [];
        if (isGroupReservation && roommateIds.length > 0) {
            for (const roommateId of roommateIds) {
                const roommateBunk = await Bunk.findOne({
                    room: room._id,
                    status: 'available',
                    isActive: true
                });
                if (!roommateBunk) {
                    bunk.status = 'available';
                    bunk.occupiedByStudent = null;
                    bunk.reservedUntil = null;
                    await bunk.save();
                    student.assignedHostel = null;
                    student.assignedRoom = null;
                    student.assignedBunk = null;
                    student.reservationStatus = 'none';
                    student.reservedAt = null;
                    student.reservationExpiresAt = null;
                    student.reservedBy = null;
                    student.roommates = [];
                    await student.save();
                    room.currentOccupants -= 1;
                    return res.status(400).json({
                        success: false,
                        message: 'Not enough available bunks for group reservation'
                    });
                }
                roommateBunk.status = 'reserved';
                roommateBunk.occupiedByStudent = roommateId;
                roommateBunk.reservedUntil = bunk.reservedUntil;
                await roommateBunk.save();
                const roommateStudent = await Student.findById(roommateId);
                roommateStudent.assignedHostel = room.hostel._id;
                roommateStudent.assignedRoom = room._id;
                roommateStudent.assignedBunk = roommateBunk._id;
                roommateStudent.reservationStatus = 'temporary';
                roommateStudent.reservedAt = new Date();
                roommateStudent.reservationExpiresAt = bunk.reservedUntil;
                roommateStudent.roommates = [student._id, ...roommateIds.filter(id => id.toString() !== roommateId.toString())];
                roommateStudent.reservedBy = student._id;
                roommateStudent.invitationReminderMarks = [];
                await roommateStudent.save();
                roommateDetails.push({
                    id: roommateStudent._id,
                    matricNo: roommateStudent.matricNo,
                    matricNumber: roommateStudent.matricNo,
                    name: `${roommateStudent.firstName} ${roommateStudent.lastName}`,
                    bunk: roommateBunk.bunkNumber,
                    status: roommateStudent.reservationStatus
                });
                room.currentOccupants += 1;
                await Promise.allSettled([
                    invitationAuditService.logInvitationCreated({
                        invitee: roommateStudent,
                        inviter: student,
                        room,
                        hostel: room.hostel,
                        bunk: roommateBunk,
                        notes: 'Group room invitation created',
                    }),
                ]);
                await notificationService.notifyRoommateReserved(roommateId, student._id, room._id, room.hostel._id, bunk.reservedUntil);
                console.log(`✅ Reserved bunk ${roommateBunk.bunkNumber} for ${roommateStudent.firstName}`);
            }
        }
        await room.updateStatus();
        cacheService.del(cacheService.cacheKeys.availableRooms(student.level));
        console.log('✅ Reservation created successfully');
        const responseData = {
            student: student._id,
            room: {
                id: room._id,
                number: room.roomNumber,
                roomNumber: room.roomNumber,
                floor: room.floor,
                capacity: room.capacity,
                currentOccupants: room.currentOccupants,
                currentOccupancy: room.currentOccupants,
                availableSpaces: Math.max(0, room.capacity - room.currentOccupants)
            },
            hostel: {
                id: room.hostel._id,
                name: room.hostel.name
            },
            bunk: {
                id: bunk._id,
                number: bunk.bunkNumber
            },
            status: 'confirmed',
            reservedAt: new Date(),
            expiresAt: bunk.reservedUntil,
            isGroupReservation: isGroupReservation || false,
            groupMembers: roommateDetails
        };
        res.status(201).json({
            success: true,
            message: isGroupReservation
                ? `Group reservation successful! ${roommateDetails.length} invitation(s) sent by email and StayHub notifications. Each friend has ${config.RESERVATION_EXPIRY_HOURS} hours to approve.`
                : 'Reservation created successfully',
            data: responseData
        });
    }
    catch (error) {
        console.error('❌ Reservation error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating reservation',
            error: error.message
        });
    }
};
exports.addGroupMembers = async (req, res) => {
    try {
        const student = req.user;
        const matrics = Array.isArray(req.body.matrics)
            ? req.body.matrics
            : Array.isArray(req.body.matricNumbers)
                ? req.body.matricNumbers
                : [];
        const upperMatrics = matrics.map(m => String(m).toUpperCase().trim()).filter(Boolean);
        const uniqueMatrics = [...new Set(upperMatrics)];
        if (student.reservationStatus !== 'confirmed' && student.reservationStatus !== 'checked_in') {
            return res.status(400).json({
                success: false,
                message: 'You must have an active reservation before adding group members',
            });
        }
        if (!matrics || !Array.isArray(matrics) || matrics.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an array of matric numbers',
            });
        }
        if (upperMatrics.length !== uniqueMatrics.length) {
            return res.status(400).json({
                success: false,
                message: 'Each invited matric number must be unique',
            });
        }
        if (uniqueMatrics.includes(student.matricNo)) {
            return res.status(400).json({
                success: false,
                message: 'You cannot add your own matric number to this room',
            });
        }
        const room = await Room.findById(student.assignedRoom).populate('hostel');
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Your assigned room could not be found',
            });
        }
        const availableSpace = room.capacity - room.currentOccupants;
        if (availableSpace < uniqueMatrics.length) {
            return res.status(400).json({
                success: false,
                message: `Insufficient space. Room has ${availableSpace} available space(s), but ${uniqueMatrics.length} needed.`,
            });
        }
        const newMembers = await Student.find({
            matricNo: { $in: uniqueMatrics },
            isActive: true,
        }).populate('department', 'name code');
        if (newMembers.length !== uniqueMatrics.length) {
            const foundMatrics = newMembers.map(s => s.matricNo);
            const missing = uniqueMatrics.filter(m => !foundMatrics.includes(m));
            return res.status(404).json({
                success: false,
                message: `Matric number(s) not found: ${missing.join(', ')}`,
            });
        }
        for (const member of newMembers) {
            if (member.assignedRoom && member.assignedRoom.toString() === room._id.toString()) {
                return res.status(400).json({
                    success: false,
                    message: `${member.firstName} ${member.lastName} (${member.matricNo}) is already in this room`,
                });
            }
            const invitationValidation = validateInvitationCandidate({
                inviter: student,
                invitee: member,
                hostel: room.hostel,
            });
            if (!invitationValidation.valid) {
                return res.status(400).json({
                    success: false,
                    message: invitationValidation.message,
                });
            }
        }
        const recentInvitationAlerts = (student.invitationHistory || [])
            .slice(-6)
            .reverse()
            .map((entry) => normalizeInvitationHistoryEntry(entry))
            .filter(Boolean)
            .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.action === entry.action &&
            candidate.role === entry.role &&
            String(candidate.relatedStudent?._id || candidate.relatedStudent || '') ===
                String(entry.relatedStudent?._id || entry.relatedStudent || '') &&
            candidate.roomNumber === entry.roomNumber &&
            candidate.hostelName === entry.hostelName) === index)
            .filter((entry) => !(student.reservationStatus === 'temporary' && entry.action === 'invited' && entry.role === 'invitee'))
            .map((entry) => buildInvitationAlert(entry, student.reservationExpiresAt))
            .filter(Boolean);
        recentInvitationAlerts.forEach((alert) => {
            alerts.push({
                _id: String(id++),
                ...alert,
            });
        });
        const groupMembers = [];
        const existingRoommateIds = (student.roommates || []).map((id) => id.toString());
        const invitationExpiresAt = student.reservationExpiresAt && new Date(student.reservationExpiresAt) > new Date()
            ? student.reservationExpiresAt
            : addHours(new Date(), config.RESERVATION_EXPIRY_HOURS);
        for (const member of newMembers) {
            const bunk = await Bunk.findOne({ room: room._id, status: 'available', isActive: true });
            if (!bunk) {
                return res.status(400).json({
                    success: false,
                    message: 'Not enough available bunks in the room',
                });
            }
            bunk.status = 'reserved';
            bunk.occupiedByStudent = member._id;
            bunk.reservedUntil = invitationExpiresAt;
            await bunk.save();
            const otherNewMemberIds = newMembers
                .filter(m => m._id.toString() !== member._id.toString())
                .map(m => m._id);
            member.assignedHostel = room.hostel._id;
            member.assignedRoom = room._id;
            member.assignedBunk = bunk._id;
            member.reservationStatus = 'temporary';
            member.reservedAt = new Date();
            member.reservationExpiresAt = invitationExpiresAt;
            member.roommates = [
                student._id,
                ...existingRoommateIds,
                ...otherNewMemberIds.map((id) => id.toString()),
            ].filter((id, index, array) => array.indexOf(id) === index && id !== member._id.toString());
            member.reservedBy = student.reservedBy || student._id;
            member.invitationReminderMarks = [];
            await member.save();
            room.currentOccupants += 1;
            await room.save();
            groupMembers.push({
                id: member._id,
                matricNo: member.matricNo,
                matricNumber: member.matricNo,
                name: `${member.firstName} ${member.lastName}`,
                bunk: bunk.bunkNumber,
                status: member.reservationStatus,
            });
            await Promise.allSettled([
                invitationAuditService.logInvitationCreated({
                    invitee: member,
                    inviter: student.reservedBy || student._id,
                    room,
                    hostel: room.hostel,
                    bunk,
                    notes: 'Room invitation added to an existing reservation',
                }),
            ]);
            await notificationService.notifyRoommateReserved(member._id, student.reservedBy || student._id, room._id, room.hostel._id, invitationExpiresAt);
        }
        const existingIds = new Set(student.roommates.map(id => id.toString()));
        const newRoommateIds = newMembers
            .map(m => m._id)
            .filter(id => !existingIds.has(id.toString()));
        student.roommates = [...student.roommates, ...newRoommateIds];
        await student.save();
        await Student.updateMany({ _id: { $in: existingRoommateIds } }, { $addToSet: { roommates: { $each: newRoommateIds } } });
        await room.updateStatus();
        cacheService.del(cacheService.cacheKeys.availableRooms(student.level));
        res.status(200).json({
            success: true,
            message: `${groupMembers.length} invitation(s) sent by email and StayHub notifications. Each friend has ${config.RESERVATION_EXPIRY_HOURS} hours to approve.`,
            data: {
                groupMembers,
                totalInRoom: room.currentOccupants,
            },
        });
    }
    catch (error) {
        console.error('Add group members error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while adding group members',
        });
    }
};
exports.getInvitationHistory = async (req, res) => {
    try {
        const student = await Student.findById(req.user._id)
            .populate('invitationHistory.actor', 'firstName lastName matricNo email')
            .populate('invitationHistory.relatedStudent', 'firstName lastName matricNo email')
            .populate('invitationHistory.hostel', 'name code')
            .populate('invitationHistory.room', 'roomNumber')
            .populate('invitationHistory.bunk', 'bunkNumber');
        await markReservationInvitationViewed(student);
        const history = (student?.invitationHistory || [])
            .slice(-20)
            .reverse()
            .map(normalizeInvitationHistoryEntry)
            .filter(Boolean);
        res.status(200).json({
            success: true,
            data: history,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to load invitation history',
        });
    }
};
exports.respondToReservationInvite = async (req, res) => {
    try {
        const action = String(req.body.action || '').toLowerCase();
        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Action must be either approve or reject',
            });
        }
        const student = await Student.findById(req.user._id)
            .populate('assignedHostel assignedBunk reservedBy')
            .populate({
            path: 'assignedRoom',
            select: 'roomNumber floor capacity currentOccupants status hostel',
        })
            .populate({
            path: 'roommates',
            select: 'firstName lastName matricNo level department reservationStatus email paymentStatus updatedAt',
        });
        if (!student || !student.assignedRoom || student.reservationStatus === 'none') {
            return res.status(404).json({
                success: false,
                message: 'No room invitation found',
            });
        }
        if (student.reservationStatus !== 'temporary') {
            return res.status(400).json({
                success: false,
                message: 'You do not have a pending room invitation to respond to',
            });
        }
        const inviter = student.reservedBy && String(student.reservedBy._id || student.reservedBy) !== String(student._id)
            ? student.reservedBy
            : null;
        const roomId = student.assignedRoom?._id || student.assignedRoom;
        const hostelId = student.assignedHostel?._id || student.assignedHostel;
        if (student.reservationExpiresAt && new Date(student.reservationExpiresAt) <= new Date()) {
            if (inviter) {
                const notes = 'Invitation expired before the student approved it';
                await Promise.allSettled([
                    invitationAuditService.logInvitationOutcome({
                        invitee: student,
                        inviter,
                        actor: student._id,
                        action: 'expired',
                        room: student.assignedRoom,
                        hostel: student.assignedHostel,
                        bunk: student.assignedBunk,
                        notes,
                    }),
                    notificationService.notifyInvitationStatusUpdated(inviter._id || inviter, student._id, roomId, hostelId, 'expired', notes),
                ]);
            }
            await releaseStudentReservation(student);
            return res.status(400).json({
                success: false,
                message: 'This invitation has already expired and the room hold has been released. Please choose another room.',
            });
        }
        if (action === 'reject') {
            if (inviter) {
                const notes = 'Invitation rejected by the invited student';
                await Promise.allSettled([
                    invitationAuditService.logInvitationOutcome({
                        invitee: student,
                        inviter,
                        actor: student._id,
                        action: 'rejected',
                        room: student.assignedRoom,
                        hostel: student.assignedHostel,
                        bunk: student.assignedBunk,
                        notes,
                    }),
                    notificationService.notifyInvitationStatusUpdated(inviter._id || inviter, student._id, roomId, hostelId, 'rejected', notes),
                ]);
            }
            await releaseStudentReservation(student);
            return res.status(200).json({
                success: true,
                message: 'Room invitation rejected successfully',
                data: null,
            });
        }
        if (student.paymentStatus !== 'paid') {
            return res.status(400).json({
                success: false,
                message: 'Complete your payment before approving this room invitation',
            });
        }
        student.reservationStatus = 'confirmed';
        student.invitationReminderMarks = [];
        await student.save();
        if (inviter) {
            const notes = 'Invitation approved by the invited student';
            await Promise.allSettled([
                invitationAuditService.logInvitationOutcome({
                    invitee: student,
                    inviter,
                    actor: student._id,
                    action: 'approved',
                    room: student.assignedRoom,
                    hostel: student.assignedHostel,
                    bunk: student.assignedBunk,
                    notes,
                }),
                notificationService.notifyInvitationStatusUpdated(inviter._id || inviter, student._id, roomId, hostelId, 'approved', notes),
                notificationService.notifyReservationConfirmed(student._id, roomId, student.assignedBunk?._id || student.assignedBunk, hostelId),
            ]);
        }
        const reservationData = await buildReservationData(student);
        return res.status(200).json({
            success: true,
            message: 'Room invitation approved successfully',
            data: reservationData,
            ...reservationData,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to respond to room invitation',
        });
    }
};
exports.cancelReservation = async (req, res) => {
    try {
        const student = await Student.findById(req.user._id).populate('roommates');
        if (!student || !student.assignedRoom || student.reservationStatus === 'none') {
            return res.status(404).json({
                success: false,
                message: 'No active reservation found',
            });
        }
        await releaseStudentReservation(student);
        res.status(200).json({
            success: true,
            message: 'Reservation canceled successfully',
        });
    }
    catch (error) {
        const statusCode = error.message === 'Checked-in reservations cannot be canceled from the student portal'
            ? 400
            : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to cancel reservation',
        });
    }
};
