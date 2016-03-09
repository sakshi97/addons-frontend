// Karma configuration
/* eslint-disable no-console */
require('babel-register');
const webpackDevConfig = require('./src/config/webpack.dev.config.babel').default;

const coverageReporters = [{
  type: 'text-summary',
}];

const newWebpackConfig = Object.assign({}, webpackDevConfig, {
  plugins: [],
  devtool: 'inline-source-map',
  module: Object.assign({}, webpackDevConfig.module, {
    preLoaders: [{
      test: /\.jsx?$/,
      loader: 'babel-istanbul',
      include: /src\//,
      exclude: /node_modules/,
    }],
  }),
  output: undefined,
  entry: undefined,
});

const reporters = [
  'mocha',
  'coverage',
];

if (process.env.TRAVIS) {
  console.log('On Travis sending coveralls');
  coverageReporters.push({ type: 'lcov', dir: 'coverage'});
  reporters.push('coveralls');
} else {
  console.log('Not on Travis so not sending coveralls');
  coverageReporters.push({type: 'html', dir: 'coverage', subdir: '.'});
}

module.exports = function karmaConf(config) {
  config.set({
    coverageReporter: {
      reporters: coverageReporters,
    },
    frameworks: ['mocha', 'chai', 'sinon'],
    files: [
      'test-runner.js',
    ],
    preprocessors: {
      'test-runner.js': ['webpack', 'sourcemap'],
    },
    reporters,
    colors: true,
    port: 9876,
    plugins: [
      'karma-chai',
      'karma-coverage',
      'karma-coveralls',
      'karma-firefox-launcher',
      'karma-mocha',
      'karma-mocha-reporter',
      'karma-sinon',
      'karma-sourcemap-loader',
      'karma-webpack',
    ],
    autoWatch: true,
    browsers: ['Firefox'],
    singleRun: false,
    concurrency: Infinity,
    webpack: newWebpackConfig,
    webpackServer: {
      noInfo: true,
      quiet: true,
    },
  });
};
