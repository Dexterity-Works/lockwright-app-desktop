const os = require('os')

/**
 * Device name shown to other vault members: "<hostname> <platform> <release>".
 * @returns {string}
 */
const getDeviceName = () =>
  [os.hostname(), os.platform(), os.release()].join(' ')

module.exports = { getDeviceName }
