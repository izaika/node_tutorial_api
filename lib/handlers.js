const config = require('./config');
const helpers = require('./helpers');
const _data = require('./data');
const validators = require('./validators');

const commonHandler = (handlerName, data) =>
  new Promise(resolve => {
    const method = helpers.methodOrFalse(data.method);
    if (!method) return resolve({ statusCode: 405 });
    handlers[`_${handlerName}`][method](data, resolve);
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

/**
 * @param { PromiseConstructor.resolve<T>(value: T | PromiseLike<T>): Promise<T> } resolve
 */
const tokenError = resolve =>
  error(resolve, 403, 'Token is missing or invalid');

// Define the handlers
const handlers = {
  ping: () => new Promise.resolve({ statusCode: 200 }),
  notFound: () => Promise.resolve({ statusCode: 404 }),
  users: data => commonHandler('users', data),
  tokens: data => commonHandler('tokens', data),
  checks: data => commonHandler('checks', data),

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
        checks: [],
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
    get: async (data, resolve) => {
      const { phone } = data.queryStringObject;

      // Check phone exists & valid
      if (!validators.phone(phone)) return missingRequiredFieldsError(resolve);

      // Get the token from the headers
      const { token } = data.headers;

      // Verify token
      if (!(await handlers._tokens._verifyToken(token, phone)).payload)
        return tokenError(resolve);

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

      // Get the token from the headers
      const { token } = data.headers;

      // Verify token
      if (!(await handlers._tokens._verifyToken(token, phone)).payload)
        return tokenError(resolve);

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
    delete: async (data, resolve) => {
      const phone =
        validators.phone(data.queryStringObject.phone) &&
        data.queryStringObject.phone.trim();

      // Check phone exists & valid
      if (!phone) return missingRequiredFieldsError(resolve);

      // Get the token from the headers
      const { token } = data.headers;

      // Verify token
      if (!(await handlers._tokens._verifyToken(token, phone)).payload)
        return tokenError(resolve);

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

    // Required data: id
    // Optional data: none
    get: async (data, resolve) => {
      const { id } = data.queryStringObject;

      // Check id exists & valid
      if (!id) return missingRequiredFieldsError(resolve);

      // Lookup the token
      try {
        const tokenData = await _data.read('tokens', id);
        // Remove the hashed password from the user object before returning it to requester
        success(resolve, 200, tokenData);
      } catch {
        error(resolve, 404);
      }
    },
    // Required data: id, extend
    // Optional data: none
    put: async (data, resolve) => {
      const { id, extend } = data.payload;

      if (!id || !extend) return missingRequiredFieldsError(resolve);

      // Lookup the token
      try {
        const tokenData = await _data.read('tokens', id);

        // Check if token not expired
        if (tokenData.expires <= Date.now())
          return error(
            resolve,
            400,
            'The token has already expired and can not be extended'
          );

        // Set the expiration an hour from now
        tokenData.expires = Date.now() + 60 * 60 * 1000;

        // Store the new udpates
        try {
          await _data.update('tokens', id, tokenData);
          success(resolve);
        } catch {
          error(resolve, 500, "Could not update the token's expiration");
        }
      } catch {
        error(resolve, 400, 'Specified token does not exist');
      }
    },

    // Required data: id
    // Optional data: none
    delete: async (data, resolve) => {
      const { id } = data.queryStringObject;

      // Check phone exists & valid
      if (!id) return missingRequiredFieldsError(resolve);

      try {
        await _data.read('tokens', id);
        try {
          await _data.delete('tokens', id);
          success(resolve);
        } catch {
          error(resolve, 500, 'Could not delete the specified token');
        }
      } catch {
        error(resolve, 400, 'Could not find the specified token');
      }
    },

    // Verify if a given token is currently valid for a given user
    _verifyToken: (tokenId, phone) =>
      new Promise(async resolve => {
        // Lookup the token
        try {
          const tokenData = await _data.read('tokens', tokenId);
          // Check that the token is for the given user and has not expired
          if (tokenData.phone !== phone && tokenData.expires <= Date.now())
            return success(resolve, 200, false);

          success(resolve, 200, true);
        } catch {
          success(resolve, 200, false);
        }
      }),
  },

  _checks: {
    // Required data: protocol, url, method, successCodes, timeoutSeconds
    // Optional data: none
    post: async (data, resolve) => {
      const { payload } = data;

      const protocol = helpers.protocolOrFalse(payload.protocol);
      const url = helpers.stringOrFalse(payload.url);
      const method = helpers.methodOrFalse(payload.method);
      const successCodes =
        typeof payload.successCodes === 'object' &&
        payload.successCodes instanceof Array &&
        payload.successCodes.length > 0
          ? payload.successCodes
          : false;
      const timeoutSeconds = helpers.timeoutSecondsOrFalse(
        payload.timeoutSeconds
      );

      if (!(protocol && url && method && successCodes && timeoutSeconds))
        return missingRequiredFieldsError();

      const { token } = data.headers;
      try {
        const tokenData = await _data.read('tokens', token);
        const { phone: userPhone } = tokenData;
        try {
          const userData = await _data.read('users');
          const { checks } = userData;
          if (checks >= config.maxChecks)
            return error(
              resolve,
              400,
              'The user already has the maximum number of checks'
            );

          const checkId = helpers.createRandomString(20);
          const checkObject = {
            id: checkId,
            userPhone,
            protocol,
            url,
            method,
            successCodes,
            timeoutSeconds,
          };

          try {
            await _data.create('checks', checkId, checkObject);
            userData.checks = [...checks, checkId];
            try {
              await _data.update('users', userPhone, userData);
              success(resolve, 200, checkObject);
            } catch {
              error(
                resolve,
                500,
                'Could not update the user with the new check'
              );
            }
          } catch {
            error(resolve, 500, 'Could not create the new check');
          }
        } catch {
          tokenError(resolve);
        }
      } catch {
        tokenError(resolve);
      }
    },
  },
};

// Export the module
module.exports = handlers;
