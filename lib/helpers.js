const crypto = require('crypto');

const config = require('./config');

const helpers = {
  /**
   * If given param is string and it is not empty - return trimmed value
   * Otherwise return false
   *
   */
  stringOrFalse: str =>
    typeof str === 'string' && str.trim().length > 0 ? str.trim() : false,

  /**
   * Returns SHA256 hash of given string
   *
   * @param { string } str
   * @returns { string }
   */
  hash: str =>
    helpers.stringOrFalse(str) &&
    crypto
      .createHmac('sha256', config.hashingSecret)
      .update(str)
      .digest('hex'),

  /**
   * Parse a JSON string to an object in all cases, without throwing
   *
   * @param { string } str
   * @returns { object }
   */
  parseJsonStrToObject: str => {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  },
};

module.exports = helpers;
