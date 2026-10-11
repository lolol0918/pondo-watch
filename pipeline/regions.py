"""Region metadata and the region-level summary used by the dashboard.

The dashboard needs three things the raw exports do not provide cheaply:

* a correct mapping from the dataset's region *labels* to the PSGC region
  *codes* used by the map, so a region can be drawn and coloured;
* an explicit statement of which labels are geographic at all; and
* small per-region counts, so the browser never has to read the 130 MiB
  ``projects.json`` just to show summary cards or colour the map.

Everything here is data derived from the pipeline. Nothing is scraped and no
count is hardcoded; :func:`build_region_summary` counts whatever the frames
contain. The mapping is an explicit dictionary because region labels in the
source data are inconsistent with the map ("Region IV-B" vs "MIMAROPA
Region", a missing Negros Island Region, a non-geographic "Central Office")
and substring matching would silently mis-assign those.

Region codes are PSGC region codes. They are matched against the ``adm1_psgc``
property of the 2023 Faeldon boundary file. The map snapshot reflects PSGC as
of 2023-12-31: it has 17 regions and therefore covers neither the current
Negros Island Region nor the dataset's non-geographic "Central Office".
"""

# Dataset region label -> metadata. ``psgc`` is the integer code used by the
# map, or None when the label has no polygon. ``map_name`` is the label the
# map file uses, shown as a secondary identifier in the UI.
#
# ``Central Office`` is an administrative bucket, not an area, so it is never
# drawn. ``Negros Island Region`` is a real region but is absent from the 2023
# snapshot, so it is selectable but not drawable and carries ``on_map=False``.
# ``psgc`` for Negros Island Region is deliberately left None: the code has
# not been verified against a current PSA release, and guessing would be worse
# than omitting it.
REGION_METADATA = {
    "Region I": {
        "psgc": 100000000,
        "map_name": "Region I (Ilocos Region)",
        "is_geographic": True,
        "on_map": True,
        "note": None,
    },
    "Region II": {
        "psgc": 200000000,
        "map_name": "Region II (Cagayan Valley)",
        "is_geographic": True,
        "on_map": True,
        "note": None,
    },
    "Region III": {
        "psgc": 300000000,
        "map_name": "Region III (Central Luzon)",
        "is_geographic": True,
        "on_map": True,
        "note": None,
    },
    "Region IV-A": {
        "psgc": 400000000,
        "map_name": "Region IV-A (CALABARZON)",
        "is_geographic": True,
        "on_map": True,
        "note": None,
    },
    "Region IV-B": {
        "psgc": 1700000000,
        "map_name": "MIMAROPA Region",
        "is_geographic": True,
        "on_map": True,
        "note": "The map file labels this area 'MIMAROPA Region'.",
    },
    "Region V": {
        "psgc": 500000000,
        "map_name": "Region V (Bicol Region)",
        "is_geographic": True,
        "on_map": True,
        "note": None,
    },
    "Region VI": {
        "psgc": 600000000,
        "map_name": "Region VI (Western Visayas)",
        "is_geographic": True,
        "on_map": True,
        "note": None,
    },
    "Region VII": {
        "psgc": 700000000,
        "map_name": "Region VII (Central Visayas)",
        "is_geographic": True,
        "on_map": True,
        "note": None,
    },
    "Region VIII": {
        "psgc": 800000000,
        "map_name": "Region VIII (Eastern Visayas)",
        "is_geographic": True,
        "on_map": True,
        "note": None,
    },
    "Region IX": {
        "psgc": 900000000,
        "map_name": "Region IX (Zamboanga Peninsula)",
        "is_geographic": True,
        "on_map": True,
        "note": None,
    },
    "Region X": {
        "psgc": 1000000000,
        "map_name": "Region X (Northern Mindanao)",
        "is_geographic": True,
        "on_map": True,
        "note": None,
    },
    "Region XI": {
        "psgc": 1100000000,
        "map_name": "Region XI (Davao Region)",
        "is_geographic": True,
        "on_map": True,
        "note": None,
    },
    "Region XII": {
        "psgc": 1200000000,
        "map_name": "Region XII (SOCCSKSARGEN)",
        "is_geographic": True,
        "on_map": True,
        "note": None,
    },
    "Region XIII": {
        "psgc": 1600000000,
        "map_name": "Region XIII (Caraga)",
        "is_geographic": True,
        "on_map": True,
        "note": None,
    },
    "National Capital Region": {
        "psgc": 1300000000,
        "map_name": "National Capital Region (NCR)",
        "is_geographic": True,
        "on_map": True,
        "note": None,
    },
    "Cordillera Administrative Region": {
        "psgc": 1400000000,
        "map_name": "Cordillera Administrative Region (CAR)",
        "is_geographic": True,
        "on_map": True,
        "note": None,
    },
    "Negros Island Region": {
        "psgc": None,
        "map_name": None,
        "is_geographic": True,
        "on_map": False,
        "note": (
            "Real region, but not present in the 2023 map snapshot "
            "(which predates its re-establishment)."
        ),
    },
    "Central Office": {
        "psgc": None,
        "map_name": None,
        "is_geographic": False,
        "on_map": False,
        "note": "Not a geographic region; not drawn on the map.",
    },
}

# Display order: the dataset's own ordering, with non-geographic and
# map-missing regions kept at the end so the geographic list reads naturally.
REGION_ORDER = list(REGION_METADATA.keys())

# Provenance text for the map layer, surfaced in the UI so attribution travels
# with the data instead of living only in the repository.
MAP_ATTRIBUTION = (
    "Region boundaries: faeldon/philippines-json-maps, 2023 low-resolution "
    "GeoJSON (PSGC as of 2023-12-31, MIT)."
)

MAP_COVERAGE_NOTE = (
    "The boundary file has 17 regions and reflects PSGC as of 2023-12-31. "
    "Negros Island Region is not drawn, and Central Office is not an area."
)


def _blank_stats():
    return {"projects": 0, "flagged": 0, "eligible": 0}


def build_region_summary(project_records, anomaly_records):
    """Build the compact per-region summary the dashboard loads first.

    ``project_records`` and ``anomaly_records`` are the already-serialized
    records (as written to JSON). Counts are derived here so the browser never
    reads the full project export. Every known region is emitted even when it
    has no rows, so the UI list and map are stable across data refreshes.
    Unexpected labels found in the data are appended rather than dropped.
    """
    stats = {label: _blank_stats() for label in REGION_ORDER}

    for record in project_records:
        label = record.get("region")
        if label is None:
            continue
        bucket = stats.setdefault(label, _blank_stats())
        bucket["projects"] += 1
        if record.get("eligible_for_cost_analysis"):
            bucket["eligible"] += 1

    for record in anomaly_records:
        label = record.get("region")
        if label is None:
            continue
        bucket = stats.setdefault(label, _blank_stats())
        bucket["flagged"] += 1

    ordered_labels = list(REGION_ORDER)
    ordered_labels += [label for label in stats if label not in REGION_METADATA]

    regions = []
    for label in ordered_labels:
        counts = stats[label]
        meta = REGION_METADATA.get(
            label,
            {
                "psgc": None,
                "map_name": None,
                "is_geographic": True,
                "on_map": False,
                "note": "Region label not in the known metadata list.",
            },
        )
        projects = counts["projects"]
        flagged = counts["flagged"]
        regions.append(
            {
                "region": label,
                "psgc": meta["psgc"],
                "map_name": meta["map_name"],
                "is_geographic": meta["is_geographic"],
                "on_map": meta["on_map"],
                "note": meta["note"],
                "projects": projects,
                "eligible": counts["eligible"],
                "flagged": flagged,
                "flagged_percentage": (
                    round(100.0 * flagged / projects, 2) if projects else 0.0
                ),
            }
        )

    total_projects = len(project_records)
    total_flagged = len(anomaly_records)
    total_eligible = sum(bucket["eligible"] for bucket in stats.values())

    return {
        "totals": {
            "projects": total_projects,
            "flagged": total_flagged,
            "eligible": total_eligible,
            "flagged_percentage": (
                round(100.0 * total_flagged / total_projects, 2)
                if total_projects
                else 0.0
            ),
        },
        "regions": regions,
        "map": {
            "attribution": MAP_ATTRIBUTION,
            "coverage_note": MAP_COVERAGE_NOTE,
        },
    }
