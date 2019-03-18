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

  protocolOrFalse: str => (['https', 'http'].includes(str) ? str : false),

  methodOrFalse: str =>
    ['post', 'get', 'delete', 'put'].includes(str) ? str : false,

  timeoutSecondsOrFalse: int =>
    typeof int === 'number' &&
    int % 1 === 0 &&
    int >= 1 &&
    int <= config.maxChecks
      ? int
      : false,

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

  /**
   * Create a string of random alphanumeric characters of a given length
   * @param { number } length
   */
  createRandomString: length => {
    if (typeof length !== 'number' || length <= 0) return false;
    const allowedChars = 'abcdefghijklmnopuvwxyz0123456789';

    let str = '';
    for (i = 0; i < length; i++)
      str += allowedChars.charAt(
        Math.floor(Math.random() * allowedChars.length)
      );

    return str;
  },
};

module.exports = helpers;
