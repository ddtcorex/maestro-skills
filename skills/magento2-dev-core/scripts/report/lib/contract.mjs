// Report contract: the anchors and attributes a brand overlay relies on.
// Bump REPORT_CONTRACT on any change to the anchors or the overlay token map.
export const REPORT_CONTRACT = 1

export const ANCHORS = {
  rootHeader: ':root{--header-bg:',
  codeFont: 'code{font-family:',
  logoLabel: 'Maestro logo',
}

export const CONTRACT_META = `<meta name="maestro-report-contract" content="${REPORT_CONTRACT}">`
