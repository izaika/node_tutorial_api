/**
 * Request handlers
 *
 */

// Dependencies
const helpers = require('./helpers');
const _data = require('./data');
const validators = require('./validators');

// Define the handlers
const handlers = {
  ping: () => new Promise.resolve({ statusCode: 200 }),
  users: data =>
    new Promise(resolve => {
      const acceptableMethods = ['post', 'get', 'put', 'delete'];
      if (!acceptableMethods.includes(data.method))
        return resolve({ statusCode: 405 });

      handlers._users[data.method](data, resolve);
    }),
  // Container for the users submethods
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
        return resolve({
          statusCode: 400,
          payload: {
            error: 'Missing required fields',
          },
        });

      // Make sure that the user does not already exist
      if (_data.checkIfExists('users', phone)) {
        return resolve({
          statusCode: 400,
          payload: {
            error: 'A user with this phone number already exists',
          },
        });
      }

      const hashedPassword = helpers.hash(password);

      if (!hashedPassword) {
        return resolve({
          statusCode: 500,
          payload: {
            error: "Could not hash the user's password",
          },
        });
      }

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
        resolve({ statusCode: 200 });
      } catch (error) {
        resolve({
          statusCode: 500,
          payload: {
            error: 'Could not create the new user',
          },
        });
      }
    },
    // Required data: phone
    // Optional data: none
    // @TODO: Only let an authenticated user access their object. Don't let them access anyone elses.
    get: async (data, resolve) => {
      const { phone } = data.queryStringObject;

      // Check phone exists & valid
      if (!validators.phone(phone))
        return resolve({
          statusCode: 400,
          payload: {
            error: 'Missing required fields',
          },
        });

      // Lookup the user
      try {
        const payload = await _data.read('users', phone);
        // Remove the hashed password from the user object before returning it to requester
        delete payload.hashedPassword;
        resolve({ statusCode: 200, payload });
      } catch (error) {
        resolve({ statusCode: 404 });
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
      if (!phone)
        return resolve({
          statusCode: 400,
          payload: {
            error: 'Missing required fields',
          },
        });

      // Check for the optional fields;
      if (!(firstName || lastName || password)) {
        return resolve({
          statusCode: 400,
          payload: {
            error: 'Missing fields to update',
          },
        });
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
          resolve({ statusCode: 200 });
        } catch (error) {
          console.log(error);
          resolve({
            statusCode: 500,
            payload: { error: 'Could not update the user' },
          });
        }
      } catch (error) {
        resolve({
          statusCode: 400,
          payload: { error: 'The specified user does not exist' },
        });
      }
    },
    // Required data: phone
    // Optional data: none
    // @TODO: Only let an authenticated user delete their object. Don't let them delete anyone elses.
    delete: async (data, resolve) => {
      const phone =
        validators.phone(data.payload.phone) && data.payload.phone.trim();

      // Check phone exists & valid
      if (!phone)
        return resolve({
          statusCode: 400,
          payload: {
            error: 'Missing required fields',
          },
        });

      try {
        await _data.read('users', phone);
        try {
          await _data.delete('users', phone);
          resolve({ statusCode: 200 });
        } catch (error) {
          resolve({
            statusCode: 500,
            payload: { error: 'Could not delete the specified user' },
          });
        }
      } catch (error) {
        resolve({
          statusCode: 400,
          payload: { error: 'Could not find the specified user' },
        });
      }
    },
  },

  notFound: () => Promise.resolve({ statusCode: 404 }),
};

// Export the module
module.exports = handlers;
