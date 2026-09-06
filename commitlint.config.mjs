// Conventional Commits rules, applied by CI to the pull request's commit range
// only — never to the repository's full history (NFR-6, constitution Principle V).
const config = {
  extends: ['@commitlint/config-conventional'],
};

export default config;
