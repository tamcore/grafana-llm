const { FlatCompat } = require('@eslint/eslintrc');
const path = require('path');

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

module.exports = [
  ...compat.extends('@grafana/eslint-config'),
  {
    ignores: ['dist/', 'node_modules/', '.config/'],
  },
];
