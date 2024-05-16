// global-teardown.js - clean-up after all tests
const dockerCompose = require('docker-compose/dist/v2');

module.exports = async () => {
  await dockerCompose.down();
};
