/** Every area plugin and the skills it ships. The single source for manifests tests, the provider and install.sh checks. */
export const AREAS: Record<string, readonly string[]> = {
  'maestro-govard': ['govard-toolbox', 'govard-magento', 'govard-laravel', 'govard-symfony', 'govard-wordpress', 'review-in-worktree'],
  'maestro-magento2': [
    'magento2-dev-core', 'magento2-backend-dev', 'magento2-frontend-dev', 'magento2-hyva-dev',
    'magento2-linter', 'magento2-code-review', 'magento2-performance-audit', 'magento2-security-scan',
  ],
  'maestro-php': ['php-dev-core'],
  'maestro-design': ['maestro-design', 'diagram-studio'],
  'maestro-craft': ['prior-art-search'],
}
