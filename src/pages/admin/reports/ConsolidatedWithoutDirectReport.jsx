import ConsolidatedPayoutReport from './ConsolidatedPayoutReport'

// This report is the same as ConsolidatedPayoutReport but excludes Direct
export default function ConsolidatedWithoutDirectReport() {
  return <ConsolidatedPayoutReport excludeDirect={true} />
}

