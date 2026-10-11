export default function AboutMap({ summary }) {
  if (!summary?.map) {
    return null
  }
  const { attribution, coverage_note: coverageNote } = summary.map
  // Selectable gaps the user will hit while using the app: labels without a
  // polygon. Derived from the summary so it cannot drift from the data.
  const gaps = (summary.regions ?? []).filter((row) => !row.on_map)

  return (
    <details className="map-about">
      <summary>About this map</summary>
      <div className="map-about-body">
        <p>{coverageNote}</p>
        <p className="map-about-legend-title">What the map shows</p>
        <ul className="map-about-list">
          <li>
            <strong>Region fill</strong>: a muted single-hue tint for the flagged
            share of analysed projects (darker = higher share).
          </li>
          <li>
            <strong>Dot colour</strong>: recorded budget vs the peer-group median —
            under 10× light blue, 10–30× amber, 30× and up indigo (a
            colourblind-safe scale).
          </li>
          <li>
            <strong>Dot size</strong> also grows with the ratio (3–9 px), so
            colour is never the only signal.
          </li>
          <li>Click a region to filter; click a dot to open its evidence.</li>
        </ul>
        {gaps.length > 0 ? (
          <ul className="map-about-list">
            {gaps.map((row) => (
              <li key={row.region}>
                <strong>{row.region}</strong>: {row.note ?? 'not drawn on map'}.
                Its projects are still reachable through the region selector.
              </li>
            ))}
          </ul>
        ) : null}
        <p className="map-attribution">{attribution}</p>
      </div>
    </details>
  )
}
