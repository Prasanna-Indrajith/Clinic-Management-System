module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allow these types from the development plan
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'test', 'docs', 'chore', 'ci', 'perf', 'security'],
    ],
    // Allowed scopes map to the modules in this project
    'scope-enum': [
      1, // warn (not error) — we don't want to block unusual but valid scopes
      'always',
      [
        'auth', 'patients', 'doctors', 'appointments',
        'reports', 'security', 'db', 'frontend',
        'deploy', 'audit', 'search', 'ui', 'api',
        'middleware', 'config', 'notifications', 'e2e', 'test',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
  },
};
