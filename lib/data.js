/**
 * Library for storing and editing data
 */

// Dependencies
const fs = require('fs');
const path = require('path');

const { parseJsonStrToObject } = require('./helpers');

// Container for the module (to be exported)
const lib = {
  // Base directory of the data folder
  baseDir: path.join(__dirname, '../.data/'),

  /**
   * @param { 'tokens' | 'users' | 'checks' } dir
   */
  getFileName: (dir, file) => `${lib.baseDir}${dir}/${file}.json`,

  /**
   * @param { 'tokens' | 'users' | 'checks' } dir
   */
  checkIfExists: (dir, file) => fs.existsSync(lib.getFileName(dir, file)),

  /**
   * @param { 'tokens' | 'users' | 'checks' } dir
   */
  create: (dir, file, data) =>
    new Promise((resolve, reject) => {
      // Open the file for writing
      fs.open(lib.getFileName(dir, file), 'wx', (error, fileDescriptor) => {
        if (error || !fileDescriptor)
          return reject('Could not create new file, it may already exist');

        // Convert data to a string
        const stringData = JSON.stringify(data);

        // Write to file and close it
        fs.writeFile(fileDescriptor, stringData, error => {
          if (error) return reject('Error writing to new file');

          fs.close(fileDescriptor, error =>
            error ? reject('Error closing new file') : resolve()
          );
        });
      });
    }),

  /**
   * @param { 'tokens' | 'users' | 'checks' } dir
   */
  read: (dir, file) =>
    new Promise((resolve, reject) => {
      fs.readFile(lib.getFileName(dir, file), 'utf8', (error, data) =>
        error ? reject(error) : resolve(parseJsonStrToObject(data))
      );
    }),

  /**
   * @param { 'tokens' | 'users' | 'checks' } dir
   */
  update: (dir, file, data) =>
    new Promise((resolve, reject) => {
      // Open the file for writing
      fs.open(lib.getFileName(dir, file), 'r+', (error, fileDescriptor) => {
        if (error || !fileDescriptor)
          return reject(
            'Could not open the file for updating, it may not exist yet'
          );

        // Convert data to a string
        const stringData = JSON.stringify(data);

        // Truncate the file
        fs.ftruncate(fileDescriptor, error => {
          if (error) return reject('Error truncating file');

          // Write to the file and close it
          fs.writeFile(fileDescriptor, stringData, error => {
            if (error) return reject('Error writing to existing file');

            fs.close(fileDescriptor, error => {
              if (error) return reject('Error closing existing file');

              resolve();
            });
          });
        });
      });
    }),

  /**
   * @param { 'tokens' | 'users' | 'checks' } dir
   */
  delete: (dir, file) =>
    new Promise((resolve, reject) => {
      fs.unlink(lib.getFileName(dir, file), error =>
        error ? reject('Error deleting file') : resolve()
      );
    }),
};

// Export the module
module.exports = lib;
