const { createApp } = require('./app');
const { loadConfig } = require('./config');

const { port, auth } = loadConfig();
const server = createApp({ auth }).listen(port, () => {
  console.log(`Customer Management API listening on port ${port}`);
});

server.on('error', (error) => {
  console.error('Failed to start Customer Management API:', error);
  process.exitCode = 1;
});
