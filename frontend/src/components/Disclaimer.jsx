import { SCREENING_DISCLAIMER } from '../lib/anomalyExplanation.js'

// A calm amber pill. The one-line summary keeps the header slim; the full
// disclaimer text stays reachable by expanding the disclosure (or via the
// native tooltip on the summary).
export default function Disclaimer() {
  return (
    <details className="disclaimer">
      <summary title={SCREENING_DISCLAIMER}>Statistical flags — not findings</summary>
      <p>{SCREENING_DISCLAIMER}</p>
    </details>
  )
}
