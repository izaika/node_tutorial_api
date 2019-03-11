/**
 * Request handlers
 *
 */

// Dependencies
const helpers = require('./helpers');
const _data = require('./data');
const validators = require('./validators');

const commonHandler = (handlerName, data) =>
  new Promise(resolve => {
    const acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (!acceptableMethods.includes(data.method))
      return resolve({ statusCode: 405 });

    handlers[`_${handlerName}`][data.method](data, resolve);
  });

/**
 * @param { PromiseConstructor.resolve<T>(value: T | PromiseLike<T>): Promise<T> } resolve
 * @param { number } statusCode
 * @param { string } message
 */
const error = (resolve, statusCode, message) => {
  resolve({
    statusCode,
    payload: {
      error: message,
    },
  });
};

/**
 * @param { PromiseConstructor.resolve<T>(value: T | PromiseLike<T>): Promise<T> } resolve
 * @param { number } statusCode
 * @param { any } payload
 */
const success = (resolve, statusCode = 200, payload) => {
  resolve({ statusCode, payload });
};

/**
 * @param { PromiseConstructor.resolve<T>(value: T | PromiseLike<T>): Promise<T> } resolve
 */
const missingRequiredFieldsError = resolve =>
  error(resolve, 400, 'Missing required fields');

// Define the handlers
const handlers = {
  ping: () => new Promise.resolve({ statusCode: 200 }),
  notFound: () => Promise.resolve({ statusCode: 404 }),
  users: data => commonHandler('users', data),
  tokens: data => commonHandler('tokens', data),

  _users: {
    // Users - post
    // Required data: firstName, lastName, phone, password, tosAgreement
    // Optional data: none
    post: async (data, resolve) => {
      // Check that all required fields are filled out
      const { payload } = data;

      const firstName = helpers.stringOrFalse(payload.firstName);
      const lastName = helpers.stringOrFalse(payload.lastName);

      const phone = validators.phone(payload.phone)
        ? payload.phone.trim()
        : false;

      const password = helpers.stringOrFalse(payload.password);

      const tosAgreement =
        typeof payload.tosAgreement === 'boolean' && payload.tosAgreement;

      if (!firstName || !lastName || !phone || !password || !tosAgreement)
        return missingRequiredFieldsError(resolve);

      // Make sure that the user does not already exist
      if (_data.checkIfExists('users', phone))
        return error(
          resolve,
          400,
          'A user with this phone number already exists'
        );

      const hashedPassword = helpers.hash(password);

      if (!hashedPassword)
        return error(resolve, 500, "Could not hash the user's password");

      // Create the user object
      const userObject = {
        firstName,
        lastName,
        phone,
        hashedPassword,
        tosAgreement,
      };

      // Store the user
      try {
        await _data.create('users', phone, userObject);
        success(resolve);
      } catch {
        error(resolve, 500, 'Could not create the new user');
      }
    },
    // Required data: phone
    // Optional data: none
    // @TODO: Only let an authenticated user access their object. Don't let them access anyone elses.
    get: async (data, resolve) => {
      const { phone } = data.queryStringObject;

      // Check phone exists & valid
      if (!validators.phone(phone)) return missingRequiredFieldsError(resolve);

      // Lookup the user
      try {
        const payload = await _data.read('users', phone);
        // Remove the hashed password from the user object before returning it to requester
        delete payload.hashedPassword;
        success(resolve, 200, payload);
      } catch {
        error(resolve, 404);
      }
    },
    // Required data: phone
    // Optional data: firstName, lastName, password (at least one must be specified)
    // @TODO: Only let an authenticated user update their object. Don't let them update anyone elses.
    put: async (data, resolve) => {
      const { payload } = data;

      const phone = validators.phone(payload.phone) && payload.phone.trim();

      const firstName = helpers.stringOrFalse(payload.firstName);
      const lastName = helpers.stringOrFalse(payload.lastName);

      const password = helpers.stringOrFalse(payload.password);

      // Check phone exists & valid
      if (!phone) return missingRequiredFieldsError(resolve);

      // Check for the optional fields;
      if (!(firstName || lastName || password)) {
        return error(resolve, 400, 'Missing fields to update');
      }

      try {
        // Lookup the user
        const userData = await _data.read('users', phone);

        // update fields
        if (firstName) userData.firstName = firstName;
        if (lastName) userData.lastName = lastName;
        if (password) userData.hashedPassword = helpers.hash(lastName);

        try {
          // save the new updates
          await _data.update('users', phone, userData);
          success(resolve);
        } catch {
          error(resolve, 500, 'Could not update the user');
        }
      } catch {
        error(resolve, 400, 'The specified user does not exist');
      }
    },
    // Required data: phone
    // Optional data: none
    // @TODO: Only let an authenticated user delete their object. Don't let them delete anyone elses.
    delete: async (data, resolve) => {
      const phone =
        validators.phone(data.payload.phone) && data.payload.phone.trim();

      // Check phone exists & valid
      if (!phone) return missingRequiredFieldsError(resolve);

      try {
        await _data.read('users', phone);
        try {
          await _data.delete('users', phone);
          success(resolve);
        } catch {
          error(resolve, 500, 'Could not delete the specified user');
        }
      } catch {
        error(resolve, 400, 'Could not find the specified user');
      }
    },
  },

  _tokens: {
    // Required data: phone, password
    // Optional data: none
    post: async (data, resolve) => {
      const { payload } = data;

      const phone = validators.phone(payload.phone)
        ? payload.phone.trim()
        : false;
      const password = helpers.stringOrFalse(payload.password);

      if (!phone || !password) return missingRequiredFieldsError(resolve);

      // Lookup the user who matches that phone number
      try {
        const userData = await _data.read('users', phone);

        // Hash the sent password & compare it to the password stored in the user object
        const hashedPassword = helpers.hash(password);

        if (hashedPassword !== userData.hashedPassword)
          return error(resolve, 400, 'Password did not match');

        // If valid, create a new token with a random name. Set expiration date 1 hour in the future
        const tokenId = helpers.createRandomString(20);
        const expires = Date.now() + 60 * 60 * 1000;
        const tokenObject = {
          phone,
          id: tokenId,
          expires,
        };

        // Store the token
        try {
          await _data.create('tokens', tokenId, tokenObject);
          success(resolve, 200, tokenObject);
        } catch {
          error(resolve, 500, 'Could not create the new token');
        }
      } catch {
        error(resolve, 400, 'Could not find the specified user');
      }
    },
    get: async (data, resolve) => {},
    put: async (data, resolve) => {},
    delete: async (data, resolve) => {},
  },
};

// Export the module
module.exports = handlers;
