export default {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest'
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.yalc/',
    '/packages/',
    '/e2e/',
    '/dist/',
    '/out/'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(htm|react-strict-dom|@tetherto/pearpass-lib-ui-react-components|lockwright-lib-ui-react-hooks|lockwright-utils-validator|lockwright-lib-vault|lockwright-lib-vault-core|lockwright-lib-ui-react-native-components|lockwright-utils-password-check|lockwright-utils-password-generator|lockwright-utils-avatar-initials|lockwright-utils-generate-unique-id|lockwright-lib-constants|lockwright-utils-date|lockwright-utils-qr)/)'
  ],
  globals: {
    Pear: {
      config: { tier: 'dev' }
    }
  }
}
