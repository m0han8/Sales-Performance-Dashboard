/* ==========================================================================
   Sales Performance & Profitability Dashboard — Application Logic
   All KPIs, charts, table rows and insights are computed live from
   sales_data.csv. Nothing here is hardcoded sample data.
   ========================================================================== */

(() => {
  "use strict";

  /* ---------------------------------------------------------------------
   * State
   * ------------------------------------------------------------------- */
  const state = {
    raw: [],            // full parsed dataset
    filtered: [],        // dataset after year/region/category filters
    filters: { year: "all", region: "all", category: "all" },
    sort: { key: "date", dir: "desc" },
    search: "",
    page: 1,
    pageSize: 25,
  };

  const charts = {};    // Chart.js instances keyed by canvas id
  const fmtUSD = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const fmtUSD2 = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPct = (n) => (n * 100).toFixed(1) + "%";
  const fmtNum = (n) => n.toLocaleString("en-US");

  const COLORS = {
    primary: "#1D4ED8",
    accent: "#3B82F6",
    light: "#93C5FD",
    success: "#16A34A",
    palette: ["#1D4ED8", "#3B82F6", "#7C9DF0", "#16A34A", "#C2760C", "#7C3AED", "#DC2626", "#0EA5E9"],
  };

  /* ---------------------------------------------------------------------
   * Boot
   * ------------------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    Papa.parse("sales_data.csv", {
      download: true,
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: (results) => {
        state.raw = results.data.map(normalizeRow).filter((r) => r.orderId);
        state.filtered = state.raw.slice();
        buildFilterOptions();
        bindEvents();
        applyFilters();       // renders everything for the first time
        renderSqlInsights();
        showApp();
      },
      error: (err) => {
        console.error("Failed to load sales_data.csv", err);
        document.querySelector(".loader p").textContent =
          "Could not load sales_data.csv. Make sure you're running this from the project folder (a local server, not file://, works best).";
      },
    });
  }

  function showApp() {
    const loader = document.getElementById("loader");
    const app = document.getElementById("app");
    loader.style.transition = "opacity .3s ease";
    loader.style.opacity = "0";
    setTimeout(() => {
      loader.hidden = true;
      app.hidden = false;
    }, 300);
  }

  function normalizeRow(r) {
    const sales = parseFloat(r["Sales"]) || 0;
    const cost = parseFloat(r["Cost"]) || 0;
    const profit = parseFloat(r["Profit"]) || (sales - cost);
    const margin = sales ? profit / sales : 0;
    const date = new Date(r["Order Date"]);
    return {
      orderId: r["Order ID"],
      date,
      dateStr: r["Order Date"],
      year: date.getFullYear(),
      month: date.getMonth(), // 0-11
      monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      region: r["Region"],
      city: r["City"],
      segment: r["Segment"],
      shipMode: r["Ship Mode"],
      category: r["Category"],
      subCategory: r["Sub-Category"],
      product: r["Product Name"],
      rep: r["Sales Rep"],
      customer: r["Customer Name"],
      qty: parseFloat(r["Quantity"]) || 0,
      unitPrice: parseFloat(r["Unit Price"]) || 0,
      discount: parseFloat(r["Discount"]) || 0,
      sales,
      cost,
      profit,
      margin,
    };
  }

  /* ---------------------------------------------------------------------
   * Filters
   * ------------------------------------------------------------------- */
  function buildFilterOptions() {
    const years = uniqueSorted(state.raw.map((r) => r.year));
    const regions = uniqueSorted(state.raw.map((r) => r.region));
    const categories = uniqueSorted(state.raw.map((r) => r.category));

    fillSelect("yearFilter", years);
    fillSelect("regionFilter", regions);
    fillSelect("categoryFilter", categories);
  }

  function uniqueSorted(arr) {
    return Array.from(new Set(arr)).sort();
  }

  function fillSelect(id, values) {
    const el = document.getElementById(id);
    values.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      el.appendChild(opt);
    });
  }

  function applyFilters() {
    const { year, region, category } = state.filters;
    state.filtered = state.raw.filter((r) => {
      if (year !== "all" && String(r.year) !== String(year)) return false;
      if (region !== "all" && r.region !== region) return false;
      if (category !== "all" && r.category !== category) return false;
      return true;
    });
    state.page = 1;
    renderFilterChips();
    renderKpis();
    renderCharts();
    renderTable();
    renderInsights();
  }

  function renderFilterChips() {
    const chips = [];
    if (state.filters.year !== "all") chips.push(`Year: ${state.filters.year}`);
    if (state.filters.region !== "all") chips.push(`Region: ${state.filters.region}`);
    if (state.filters.category !== "all") chips.push(`Category: ${state.filters.category}`);
    const el = document.getElementById("filterChips");
    el.innerHTML = chips.map((c) => `<span class="chip">${c}</span>`).join("");
  }

  /* ---------------------------------------------------------------------
   * KPI cards (with animated count-up)
   * ------------------------------------------------------------------- */
  function renderKpis() {
    const data = state.filtered;
    const totalSales = sum(data, (r) => r.sales);
    const totalProfit = sum(data, (r) => r.profit);
    const totalOrders = data.length;
    const aov = totalOrders ? totalSales / totalOrders : 0;
    const margin = totalSales ? totalProfit / totalSales : 0;

    animateCounter("kpiSales", totalSales, fmtUSD);
    animateCounter("kpiProfit", totalProfit, fmtUSD);
    animateCounter("kpiOrders", totalOrders, fmtNum);
    animateCounter("kpiAov", aov, fmtUSD2);

    document.getElementById("kpiSalesSub").textContent = `across ${totalOrders.toLocaleString()} orders`;
    document.getElementById("kpiProfitSub").textContent = `${fmtPct(margin)} margin`;
    document.getElementById("kpiOrdersSub").textContent = `${uniqueSorted(data.map((r) => r.product)).length} unique products`;
    document.getElementById("kpiAovSub").textContent = `per transaction`;
  }

  function animateCounter(id, target, formatter) {
    const el = document.getElementById(id);
    const start = 0;
    const duration = 700;
    const startTime = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = start + (target - start) * eased;
      el.textContent = formatter(val);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = formatter(target);
    }
    requestAnimationFrame(tick);
  }

  function sum(arr, fn) { return arr.reduce((a, r) => a + fn(r), 0); }

  function groupSum(arr, keyFn, valFn) {
    const map = new Map();
    arr.forEach((r) => {
      const k = keyFn(r);
      map.set(k, (map.get(k) || 0) + valFn(r));
    });
    return map;
  }

  /* ---------------------------------------------------------------------
   * Charts
   * ------------------------------------------------------------------- */
  function renderCharts() {
    renderTrendChart();
    renderCategoryChart();
    renderRegionChart();
    renderTopProductsChart();
    renderScatterChart();
  }

  function upsertChart(id, config) {
    if (charts[id]) {
      charts[id].data = config.data;
      charts[id].options = config.options;
      charts[id].config.type = config.type;
      charts[id].update();
    } else {
      const ctx = document.getElementById(id).getContext("2d");
      charts[id] = new Chart(ctx, config);
    }
  }

  const baseFont = { family: "Inter, sans-serif", size: 11 };

  function renderTrendChart() {
    const map = groupSum(state.filtered, (r) => r.monthKey, (r) => r.sales);
    const profitMap = groupSum(state.filtered, (r) => r.monthKey, (r) => r.profit);
    const months = Array.from(map.keys()).sort();
    const labels = months.map((m) => {
      const [y, mo] = m.split("-");
      return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    });

    upsertChart("trendChart", {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Sales",
            data: months.map((m) => map.get(m)),
            borderColor: COLORS.primary,
            backgroundColor: "rgba(29,78,216,.08)",
            fill: true, tension: .35, pointRadius: 2, pointHoverRadius: 5, borderWidth: 2.5,
          },
          {
            label: "Profit",
            data: months.map((m) => profitMap.get(m) || 0),
            borderColor: COLORS.success,
            backgroundColor: "rgba(22,163,74,.06)",
            fill: true, tension: .35, pointRadius: 2, pointHoverRadius: 5, borderWidth: 2.5,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top", align: "end", labels: { font: baseFont, boxWidth: 10, usePointStyle: true } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmtUSD(ctx.parsed.y)}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: baseFont } },
          y: { grid: { color: "#EEF1F7" }, ticks: { font: baseFont, callback: (v) => "$" + v / 1000 + "k" } },
        },
      },
    });
  }

  function renderCategoryChart() {
    const map = groupSum(state.filtered, (r) => r.category, (r) => r.sales);
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    upsertChart("categoryChart", {
      type: "bar",
      data: {
        labels: entries.map((e) => e[0]),
        datasets: [{
          data: entries.map((e) => e[1]),
          backgroundColor: COLORS.palette,
          borderRadius: 8, maxBarThickness: 56,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${fmtUSD(ctx.parsed.y)}` } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: baseFont } },
          y: { grid: { color: "#EEF1F7" }, ticks: { font: baseFont, callback: (v) => "$" + v / 1000 + "k" } },
        },
      },
    });
  }

  function renderRegionChart() {
    const map = groupSum(state.filtered, (r) => r.region, (r) => r.sales);
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    upsertChart("regionChart", {
      type: "pie",
      data: {
        labels: entries.map((e) => e[0]),
        datasets: [{ data: entries.map((e) => e[1]), backgroundColor: COLORS.palette, borderColor: "#fff", borderWidth: 2 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { font: baseFont, boxWidth: 10, usePointStyle: true, padding: 14 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const tot = ctx.dataset.data.reduce((a, b) => a + b, 0);
                return ` ${ctx.label}: ${fmtUSD(ctx.parsed)} (${((ctx.parsed / tot) * 100).toFixed(1)}%)`;
              },
            },
          },
        },
      },
    });
  }

  function renderTopProductsChart() {
    const map = groupSum(state.filtered, (r) => r.product, (r) => r.sales);
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).reverse();
    upsertChart("topProductsChart", {
      type: "bar",
      data: {
        labels: entries.map((e) => e[0]),
        datasets: [{ data: entries.map((e) => e[1]), backgroundColor: COLORS.accent, borderRadius: 6, maxBarThickness: 18 }],
      },
      options: {
        indexAxis: "y",
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${fmtUSD(ctx.parsed.x)}` } } },
        scales: {
          x: { grid: { color: "#EEF1F7" }, ticks: { font: baseFont, callback: (v) => "$" + v / 1000 + "k" } },
          y: { grid: { display: false }, ticks: { font: { family: "Inter, sans-serif", size: 10.5 } } },
        },
      },
    });
  }

  function renderScatterChart() {
    const points = state.filtered.map((r) => ({ x: r.sales, y: r.profit }));
    upsertChart("scatterChart", {
      type: "scatter",
      data: {
        datasets: [{
          label: "Orders",
          data: points,
          backgroundColor: "rgba(29,78,216,.45)",
          pointRadius: 3, pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` Sales ${fmtUSD(ctx.parsed.x)} · Profit ${fmtUSD(ctx.parsed.y)}` } },
        },
        scales: {
          x: { title: { display: true, text: "Sales ($)", font: baseFont }, grid: { color: "#EEF1F7" }, ticks: { font: baseFont, callback: (v) => "$" + v } },
          y: { title: { display: true, text: "Profit ($)", font: baseFont }, grid: { color: "#EEF1F7" }, ticks: { font: baseFont, callback: (v) => "$" + v } },
        },
      },
    });
  }

  /* ---------------------------------------------------------------------
   * Table: search, sort, paginate
   * ------------------------------------------------------------------- */
  function getTableRows() {
    let rows = state.filtered;
    if (state.search) {
      const q = state.search.toLowerCase();
      rows = rows.filter((r) =>
        [r.product, r.rep, r.customer, r.city, r.region, r.category, r.orderId]
          .some((f) => String(f).toLowerCase().includes(q))
      );
    }
    const { key, dir } = state.sort;
    const mult = dir === "asc" ? 1 : -1;
    rows = rows.slice().sort((a, b) => {
      let av = a[mapSortKey(key)], bv = b[mapSortKey(key)];
      if (av instanceof Date) { av = av.getTime(); bv = bv.getTime(); }
      if (typeof av === "string") return av.localeCompare(bv) * mult;
      return (av - bv) * mult;
    });
    return rows;
  }

  function mapSortKey(key) {
    return { orderId: "orderId", date: "date", region: "region", category: "category",
      product: "product", rep: "rep", sales: "sales", profit: "profit", margin: "margin" }[key] || "date";
  }

  function renderTable() {
    const rows = getTableRows();
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * state.pageSize;
    const pageRows = rows.slice(start, start + state.pageSize);

    const body = document.getElementById("tableBody");
    body.innerHTML = pageRows.map((r) => `
      <tr>
        <td>${r.orderId}</td>
        <td>${r.dateStr}</td>
        <td>${r.region}</td>
        <td>${r.category}</td>
        <td>${r.product}</td>
        <td>${r.rep}</td>
        <td class="num">${fmtUSD2(r.sales)}</td>
        <td class="num ${r.profit >= 0 ? "profit-pos" : "profit-neg"}">${fmtUSD2(r.profit)}</td>
        <td class="num">${fmtPct(r.margin)}</td>
      </tr>`).join("");

    document.getElementById("tableCount").textContent = `${total.toLocaleString()} transactions`;
    document.getElementById("pageInfo").textContent = `Page ${state.page} of ${pages}`;
    document.getElementById("prevPage").disabled = state.page <= 1;
    document.getElementById("nextPage").disabled = state.page >= pages;

    document.querySelectorAll("#salesTable thead th").forEach((th) => {
      th.removeAttribute("data-sort");
      if (th.dataset.key === state.sort.key) th.setAttribute("data-sort", state.sort.dir);
    });
  }

  /* ---------------------------------------------------------------------
   * SQL Insights (static explanations of sql_analysis.sql, queries inlined
   * so the page works standalone without fetching the .sql file)
   * ------------------------------------------------------------------- */
  const SQL_QUERIES = [
    { title: "KPI Summary", q: "Overall total sales, profit, margin %, order count and average order value.",
      sql: `SELECT ROUND(SUM(sales),2) AS total_sales, ROUND(SUM(profit),2) AS total_profit,
    ROUND(SUM(profit)/SUM(sales)*100,2) AS profit_margin_pct,
    COUNT(*) AS total_orders, ROUND(SUM(sales)/COUNT(*),2) AS avg_order_value
FROM sales;` },
    { title: "Revenue & Profit by Region", q: "Which regions generate the most revenue, and do they convert it into profit at the same rate?",
      sql: `SELECT region, ROUND(SUM(sales),2) AS total_sales, ROUND(SUM(profit),2) AS total_profit,
    ROUND(SUM(profit)/SUM(sales)*100,2) AS profit_margin_pct, COUNT(*) AS orders
FROM sales GROUP BY region ORDER BY total_sales DESC;` },
    { title: "Month-over-Month Trend", q: "How is revenue trending month to month, and what's the growth rate? Uses LAG() to compare each month to the previous one.",
      sql: `SELECT DATE_FORMAT(order_date,'%Y-%m') AS order_month, ROUND(SUM(sales),2) AS monthly_sales,
    ROUND((SUM(sales)-LAG(SUM(sales)) OVER (ORDER BY DATE_FORMAT(order_date,'%Y-%m')))
      / LAG(SUM(sales)) OVER (ORDER BY DATE_FORMAT(order_date,'%Y-%m')) * 100, 2) AS mom_growth_pct
FROM sales GROUP BY order_month ORDER BY order_month;` },
    { title: "Top 10 Products by Profit", q: "Which products contribute the most profit, ranked with RANK() (ties share a rank)?",
      sql: `SELECT product_name, ROUND(SUM(sales),2) AS total_sales, ROUND(SUM(profit),2) AS total_profit,
    RANK() OVER (ORDER BY SUM(profit) DESC) AS profit_rank
FROM sales GROUP BY product_name ORDER BY total_profit DESC LIMIT 10;` },
    { title: "Low-Margin Products", q: "Which products carry a profit margin below 15% and should be reviewed for pricing or cost?",
      sql: `SELECT product_name, category, ROUND(SUM(sales),2) AS total_sales,
    ROUND(SUM(profit)/SUM(sales)*100,2) AS profit_margin_pct
FROM sales GROUP BY product_name, category
HAVING SUM(profit)/SUM(sales) < 0.15 ORDER BY total_sales DESC;` },
    { title: "Sales Rep Leaderboard", q: "How do reps rank by revenue, and what's the cumulative running total across the team?",
      sql: `SELECT sales_rep, ROUND(SUM(sales),2) AS total_sales, ROUND(SUM(profit),2) AS total_profit,
    COUNT(*) AS orders,
    ROUND(SUM(SUM(sales)) OVER (ORDER BY SUM(sales) DESC), 2) AS running_total_sales
FROM sales GROUP BY sales_rep ORDER BY total_sales DESC;` },
    { title: "Segment Profitability", q: "Which customer segment (Consumer / Corporate / Home Office) is the most profitable per order?",
      sql: `SELECT segment, ROUND(SUM(sales),2) AS total_sales, ROUND(SUM(profit),2) AS total_profit,
    ROUND(SUM(profit)/SUM(sales)*100,2) AS profit_margin_pct,
    ROUND(SUM(sales)/COUNT(*),2) AS avg_order_value
FROM sales GROUP BY segment ORDER BY total_profit DESC;` },
    { title: "Discount Impact on Margin", q: "Does discounting actually cost us margin? Buckets orders into discount bands and compares margin per band.",
      sql: `SELECT CASE WHEN discount=0 THEN 'No Discount' WHEN discount<=0.10 THEN 'Low (1-10%)'
      WHEN discount<=0.20 THEN 'Medium (11-20%)' ELSE 'High (>20%)' END AS discount_band,
    COUNT(*) AS orders, ROUND(SUM(sales),2) AS total_sales,
    ROUND(SUM(profit)/SUM(sales)*100,2) AS profit_margin_pct
FROM sales GROUP BY discount_band ORDER BY profit_margin_pct DESC;` },
    { title: "Top City per Region", q: "Within each region, which single city generates the most revenue? Uses ROW_NUMBER() partitioned by region.",
      sql: `WITH city_sales AS (
  SELECT region, city, SUM(sales) AS total_sales,
    ROW_NUMBER() OVER (PARTITION BY region ORDER BY SUM(sales) DESC) AS rn
  FROM sales GROUP BY region, city)
SELECT region, city, ROUND(total_sales,2) AS total_sales
FROM city_sales WHERE rn = 1 ORDER BY total_sales DESC;` },
  ];

  function renderSqlInsights() {
    const grid = document.getElementById("sqlGrid");
    grid.innerHTML = SQL_QUERIES.map((item, i) => `
      <article class="sql-card">
        <h3><span class="sql-num">${String(i + 1).padStart(2, "0")}</span> ${item.title}</h3>
        <p>${item.q}</p>
        <details>
          <summary>View SQL query</summary>
          <pre><code>${escapeHtml(item.sql)}</code></pre>
        </details>
      </article>`).join("");
  }

  function escapeHtml(s) {
    return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }

  /* ---------------------------------------------------------------------
   * Business Insights (computed live from state.filtered)
   * ------------------------------------------------------------------- */
  function renderInsights() {
    const data = state.filtered;
    if (!data.length) {
      document.getElementById("insightsGrid").innerHTML =
        `<article class="insight-card wide"><p>No orders match the current filters. Try resetting them.</p></article>`;
      return;
    }

    const totalSales = sum(data, (r) => r.sales);
    const totalProfit = sum(data, (r) => r.profit);
    const overallMargin = totalProfit / totalSales;

    // Region leaders
    const regionSales = groupSum(data, (r) => r.region, (r) => r.sales);
    const regionProfit = groupSum(data, (r) => r.region, (r) => r.profit);
    const topRegionBySales = topEntry(regionSales);
    const regionMargins = new Map(Array.from(regionSales.keys()).map((k) => [k, regionProfit.get(k) / regionSales.get(k)]));
    const topRegionByMargin = topEntry(regionMargins);

    // Category leaders
    const catSales = groupSum(data, (r) => r.category, (r) => r.sales);
    const catProfit = groupSum(data, (r) => r.category, (r) => r.profit);
    const topCatBySales = topEntry(catSales);
    const catMargins = new Map(Array.from(catSales.keys()).map((k) => [k, catProfit.get(k) / catSales.get(k)]));
    const bestMarginCat = topEntry(catMargins);
    const worstMarginCat = topEntry(catMargins, true);

    // Top products
    const prodSales = groupSum(data, (r) => r.product, (r) => r.sales);
    const topProducts = Array.from(prodSales.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);

    // Monthly trend
    const monthSales = groupSum(data, (r) => r.monthKey, (r) => r.sales);
    const months = Array.from(monthSales.keys()).sort();
    let trendText = "Not enough data to compute a trend.";
    if (months.length >= 2) {
      const first = monthSales.get(months[0]);
      const last = monthSales.get(months[months.length - 1]);
      const change = first ? ((last - first) / first) * 100 : 0;
      trendText = `From ${monthLabel(months[0])} to ${monthLabel(months[months.length - 1])}, monthly sales ${change >= 0 ? "grew" : "declined"} ${Math.abs(change).toFixed(0)}%. `;
      const peak = Array.from(monthSales.entries()).sort((a, b) => b[1] - a[1])[0];
      trendText += `Peak month was ${monthLabel(peak[0])} at ${fmtUSD(peak[1])}, consistent with a holiday-season demand spike.`;
    }

    // Rep leaderboard
    const repSales = groupSum(data, (r) => r.rep, (r) => r.sales);
    const topRep = topEntry(repSales);
    const lowRep = topEntry(repSales, true);
    const repGap = lowRep[1] ? ((topRep[1] - lowRep[1]) / lowRep[1]) * 100 : 0;

    const cards = [
      {
        wide: true,
        title: "Headline",
        html: `<div class="headline">${fmtUSD(totalSales)} in sales · ${fmtUSD(totalProfit)} profit (${fmtPct(overallMargin)} margin)</div>
               <p>Based on ${data.length.toLocaleString()} transactions in the current filter selection.</p>`,
      },
      {
        title: "Best-Performing Region",
        html: `<div class="headline">${topRegionBySales[0]}</div>
               <p>Leads on revenue with ${fmtUSD(topRegionBySales[1])}. ${topRegionByMargin[0]} runs the healthiest margin at ${fmtPct(topRegionByMargin[1])}, ${topRegionByMargin[0] === topRegionBySales[0] ? "the same region." : "showing revenue and margin leadership don't always align."}</p>`,
      },
      {
        title: "Highest Revenue Category",
        html: `<div class="headline">${topCatBySales[0]}</div>
               <p>Generates ${fmtUSD(topCatBySales[1])} (${fmtPct(topCatBySales[1] / totalSales)} of total sales). ${bestMarginCat[0]} is the most profitable category at ${fmtPct(bestMarginCat[1])} margin, while ${worstMarginCat[0]} is the thinnest at ${fmtPct(worstMarginCat[1])}.</p>`,
      },
      {
        title: "Top-Selling Products",
        html: `<ul>${topProducts.map((p, i) => `<li><b>${i + 1}. ${p[0]}</b> — ${fmtUSD(p[1])}</li>`).join("")}</ul>`,
      },
      {
        title: "Monthly Sales Trend",
        html: `<p>${trendText}</p>`,
      },
      {
        title: "Profitability Analysis",
        html: `<div class="headline">${fmtPct(overallMargin)} overall margin</div>
               <p>Margin varies notably by category (${bestMarginCat[0]} at ${fmtPct(bestMarginCat[1])} vs ${worstMarginCat[0]} at ${fmtPct(worstMarginCat[1])}), suggesting category mix — not just volume — should factor into growth targets.</p>`,
      },
      {
        title: "Sales Rep Performance",
        html: `<p><b>${topRep[0]}</b> leads the team with ${fmtUSD(topRep[1])} in sales, ${repGap.toFixed(0)}% ahead of the lowest performer (${lowRep[0]}) — a potential coaching or account-distribution opportunity.</p>`,
      },
      {
        wide: true,
        title: "Actionable Recommendations",
        html: `<ul>
          <li><b>Protect margin on ${topCatBySales[0]}:</b> it drives the most revenue but not the most margin — review discount approval thresholds for this category.</li>
          <li><b>Double down on ${topRegionByMargin[0]}:</b> replicate its pricing/discount discipline in lower-margin regions.</li>
          <li><b>Plan inventory for seasonal peaks:</b> the trend chart shows a clear late-year spike — align stock and staffing ahead of it.</li>
          <li><b>Share best practices from ${topRep[0]}:</b> pair top and bottom performers, or review what's driving the ${repGap.toFixed(0)}% performance gap.</li>
        </ul>`,
      },
    ];

    document.getElementById("insightsGrid").innerHTML = cards.map((c) => `
      <article class="insight-card ${c.wide ? "wide" : ""}">
        <h3>${c.title}</h3>
        ${c.html}
      </article>`).join("");
  }

  function topEntry(map, lowest = false) {
    const arr = Array.from(map.entries());
    arr.sort((a, b) => lowest ? a[1] - b[1] : b[1] - a[1]);
    return arr[0] || ["—", 0];
  }

  function monthLabel(key) {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }

  /* ---------------------------------------------------------------------
   * Export CSV (filtered dataset)
   * ------------------------------------------------------------------- */
  function exportCsv() {
    const rows = getTableRows();
    const headers = ["Order ID", "Order Date", "Region", "City", "Segment", "Category", "Sub-Category",
      "Product Name", "Sales Rep", "Customer Name", "Quantity", "Sales", "Profit", "Profit Margin"];
    const lines = [headers.join(",")];
    rows.forEach((r) => {
      lines.push([
        r.orderId, r.dateStr, r.region, r.city, r.segment, r.category, r.subCategory,
        csvSafe(r.product), r.rep, csvSafe(r.customer), r.qty, r.sales.toFixed(2), r.profit.toFixed(2), r.margin.toFixed(4),
      ].join(","));
    });
    downloadBlob(lines.join("\n"), "sales_data_filtered.csv", "text/csv");
  }

  function csvSafe(v) {
    return /[,"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }

  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadChartPng(canvasId) {
    const chart = charts[canvasId];
    if (!chart) return;
    const url = chart.toBase64Image("image/png", 1);
    const a = document.createElement("a");
    a.href = url; a.download = `${canvasId}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  /* ---------------------------------------------------------------------
   * Events
   * ------------------------------------------------------------------- */
  function bindEvents() {
    document.getElementById("yearFilter").addEventListener("change", (e) => { state.filters.year = e.target.value; applyFilters(); });
    document.getElementById("regionFilter").addEventListener("change", (e) => { state.filters.region = e.target.value; applyFilters(); });
    document.getElementById("categoryFilter").addEventListener("change", (e) => { state.filters.category = e.target.value; applyFilters(); });
    document.getElementById("resetFilters").addEventListener("click", () => {
      state.filters = { year: "all", region: "all", category: "all" };
      document.getElementById("yearFilter").value = "all";
      document.getElementById("regionFilter").value = "all";
      document.getElementById("categoryFilter").value = "all";
      applyFilters();
    });

    document.getElementById("exportCsvBtn").addEventListener("click", exportCsv);

    document.querySelectorAll(".download-btn").forEach((btn) => {
      btn.addEventListener("click", () => downloadChartPng(btn.dataset.chart));
    });

    document.getElementById("tableSearch").addEventListener("input", (e) => {
      state.search = e.target.value.trim();
      state.page = 1;
      renderTable();
    });

    document.querySelectorAll("#salesTable thead th").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.key;
        if (state.sort.key === key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
        else { state.sort.key = key; state.sort.dir = "asc"; }
        renderTable();
      });
    });

    document.getElementById("prevPage").addEventListener("click", () => { state.page--; renderTable(); });
    document.getElementById("nextPage").addEventListener("click", () => { state.page++; renderTable(); });

    // Sidebar nav / view switching
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        const view = btn.dataset.view;
        document.querySelectorAll(".view").forEach((v) => v.classList.remove("is-active"));
        document.getElementById(`view-${view}`).classList.add("is-active");

        const titles = {
          dashboard: ["Dashboard", "Overview of revenue, profit and performance"],
          sql: ["SQL Insights", "Business questions answered through SQL analysis"],
          insights: ["Business Insights", "Key findings and recommendations from the data"],
        };
        document.getElementById("viewTitle").textContent = titles[view][0];
        document.getElementById("viewSubtitle").textContent = titles[view][1];

        document.getElementById("filterbar").style.display = view === "sql" ? "none" : "flex";

        closeSidebar();
      });
    });

    // Mobile sidebar
    document.getElementById("menuBtn").addEventListener("click", openSidebar);
    document.getElementById("scrim").addEventListener("click", closeSidebar);
  }

  function openSidebar() {
    document.getElementById("sidebar").classList.add("is-open");
    document.getElementById("scrim").classList.add("is-visible");
  }
  function closeSidebar() {
    document.getElementById("sidebar").classList.remove("is-open");
    document.getElementById("scrim").classList.remove("is-visible");
  }
})();
