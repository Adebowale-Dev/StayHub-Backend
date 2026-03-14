const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
const get = (key) => {
    return cache.get(key);
};
const set = (key, value, ttl) => {
    if (ttl) {
        return cache.set(key, value, ttl);
    }
    return cache.set(key, value);
};
const del = (key) => {
    return cache.del(key);
};
const delPattern = (pattern) => {
    const keys = cache.keys();
    const matchingKeys = keys.filter(key => key.includes(pattern));
    return cache.del(matchingKeys);
};
const flush = () => {
    return cache.flushAll();
};
const has = (key) => {
    return cache.has(key);
};
const keys = () => {
    return cache.keys();
};
const stats = () => {
    return cache.getStats();
};
const cacheKeys = {
    hostelsByLevel: (level) => `hostels:level:${level}`,
    roomsByHostel: (hostelId) => `rooms:hostel:${hostelId}`,
    bunksByRoom: (roomId) => `bunks:room:${roomId}`,
    student: (studentId) => `student:${studentId}`,
    porter: (porterId) => `porter:${porterId}`,
    payment: (paymentId) => `payment:${paymentId}`,
    paymentAmount: () => 'payment:amount:current',
    availableRooms: (level) => `available:rooms:level:${level}`,
};
module.exports = {
    get,
    set,
    del,
    delPattern,
    flush,
    has,
    keys,
    stats,
    cacheKeys,
};
