module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: ['test/step_defs/**/*.ts'],
    paths: ['features/**/*.feature'],
    format: ['progress-bar', 'summary'],
    publishQuiet: true,
  },
}
