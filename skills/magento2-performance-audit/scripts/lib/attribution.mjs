const FRAME = /#\d+ (.*?) called at \[(.*?)\]/g
const FRAMEWORK = ['vendor/magento/framework/', 'vendor/magento/zend-db/', 'generated/code/', 'vendor/magento/module-eav/Model/Entity/Collection/AbstractCollection']

const fn = (s) => s.replace(/#[0-9a-f]{32}#/g, '').replace(/\[.*?\]/g, '').replace(/\(.*$/, '')

// The caller of a query: the first app/code or third-party vendor frame,
// else the first frame outside the framework, else "?".
export function attributeCaller(trace) {
  let fallback = null
  for (const [, call, at] of trace.matchAll(FRAME)) {
    const label = `${at} (${fn(call)})`
    if (at.startsWith('app/code/') || (at.startsWith('vendor/') && !at.startsWith('vendor/magento/'))) return { caller: label, custom: true }
    if (fallback === null && !FRAMEWORK.some((p) => at.startsWith(p))) fallback = label
  }
  return { caller: fallback ?? '?', custom: false }
}
