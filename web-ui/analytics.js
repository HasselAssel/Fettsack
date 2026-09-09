const API = {
  foods: "/api/v1/food/food",
  logs: "/api/v1/food/log",
  weightLogs: "/api/v1/weight/log",
  trackedContainers: "/api/v1/food/tracked-container/tracked-container",
  trackedContainerLogs: "/api/v1/food/tracked-container/log",
  trackedContainerIngredients: "/api/v1/food/tracked-container/ingredient",
};

const METRICS = {
  calories: { label: "Calories", short: "kcal", unit: "kcal", axis: "calories", stroke: "#2d6a4f" },
  protein:  { label: "Protein", short: "P", unit: "g", axis: "macros", stroke: "#3268a8" },
  carbs:    { label: "Carbs", short: "C", unit: "g", axis: "macros", stroke: "#b56a1d" },
  fat:      { label: "Fat", short: "F", unit: "g", axis: "macros", stroke: "#8b5aa6" },
  weight:   { label: "Weight", short: "kg", unit: "kg", axis: "weight", stroke: "#b23a48" },
};

class Food {
  constructor(row = {}) {
    this.food_id = row.food_id ?? null;
    this.name = row.name ?? "";
    this.calories = Number(row.calories ?? 0);
    this.protein = Number(row.protein ?? 0);
    this.carbs = Number(row.carbs ?? 0);
    this.fat = Number(row.fat ?? 0);
  }
}

class FoodLog {
  constructor(row = {}) {
    this.log_id = row.log_id ?? null;
    this.food_id = row.food_id ?? null;
    this.unix_timestamp = Number(row.unix_timestamp ?? 0);
    this.grams = Number(row.grams ?? 0);
  }
}

class WeightLog {
  constructor(row = {}) {
    this.weight_id = row.weight_id ?? null;
    this.unix_timestamp = Number(row.unix_timestamp ?? 0);
    this.grams = Number(row.grams ?? 0);
  }

  get kilograms() {
    return this.grams / 1000;
  }
}

const api = {
  async request(url, options = {}) {
    const r = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        "Content-Type": "application/json",
        "Remote-User": "TestUser",
        "Remote-Email": "TestUser@Test.test",
        "Remote-Name": "TestUserName",
        "Remote-Groups": "TestGroup1, TestGroup2",
      }
    });

    if (!r.ok) {
      let message = `${r.status} ${r.statusText}`;
      try {
        const body = await r.text();
        if (body) message = body;
      } catch (_) {}
      throw new Error(message);
    }

    const text = await r.text();
    return text ? JSON.parse(text) : null;
  },

  getFoods() { return this.request(API.foods); },
  getLogs() { return this.request(API.logs); },
  getWeightLogs() { return this.request(API.weightLogs); },
  getTrackedContainers() { return this.request(API.trackedContainers); },
  getTrackedContainerLogs() { return this.request(API.trackedContainerLogs); },
  getTrackedContainerIngredients() { return this.request(API.trackedContainerIngredients); },
};

const state = {
  foods: [],
  logs: [],
  weightLogs: [],
  trackedContainers: [],
  trackedContainerLogs: [],
  trackedContainerIngredients: [],
  buckets: [],
  selectedMetrics: new Set(["calories", "protein"]),
  aggregation: "auto",
  resolvedAggregation: "day",
};

const $ = (selector) => document.querySelector(selector);

const elements = {
  startDate: $("#start-date"),
  endDate: $("#end-date"),
  aggregation: $("#aggregation"),
  metricInputs: [...document.querySelectorAll('.metric-toggle input[type="checkbox"]')],
  presetButtons: [...document.querySelectorAll(".preset-button")],
  summaryCards: $("#summary-cards"),
  graphTitle: $("#graph-title"),
  graphSubtitle: $("#graph-subtitle"),
  legend: $("#legend"),
  canvas: $("#intake-chart"),
  chartWrap: $("#chart-wrap"),
  tooltip: $("#chart-tooltip"),
  chartEmpty: $("#chart-empty"),
  breakdownHead: $("#breakdown-head"),
  breakdownBody: $("#breakdown-body"),
  toast: $("#toast"),
};

const chart = {
  points: [],
  plot: null,
};

async function init() {
  bindEvents();
  applyPresetDays(30);

  try {
    const [foodRows, logRows, weightRows, containerRows, containerLogRows, containerIngredientRows] = await Promise.all([
      api.getFoods(),
      api.getLogs(),
      api.getWeightLogs(),
      api.getTrackedContainers(),
      api.getTrackedContainerLogs(),
      api.getTrackedContainerIngredients(),
    ]);
    state.foods = (foodRows ?? []).map((row) => new Food(row));
    state.logs = (logRows ?? []).map((row) => new FoodLog(row));
    state.weightLogs = (weightRows ?? []).map((row) => new WeightLog(row));
    state.trackedContainers = (containerRows ?? []).map(
      (row) => new window.TrackedContainers.TrackedContainer(row)
    );
    state.trackedContainerLogs = (containerLogRows ?? []).map(
      (row) => new window.TrackedContainers.TrackedContainerLog(row)
    );
    state.trackedContainerIngredients = (containerIngredientRows ?? []).map(
      (row) => new window.TrackedContainers.TrackedContainerIngredient(row)
    );
    render();
  } catch (error) {
    showToast(`Could not load data: ${error.message}`, true);
  }
}

function bindEvents() {
  elements.startDate.addEventListener("change", handleRangeChange);
  elements.endDate.addEventListener("change", handleRangeChange);
  elements.aggregation.addEventListener("change", () => {
    state.aggregation = elements.aggregation.value;
    render();
  });

  elements.metricInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        state.selectedMetrics.add(input.value);
      } else {
        if (state.selectedMetrics.size === 1) {
          input.checked = true;
          return;
        }
        state.selectedMetrics.delete(input.value);
      }
      render();
    });
  });

  elements.presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.days) applyPresetDays(Number(button.dataset.days));
      if (button.dataset.preset === "ytd") applyYearToDate();
      render();
    });
  });

  window.addEventListener("resize", debounce(drawChart, 80));
  elements.canvas.addEventListener("mousemove", handleChartHover);
  elements.canvas.addEventListener("mouseleave", hideTooltip);
}

function handleRangeChange() {
  clearPresetSelection();
  render();
}

function render() {
  const range = getSelectedRange();
  if (!range) return;

  state.resolvedAggregation = resolveAggregation(range.start, range.end, state.aggregation);
  state.buckets = buildBuckets(range.start, range.end, state.resolvedAggregation);

  renderHeader(range);
  renderSummary(range);
  renderLegend();
  renderBreakdown();
  drawChart();
}

function renderHeader(range) {
  const names = {
    day: "Daily intake",
    week: "Weekly intake",
    month: "Monthly intake",
  };

  elements.graphTitle.textContent = names[state.resolvedAggregation];
  elements.graphSubtitle.textContent =
    `${formatDate(range.start)} – ${formatDate(range.end)} · ${state.buckets.length} ${state.buckets.length === 1 ? "point" : "points"}`;
}

function renderSummary(range) {
  const logs = logsForRange(range.start, addDays(range.end, 1));
  const totals = totalsForRange(range.start, addDays(range.end, 1));
  const days = Math.max(1, daysBetween(range.start, range.end) + 1);
  const weights = weightLogsForRange(range.start, addDays(range.end, 1))
    .sort((x, y) => x.unix_timestamp - y.unix_timestamp);

  elements.summaryCards.innerHTML = [...state.selectedMetrics].map((key) => {
    const metric = METRICS[key];

    if (key === "weight") {
      if (!weights.length) {
        return `
          <article class="graph-stat">
            <span class="stat-name">${metric.label}</span>
            <strong>—</strong>
            <small>No measurements in this period</small>
          </article>
        `;
      }

      const first = weights[0].kilograms;
      const last = weights[weights.length - 1].kilograms;
      const change = last - first;
      const signed = `${change > 0 ? "+" : ""}${formatNumber(change)}`;

      return `
        <article class="graph-stat">
          <span class="stat-name">${metric.label}</span>
          <strong>${formatNumber(last)} kg</strong>
          <small>${signed} kg across ${weights.length} ${weights.length === 1 ? "measurement" : "measurements"}</small>
        </article>
      `;
    }

    return `
      <article class="graph-stat">
        <span class="stat-name">${metric.label}</span>
        <strong>${formatNumber(totals[key])} ${metric.unit}</strong>
        <small>${formatNumber(totals[key] / days)} ${metric.unit} / day average</small>
      </article>
    `;
  }).join("");
}

function renderLegend() {
  elements.legend.innerHTML = [...state.selectedMetrics].map((key) => {
    const metric = METRICS[key];
    return `
      <span class="legend-item" style="color:${metric.stroke}">
        <i class="legend-dot"></i>
        <span>${metric.label}</span>
      </span>
    `;
  }).join("");
}

function renderBreakdown() {
  const selected = [...state.selectedMetrics];

  elements.breakdownHead.innerHTML = `
    <tr>
      <th>Period</th>
      ${selected.map((key) => `<th>${METRICS[key].label}</th>`).join("")}
      <th>Entries</th>
    </tr>
  `;

  elements.breakdownBody.innerHTML = state.buckets.map((bucket) => `
    <tr>
      <td>${escapeHtml(bucket.label)}</td>
      ${selected.map((key) => {
        const value = bucket.values[key];
        return `<td>${value == null ? "—" : `${formatNumber(value)} ${METRICS[key].unit}`}</td>`;
      }).join("")}
      <td>${bucket.entries}${bucket.estimatedEntries ? ` · ${bucket.estimatedEntries} estimated` : ""}${bucket.weightEntries ? ` · ${bucket.weightEntries} weight` : ""}</td>
    </tr>
  `).join("");
}

function buildBuckets(start, end, aggregation) {
  const buckets = [];
  let cursor = new Date(start);

  while (cursor <= end) {
    let bucketStart = new Date(cursor);
    let bucketEnd;
    let next;
    let label;

    if (aggregation === "week") {
      bucketEnd = minDate(addDays(bucketStart, 6), end);
      next = addDays(bucketEnd, 1);
      label = `${formatShortDate(bucketStart)} – ${formatShortDate(bucketEnd)}`;
    } else if (aggregation === "month") {
      bucketEnd = minDate(addDays(addMonths(startOfMonth(bucketStart), 1), -1), end);
      next = addDays(bucketEnd, 1);
      label = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(bucketStart);
    } else {
      bucketEnd = bucketStart;
      next = addDays(bucketStart, 1);
      label = new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short" }).format(bucketStart);
    }

    const bucketEndExclusive = addDays(bucketEnd, 1);
    const logs = logsForRange(bucketStart, bucketEndExclusive);
    const estimates = estimatedContainerEntriesForRange(bucketStart, bucketEndExclusive);
    const weights = weightLogsForRange(bucketStart, bucketEndExclusive)
      .sort((a, b) => a.unix_timestamp - b.unix_timestamp);
    const values = totalsForRange(bucketStart, bucketEndExclusive);
    values.weight = weights.length ? weights[weights.length - 1].kilograms : null;

    buckets.push({
      start: bucketStart,
      end: bucketEnd,
      label,
      values,
      entries: logs.length,
      estimatedEntries: estimates.length,
      weightEntries: weights.length,
    });

    cursor = next;
  }

  return buckets;
}

function drawChart() {
  const canvas = elements.canvas;
  const wrap = elements.chartWrap;
  const rect = wrap.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const selected = [...state.selectedMetrics];
  const hasData = state.buckets.some((bucket) =>
    selected.some((key) => bucket.values[key] != null && bucket.values[key] > 0)
  );
  elements.chartEmpty.classList.toggle("hidden", hasData);
  if (!state.buckets.length) return;

  const hasCalories = selected.includes("calories");
  const macroMetrics = selected.filter((key) => METRICS[key].axis === "macros");
  const hasMacros = macroMetrics.length > 0;
  const hasWeight = selected.includes("weight");

  // Calories and macros naturally start at zero.
  const calMax = niceMax(Math.max(0, ...state.buckets.map((b) => b.values.calories ?? 0)));
  const macroMax = niceMax(Math.max(
    0,
    ...state.buckets.flatMap((b) =>
      macroMetrics.map((key) => b.values[key] ?? 0)
    )
  ));

  // Weight should NOT start at zero. Use a padded local range so small changes remain visible.
  const weightValues = state.buckets
    .map((b) => b.values.weight)
    .filter((v) => Number.isFinite(v));
  const weightScale = makeWeightScale(weightValues);

  // Up to three scales:
  // left = calories when selected, otherwise macros
  // inner right = macros when calories are also selected
  // outer right = weight
  const leftAxis = hasCalories ? "calories" : hasMacros ? "macros" : "weight";
  const leftScale = leftAxis === "calories"
    ? { min: 0, max: calMax }
    : leftAxis === "macros"
      ? { min: 0, max: macroMax }
      : weightScale;

  const rightAxis = hasCalories && hasMacros ? "macros" : null;
  const rightScale = rightAxis ? { min: 0, max: macroMax } : null;

  const weightOnRight = hasWeight && leftAxis !== "weight";
  const padding = {
    top: 18,
    right: weightOnRight ? (rightAxis ? 112 : 72) : (rightAxis ? 62 : 28),
    bottom: 46,
    left: 62,
  };

  const plot = {
    x: padding.left,
    y: padding.top,
    width: rect.width - padding.left - padding.right,
    height: rect.height - padding.top - padding.bottom,
  };
  chart.plot = plot;

  drawGridAndAxes(ctx, plot, leftAxis, leftScale, rightAxis, rightScale);

  if (weightOnRight) {
    drawRightAxis(ctx, plot, "weight", weightScale, rightAxis ? 58 : 0);
  }

  chart.points = state.buckets.map((bucket, index) => ({
    x: xForIndex(index, state.buckets.length, plot),
    bucket,
  }));

  selected.forEach((key) => {
    const metric = METRICS[key];
    let scale;

    if (metric.axis === "calories") scale = { min: 0, max: calMax };
    else if (metric.axis === "macros") scale = { min: 0, max: macroMax };
    else scale = weightScale;

    drawSeries(ctx, key, metric, scale, plot);
  });

  drawXAxisLabels(ctx, plot);
}

function drawGridAndAxes(ctx, plot, leftAxis, leftScale, rightAxis, rightScale) {
  const lines = 5;
  ctx.font = "12px system-ui, sans-serif";
  ctx.lineWidth = 1;

  for (let i = 0; i <= lines; i++) {
    const ratio = i / lines;
    const y = plot.y + plot.height - ratio * plot.height;

    ctx.strokeStyle = "#e8eaee";
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.width, y);
    ctx.stroke();

    ctx.fillStyle = "#707887";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(
      axisLabel(scaleValue(leftScale, ratio), leftAxis),
      plot.x - 9,
      y
    );

    if (rightAxis) {
      ctx.textAlign = "left";
      ctx.fillText(
        axisLabel(scaleValue(rightScale, ratio), rightAxis),
        plot.x + plot.width + 9,
        y
      );
    }
  }
}

function drawRightAxis(ctx, plot, axis, scale, offset) {
  const lines = 5;
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillStyle = METRICS.weight.stroke;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  for (let i = 0; i <= lines; i++) {
    const ratio = i / lines;
    const y = plot.y + plot.height - ratio * plot.height;
    ctx.fillText(
      axisLabel(scaleValue(scale, ratio), axis),
      plot.x + plot.width + 9 + offset,
      y
    );
  }
}

function scaleValue(scale, ratio) {
  return scale.min + (scale.max - scale.min) * ratio;
}

function drawSeries(ctx, key, metric, scale, plot) {
  const points = state.buckets.map((bucket, index) => {
    const value = bucket.values[key];
    return {
      x: xForIndex(index, state.buckets.length, plot),
      y: value == null ? null : yForScale(value, scale, plot),
      value,
    };
  });

  ctx.strokeStyle = metric.stroke;
  ctx.fillStyle = metric.stroke;
  ctx.lineWidth = key === "weight" ? 2.8 : 2.4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.setLineDash(metric.axis === "macros" ? [7, 5] : []);

  let drawing = false;
  ctx.beginPath();

  points.forEach((point) => {
    if (point.y == null) {
      drawing = false;
      return;
    }

    if (!drawing) {
      ctx.moveTo(point.x, point.y);
      drawing = true;
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });

  ctx.stroke();
  ctx.setLineDash([]);

  if (points.length <= 60) {
    points.forEach((point) => {
      if (point.y == null) return;
      ctx.beginPath();
      ctx.arc(point.x, point.y, key === "weight" ? 3.6 : 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function drawXAxisLabels(ctx, plot) {
  const count = state.buckets.length;
  if (!count) return;

  const maxLabels = Math.max(2, Math.floor(plot.width / 80));
  const step = Math.max(1, Math.ceil(count / maxLabels));

  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = "#707887";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  state.buckets.forEach((bucket, index) => {
    if (index % step !== 0 && index !== count - 1) return;
    const x = xForIndex(index, count, plot);
    ctx.fillText(shortAxisLabel(bucket), x, plot.y + plot.height + 12);
  });
}

function handleChartHover(event) {
  if (!chart.points.length || !chart.plot) return;

  const rect = elements.canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  let closest = chart.points[0];
  let distance = Math.abs(mouseX - closest.x);
  for (const point of chart.points.slice(1)) {
    const nextDistance = Math.abs(mouseX - point.x);
    if (nextDistance < distance) {
      closest = point;
      distance = nextDistance;
    }
  }

  if (distance > Math.max(24, chart.plot.width / Math.max(state.buckets.length, 1))) {
    hideTooltip();
    return;
  }

  const selected = [...state.selectedMetrics];
  elements.tooltip.innerHTML = `
    <strong>${escapeHtml(closest.bucket.label)}</strong>
    ${selected.map((key) => {
      const value = closest.bucket.values[key];
      return `${METRICS[key].label}: ${value == null ? "—" : `${formatNumber(value)} ${METRICS[key].unit}`}`;
    }).join("<br>")}
    <br>${closest.bucket.entries} ${closest.bucket.entries === 1 ? "food log" : "food logs"}${closest.bucket.estimatedEntries ? ` · ${closest.bucket.estimatedEntries} estimated` : ""}${closest.bucket.weightEntries ? ` · ${closest.bucket.weightEntries} weight` : ""}
  `;
  elements.tooltip.classList.remove("hidden");

  const tooltipRect = elements.tooltip.getBoundingClientRect();
  let left = closest.x + 12;
  let top = mouseY - tooltipRect.height / 2;

  if (left + tooltipRect.width > rect.width) left = closest.x - tooltipRect.width - 12;
  top = Math.max(4, Math.min(rect.height - tooltipRect.height - 4, top));

  elements.tooltip.style.left = `${left}px`;
  elements.tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  elements.tooltip.classList.add("hidden");
}

function getSelectedRange() {
  if (!elements.startDate.value || !elements.endDate.value) return null;
  const start = inputToDate(elements.startDate.value);
  const end = inputToDate(elements.endDate.value);

  if (start > end) {
    showToast("The start date must be before the end date.", true);
    return null;
  }
  return { start, end };
}

function applyPresetDays(days) {
  const end = startOfDay(new Date());
  const start = addDays(end, -(days - 1));
  elements.startDate.value = dateToInput(start);
  elements.endDate.value = dateToInput(end);
  selectPreset(`[data-days="${days}"]`);
}

function applyYearToDate() {
  const end = startOfDay(new Date());
  const start = new Date(end.getFullYear(), 0, 1);
  elements.startDate.value = dateToInput(start);
  elements.endDate.value = dateToInput(end);
  selectPreset('[data-preset="ytd"]');
}

function selectPreset(selector) {
  elements.presetButtons.forEach((button) => button.classList.toggle("active", button.matches(selector)));
}

function clearPresetSelection() {
  elements.presetButtons.forEach((button) => button.classList.remove("active"));
}

function resolveAggregation(start, end, requested) {
  if (requested !== "auto") return requested;
  const days = daysBetween(start, end) + 1;
  if (days <= 45) return "day";
  if (days <= 240) return "week";
  return "month";
}

function totalsForLogs(logs) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const foods = new Map(state.foods.map((food) => [Number(food.food_id), food]));

  for (const log of logs) {
    const food = foods.get(Number(log.food_id));
    if (!food) continue;
    const factor = log.grams / 100;
    totals.calories += food.calories * factor;
    totals.protein += food.protein * factor;
    totals.carbs += food.carbs * factor;
    totals.fat += food.fat * factor;
  }

  return totals;
}

function estimatedContainerEntriesForRange(start, endExclusive) {
  return window.TrackedContainers.estimatedEntriesForRange(
    state.trackedContainers,
    state.trackedContainerLogs,
    state.trackedContainerIngredients,
    start,
    endExclusive
  );
}

function totalsForEstimatedEntries(entries) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const foods = new Map(state.foods.map((food) => [Number(food.food_id), food]));

  for (const entry of entries) {
    const food = foods.get(Number(entry.food_id));
    if (!food) continue;
    const factor = entry.grams / 100;
    totals.calories += food.calories * factor;
    totals.protein += food.protein * factor;
    totals.carbs += food.carbs * factor;
    totals.fat += food.fat * factor;
  }

  return totals;
}

function totalsForRange(start, endExclusive) {
  const regular = totalsForLogs(logsForRange(start, endExclusive));
  const estimated = totalsForEstimatedEntries(
    estimatedContainerEntriesForRange(start, endExclusive)
  );

  return {
    calories: regular.calories + estimated.calories,
    protein: regular.protein + estimated.protein,
    carbs: regular.carbs + estimated.carbs,
    fat: regular.fat + estimated.fat,
  };
}

function logsForRange(start, endExclusive) {
  const min = start.getTime() / 1000;
  const max = endExclusive.getTime() / 1000;
  return state.logs.filter((log) => log.unix_timestamp >= min && log.unix_timestamp < max);
}

function weightLogsForRange(start, endExclusive) {
  const min = start.getTime() / 1000;
  const max = endExclusive.getTime() / 1000;
  return state.weightLogs.filter((log) => log.unix_timestamp >= min && log.unix_timestamp < max);
}

function xForIndex(index, count, plot) {
  if (count <= 1) return plot.x + plot.width / 2;
  return plot.x + (index / (count - 1)) * plot.width;
}

function yForScale(value, scale, plot) {
  const span = scale.max - scale.min;
  if (!span) return plot.y + plot.height / 2;
  return plot.y + plot.height - ((value - scale.min) / span) * plot.height;
}

function makeWeightScale(values) {
  if (!values.length) return { min: 0, max: 1 };

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (min === max) {
    const padding = Math.max(0.5, Math.abs(min) * 0.01);
    return { min: min - padding, max: max + padding };
  }

  const span = max - min;
  const padding = Math.max(0.25, span * 0.18);
  min -= padding;
  max += padding;

  // round to 0.5 kg steps for readable ticks
  return {
    min: Math.floor(min * 2) / 2,
    max: Math.ceil(max * 2) / 2,
  };
}

function niceMax(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function axisLabel(value, axis) {
  if (axis === "weight") return `${Number(value).toFixed(1)}kg`;
  const suffix = axis === "calories" ? "" : "g";
  return `${formatCompactNumber(value)}${suffix}`;
}

function shortAxisLabel(bucket) {
  if (state.resolvedAggregation === "month") {
    return new Intl.DateTimeFormat(undefined, { month: "short" }).format(bucket.start);
  }
  return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short" }).format(bucket.start);
}

function formatCompactNumber(value) {
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return Math.round(value).toString();
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short" }).format(date);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return startOfDay(result);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function minDate(a, b) {
  return a < b ? a : b;
}

function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
}

function inputToDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateToInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", isError);
  elements.toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

init();
