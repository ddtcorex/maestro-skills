// Human page name for a url set label, in order: the agent's override in
// clientSummary.pageNames, the enriched config entry for the same page (same
// label and URI, so a re-pointed label never borrows a name), the run's own
// url set, then the raw label.
export function resolvePageName(label, { pageNames = {}, configUrlSet = [], runUrlSet = [] } = {}) {
  if (pageNames[label]) return pageNames[label]
  const run = runUrlSet.find((u) => u.label === label)
  const config = configUrlSet.find((u) => u.label === label && (!run || u.uri === run.uri))
  return config?.name ?? run?.name ?? label
}
