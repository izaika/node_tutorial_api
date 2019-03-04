const environments = {
  staging: {
    httpPort: 3000,
    httpsPort: 3001,
    envName: 'staging',
    hashingSecret: 'devSecret',
  },
  production: {
    httpPort: 5000,
    httpsPort: 5001,
    envName: 'production',
    hashingSecret: 'prodSecret',
  },
};

const { NODE_ENV } = process.env;

module.exports =
  NODE_ENV && NODE_ENV.toLowerCase() === 'production'
    ? environments.production
    : environments.staging;
