module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { node: 'current' },
        modules: 'commonjs'
      }
    ],
    '@babel/preset-react',
    '@babel/preset-typescript'
  ],
  env: {
    test: {
      // Compile `css.create(...)` / `html.*` calls from react-strict-dom and
      // lockwright-lib-ui-react-native-components the same way the production bundler does
      // (see `scripts/bundle-renderer.mjs`). Without this, evaluating those
      // modules in Jest throws "Styles must be compiled by '@stylexjs/babel-plugin'".
      presets: [
        [
          'react-strict-dom/babel-preset',
          {
            debug: false,
            dev: false,
            rootDir: process.cwd(),
            platform: 'web'
          }
        ]
      ]
    }
  }
}
