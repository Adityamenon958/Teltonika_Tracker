'use strict';

/**
 * ✅ Protocol resolver — Teltonika only in V1.
 * Future: select by port / signature.
 */
const teltonika = require('./teltonika');

function getDefaultProtocol() {
  return teltonika;
}

module.exports = {
  teltonika,
  getDefaultProtocol,
};
