// global-setup.js
const dockerCompose = require('docker-compose/dist/v2');

module.exports = async () => {
  await dockerCompose.upAll();
};
