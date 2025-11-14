const NodeCache = require('node-cache');

// Create cache instance with default TTL of 1 hour
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {any} - Cached value or undefined
 */
const get = (key) => {
  return cache.get(key);
};

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (optional)
 */
const set = (key, value, ttl) => {
  if (ttl) {
    return cache.set(key, value, ttl);
  }
  return cache.set(key, value);
};

/**
 * Delete key from cache
 * @param {string} key - Cache key
 */
const del = (key) => {
  return cache.del(key);
};

/**
 * Delete keys matching pattern
 * @param {string} pattern - Pattern to match
 */
const delPattern = (pattern) => {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  return cache.del(matchingKeys);
};

/**
 * Clear all cache
 */
const flush = () => {
  return cache.flushAll();
};

/**
 * Check if key exists
 * @param {string} key - Cache key
 */
const has = (key) => {
  return cache.has(key);
};

/**
 * Get all keys
 */
const keys = () => {
  return cache.keys();
};

/**
 * Get cache stats
 */
const stats = () => {
  return cache.getStats();
};

// Cache key generators
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
