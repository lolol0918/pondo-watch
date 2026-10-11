export default function MapCoverageNote({ summary }) {
  if (!summary?.map) {
    return null
  }
  const { attribution, coverage_note: coverageNote } = summary.map
  // Selectable gaps the user will hit while using the app: labels without a
  // polygon. Derived from the summary so it cannot drift from the data.
  const gaps = (summary.regions ?? []).filter((row) => !row.on_map)
  return (
    <div className="map-coverage">
      <p>
        <strong>Map coverage:</strong> {coverageNote}
      </p>
      {gaps.length > 0 ? (
        <ul className="map-coverage-list">
          {gaps.map((row) => (
            <li key={row.region}>
              <strong>{row.region}</strong>: {row.note ?? 'not drawn on map'} Its
              projects are still reachable from the region selector below.
            </li>
          ))}
        </ul>
      ) : null}
      <p className="map-attribution">{attribution}</p>
    </div>
  )
}