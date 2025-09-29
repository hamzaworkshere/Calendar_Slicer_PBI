# Calendar Slicer (Power BI Custom Visual)

A calendar slicer that strictly uses **only the dates present in your bound Date column** (no synthetic dates), does **not omit Fridays or Saturdays**, and **hides day-of-week names in the grid header by default**. It applies a Basic `In` filter via `applyJsonFilter` on the bound column. Supports single/multi/range selection, optional week numbers, configurable start-of-week, and accessible keyboard navigation.

## Features
- Day / Month / Year navigation
- Single, multi (Ctrl/Cmd), and range (Shift) selection
- **Data-driven**: only dates available in your source column are selectable
- No weekday omissions (Fri/Sat included if present in data)
- Optional week numbers, start-of-week (Sunday/Monday)
- **Hide day-of-week names** by default (toggle in Format Pane)
- Header options: title, colors, show/hide, clear button
- Item formatting: font size, optional colors and bold for selected

## Prerequisites
- **Node.js 18+**
- **Power BI Visual Tools (`pbiviz`) 6.1.3** installed globally:
  ```bash
  npm i -g powerbi-visuals-tools@6.1.3
  ```

## Quick start (GitHub Codespaces or any Node environment)
```bash
# 1) One-time: dev cert for pbiviz start (optional)
pbiviz --install-cert

# 2) Install dependencies
npm ci

# 3) Run in dev (optional)
npm run start

# 4) Package the visual (produces dist/*.pbiviz)
npm run package
```

## Using in Power BI Desktop
1. Import the packaged file: **Insert → More visuals → Import a visual from a file** → select the `.pbiviz` from `dist/`.
2. Add the visual to a report and **bind your Date table’s `[Date]` column** to the **Date** field well.
3. Configure options in the **Format Pane** (Calendar, Header & Colors, Items, Selection, Date range).

## Format Pane (objects)
- **Calendar**: `Start of week`, `Show week numbers`, `Show day-of-week header`, `Fade other-month days`
- **Header & Colors**: `Show header`, `Title`, `Accent color`, `Text color`, `Header background`, `Font size`, `Show clear button`
- **Items**: `Font size`, `Text color`, `Selected color`, `Bold selected`
- **Selection**: `Enable multi-select`, `Shift+Click range select`, `Sticky selection`
- **Date range**: `Restrict to data dates`, `Min date (YYYY-MM-DD)`, `Max date (YYYY-MM-DD)`

## Notes
- The calendar grid displays full months; only days present in your data are **enabled**.
- Range selection picks **only** dates that exist in your data between the two endpoints.
- All date keys are computed at **UTC midnight** to avoid local-time drift.

## License
MIT