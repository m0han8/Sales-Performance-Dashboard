# Sales Performance & Profitability Dashboard

A responsive, interactive sales analytics dashboard built with plain **HTML, CSS and JavaScript**
(no build step, no framework) using **Chart.js** for visualization. Created as a data analyst
portfolio project — it looks and behaves like a lightweight Power BI / Tableau report, but runs
entirely in the browser and deploys for free on GitHub Pages.

> Live at: `https://<your-username>.github.io/Sales-Performance-Dashboard/` after enabling Pages (see below).

## Overview

The dashboard analyzes ~1,600 sales transactions (FY2024–2025) across 4 US regions, 3 product
categories, and 8 sales reps. Every KPI, chart, table row, and insight on the page is computed
**live in the browser from `sales_data.csv`** — there is no hardcoded or dummy data anywhere in
the app; change the CSV and the whole dashboard updates.

## Features

- **4 animated KPI cards** — Total Sales, Total Profit, Total Orders, Average Order Value (count-up animation on load/filter)
- **5 interactive charts** (Chart.js) — Monthly Sales Trend (line), Sales by Category (bar),
  Sales by Region (pie), Top 10 Products (horizontal bar), Profit vs Sales (scatter)
- **Live filters** — Year, Region, Category — everything on the page (KPIs, charts, table,
  insights) reacts instantly to filter changes, with active filters shown as chips
- **Searchable, sortable, paginated transaction table** — search across product/rep/customer/city,
  click any column header to sort
- **Export filtered data to CSV** — downloads exactly what's currently filtered/searched
- **Download any chart as PNG** — one click per chart card
- **SQL Insights page** — explains the business question behind each query in `sql_analysis.sql`,
  with the query itself revealed on demand
- **Business Insights page** — best region, top category, top products, monthly trend, margin
  analysis and recommendations, all computed live from the filtered dataset
- **Loading animation**, smooth transitions, and a fully **responsive** layout (collapsible sidebar on mobile)

## Tech Stack

| Layer | Choice |
|---|---|
| Markup / Styling | Semantic HTML5, hand-written CSS (custom properties, CSS Grid/Flexbox, no framework) |
| Interactivity | Vanilla JavaScript (ES6+, no build tooling) |
| Charts | [Chart.js 4](https://www.chartjs.org/) (via CDN) |
| CSV parsing | [PapaParse](https://www.papaparse.com/) (via CDN) |
| Fonts | Manrope (display) + Inter (body), Google Fonts |
| Hosting | Static — works on GitHub Pages, Netlify, Vercel, or any static host |

## Dataset

`sales_data.csv` — 1,600 rows, 18 columns:

`Order ID, Order Date, Region, City, Segment, Ship Mode, Category, Sub-Category, Product Name,
Sales Rep, Customer Name, Quantity, Unit Price, Discount, Sales, Cost, Profit, Profit Margin`

Covers 4 regions (East/West/Central/South), 3 categories / 13 sub-categories / 25 products,
3 customer segments, and 8 sales reps, from Jan 2024 to Dec 2025, with realistic seasonality
(a Nov–Dec demand spike) and category-specific margins baked in.

## SQL Analysis

`sql_analysis.sql` contains the schema plus 10 analysis queries mirroring the dashboard's logic
in SQL — KPI summary, region/category/segment breakdowns, month-over-month growth (`LAG`), top
products and reps (`RANK`), a top-city-per-region query (`ROW_NUMBER` + `PARTITION BY`), and a
discount-vs-margin analysis. The **SQL Insights** tab in the app explains what business question
each query answers and lets you expand each card to read the query.

## Dashboard Screenshots

> Replace these placeholders with real screenshots after you deploy — see `/images`.

```
images/dashboard-overview.png     <- KPI cards + charts view
images/sql-insights.png           <- SQL Insights tab
images/business-insights.png      <- Business Insights tab
images/mobile-view.png            <- Responsive mobile layout
```

## Project Structure

```
Sales-Performance-Dashboard/
│── index.html          Page structure — Dashboard / SQL Insights / Business Insights views
│── style.css            All styling (design tokens, layout, responsive rules)
│── script.js             App logic — CSV parsing, filters, charts, table, insights, exports
│── sales_data.csv        Source dataset (drives every number on the page)
│── sql_analysis.sql      SQL schema + 10 analysis queries
│── README.md
│── assets/                Reserved for icons/misc assets
│── images/                 Screenshots for this README
```

## Installation / Run Locally

Because the page fetches `sales_data.csv` with `fetch()`, it needs to be served over HTTP (not
opened directly as a `file://` URL, which browsers block from reading local files). Any of these
work:

```bash
# Option 1 — Python (built into most systems)
cd Sales-Performance-Dashboard
python3 -m http.server 8000
# then open http://localhost:8000

# Option 2 — Node
npx serve .

# Option 3 — VS Code
# Right-click index.html → "Open with Live Server"
```

## Deploy to GitHub Pages

1. Create a new GitHub repo and push this folder's contents to the root of the `main` branch:
   ```bash
   git init
   git add .
   git commit -m "Sales Performance & Profitability Dashboard"
   git branch -M main
   git remote add origin https://github.com/<your-username>/Sales-Performance-Dashboard.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Source → Deploy from a branch → `main` / `/(root)` → Save**.
3. Wait a minute, then visit `https://<your-username>.github.io/Sales-Performance-Dashboard/`.

No build step is required — GitHub Pages serves the static files (and CSV) directly, which is
exactly what `fetch()` needs.

## Notes

- Charts, KPIs, the table, and both insights pages are all driven by `sales_data.csv` at runtime —
  nothing is precomputed or hardcoded, so the project can be re-pointed at a different dataset
  with the same column names with no code changes.
- Generative AI (Claude) was used to help scaffold the front-end code and dashboard layout; all
  logic and figures were reviewed and verified against the source data before publishing.
