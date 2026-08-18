/*
 * Mock for react-ga4 in Jest tests
 */
module.exports = {
  initialize: jest.fn(),
  send: jest.fn(),
  event: jest.fn(),
  set: jest.fn(),
  gtag: jest.fn(),
  default: {
    initialize: jest.fn(),
    send: jest.fn(),
    event: jest.fn(),
    set: jest.fn(),
    gtag: jest.fn(),
  },
};
