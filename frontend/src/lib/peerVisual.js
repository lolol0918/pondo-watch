// Model for the "peer budgets on a log scale" comparison visual.
//
// The exported anomaly records carry the peer-group *summary* (median, MAD,
// robust fence, group size) but not each peer member's budget. To stay honest,
// the visual shows the group statistics we actually have: where typical peer
// budgets cluster (median ± 1.5×MAD), the median itself, the robust fence
// (the flag threshold), and this project's budget — all on a log10 axis.

export const MAD_FLOOR = 0.01
export const MAD_SIGMAS = 3.0
export const MAD_SCALE = 1.4826
const BAND_WIDTH = 1.5 // ±1.5×MAD around the median

/**
 * The MAD the pipeline actually scores with: the exported MAD floored at the
 * same constant the detector uses, so the visual can never disagree with the
 * numbers shown elsewhere.
 */
export function effectiveMad(record) {
  const mad = record?.mad_log
  if (!Number.isFinite(mad)) {
    return MAD_FLOOR
  }
  return Math.max(mad, MAD_FLOOR)
}

/**
 * Everything the SVG needs, or null when the record cannot be drawn (missing
 * or non-positive budget/median). Positions are fractional percentages of the
 * chart width so the renderer stays resolution-independent.
 */
export function peerVisualModel(record) {
  const budget = record?.budget
  const median = record?.median_budget
  if (!Number.isFinite(budget) || !Number.isFinite(median)) {
    return null
  }
  if (budget <= 0 || median <= 0) {
    return null
  }

  const mad = effectiveMad(record)
  const logBudget = Math.log10(budget)
  const logMedian = Math.log10(median)
  const fenceBudget = record?.fence_budget
  const logFence =
    Number.isFinite(fenceBudget) && fenceBudget > 0
      ? Math.log10(fenceBudget)
      : logMedian + MAD_SIGMAS * MAD_SCALE * mad

  const bandLow = logMedian - BAND_WIDTH * mad
  const bandHigh = logMedian + BAND_WIDTH * mad
  const dMin = Math.min(bandLow, logBudget) - 0.4
  const dMax = Math.max(bandHigh, logFence, logBudget) + 0.4

  const span = dMax - dMin
  return {
    budget,
    median,
    mad,
    logBudget,
    logMedian,
    logFence,
    bandLow,
    bandHigh,
    dMin,
    dMax,
    ticks: logTicks(dMin, dMax),
    // Position of a log10 value as a percentage of the chart width.
    x(logV) {
      return ((logV - dMin) / span) * 100
    },
  }
}

/** Integer exponents (powers of ten) that fit inside the plotted domain. */
function logTicks(dMin, dMax) {
  const ticks = []
  const start = Math.floor(dMin)
  const end = Math.ceil(dMax)
  for (let e = start; e <= end; e += 1) {
    ticks.push(e)
  }
  return ticks
}