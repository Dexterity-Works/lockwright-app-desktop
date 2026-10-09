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
    'node_modules/(?!(htm|react-strict-dom|@tetherto/pearpass-lib-ui-react-components|lockwright-lib-ui-react-hooks|lockwright-lib-utils|lockwright-lib-vault|lockwright-lib-vault-core|lockwright-lib-ui-react-native-components|lockwright-utils-avatar-initials|lockwright-lib-constants|lockwright-utils-date)/)'
  ],
  globals: {
    Pear: {
      config: { tier: 'dev' }
    }
  }
}
