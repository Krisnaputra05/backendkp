const crypto = require('crypto');

const generateUUID = async () => {
  // Gunakan crypto.randomUUID() yang built-in Node.js >= 15.6
  // Lebih kompatibel dengan Jest (tidak perlu dynamic import ESM)
  return crypto.randomUUID();
};

module.exports = {
  generateUUID,
};
