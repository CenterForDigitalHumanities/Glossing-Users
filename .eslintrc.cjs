module.exports = {
  env: {
    es2023: true,
    node: true
  },
  extends: ['eslint:recommended', 'plugin:import/recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-var': 'error',
    'prefer-const': ['error', { destructuring: 'all' }],
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'always'
      }
    ]
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js']
      }
    }
  }
}
