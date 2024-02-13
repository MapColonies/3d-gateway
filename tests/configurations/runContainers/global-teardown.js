// global-teardown.js - clean-up after all tests
const dockerCompose = require('docker-compose');

module.exports = async () => {
  dockerCompose.down();
};
