/**
 * Primary file for the API
 *
 */

// Dependencies
const http = require('http');
const url = require('url');
const { StringDecoder } = require('string_decoder');

// The server should respond to all requests with a string
const server = http.createServer((request, response) => {
  // Get the URL and parse it
  const parsedUrl = url.parse(request.url, true);

  // Get the path
  const path = parsedUrl.pathname;
  const trimmedPath = path.replace(/^\/+|\/+$/g, '');

  // Get the query string as an object
  const queryStringObject = parsedUrl.query;

  // Get the HTTP Method
  const method = request.method.toLowerCase();

  // Get the headers as an object
  const { headers } = request;

  // Get the payload if any
  const decoder = new StringDecoder('utf-8');
  let buffer = '';

  request.on('data', data => {
    buffer += decoder.write(data);
  });

  request.on('end', async () => {
    buffer += decoder.end();

    // Choose the handler this request should go to. If one in not found - use the notFound handler.
    const chosenHandler =
      typeof router[trimmedPath] !== 'undefined'
        ? router[trimmedPath]
        : handlers.notFound;

    // Construct the data object to send to the handler
    const data = {
      trimmedPath,
      queryStringObject,
      method,
      headers,
      payload: buffer,
    };

    // Route the request to the handler specified in the router
    let { statusCode, payload } = await chosenHandler(data);

    // Use the status code called back by the handler, or default to 200
    statusCode = typeof statusCode === 'number' ? statusCode : 200;

    // Use the payload called back by the handler, or default to an empty object
    payload = typeof payload === 'object' ? payload : {};

    // Convert the payload to a string
    const payloadString = JSON.stringify(payload);

    // Return the response
    response.setHeader('Content-Type', 'application/json');
    response.writeHead(statusCode);
    response.end(payloadString);

    console.log('Returning the response: ', statusCode, payloadString);
  });
});

// Start the server, and have it listen on port 3000
server.listen(3000, () => {
  console.log('The server is listening on port 3000 now');
});

// Define the handlers
const handlers = {};

// Sample handler
handlers.sample = data =>
  new Promise(resolve => {
    // Callback a http status code and a payload object
    resolve({
      statusCode: 406,
      payload: {
        name: 'sample handler',
      },
    });
  });

// Not found handler
handlers.notFound = data =>
  new Promise(resolve => {
    resolve({
      statusCode: 404,
    });
  });

// Define a request router
const router = {
  sample: handlers.sample,
};
