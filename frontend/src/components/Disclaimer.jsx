import { SCREENING_DISCLAIMER } from '../lib/anomalyExplanation.js'

export default function Disclaimer() {
  return (
    <div className="disclaimer" role="note" aria-label="Disclaimer">
      <strong>Note:</strong> {SCREENING_DISCLAIMER}
    </div>
  )
}