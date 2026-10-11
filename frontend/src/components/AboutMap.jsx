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
