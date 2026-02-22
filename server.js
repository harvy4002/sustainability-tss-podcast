import http from 'http';
import { generatePodcast } from './function.js';

const server = http.createServer((req, res) => {
  // Set a default timeout
  req.setTimeout(600000); // 10 minutes

  // Pass the request and response to the function
  generatePodcast(req, res);
});

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
