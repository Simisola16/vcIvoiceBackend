const { join } = require('path');

/**
 * Puppeteer configuration for Render / Linux deployments
 */
module.exports = {
  // Store the browser cache in a directory that Render builds can access
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
