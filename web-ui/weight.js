const API = {
  weightLogs: "/api/v1/weight/log",
};

class WeightLog {
  constructor({
    weight_id = null,
    unix_timestamp = null,
    grams = 0,
  } = {}) {
    this.weight_id = weight_id;
    this.unix_timestamp = Number(unix_timestamp ?? 0);
    this.grams = Number(grams ?? 0);
  }

  get kilograms() {
    return this.grams / 1000;
  }

  toApiPayload() {
    return {
      unix_timestamp: this.unix_timestamp,
      grams: this.grams,
    };
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
      },
    });

    if (!r.ok) {
      let message = `${r.status} ${r.statusText}`;
      try {
        const body = await r.text();
        if (body) message = body;
      } catch (_) {}
      throw new Error(message);
    }

    if (r.status === 204) return null;
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  },

  getWeightLogs() {
    return this.request(API.weightLogs);
  },

  addWeightLog(log) {
    return this.request(API.weightLogs, {
      method: "POST",
      body: JSON.stringify(log.toApiPayload()),
    });
  },

  removeWeightLog(weightId) {
    return this.request(API.weightLogs, {
      method: "DELETE",
      body: JSON.stringify({ weight_id: weightId }),
    });
  },
};

const state = {
  logs: [],
  range: "90",
  visibleLogs: [],
};

const $ = (s) => document.querySelector(s);
const elements = {
  form: $("#weight-form"),
  kg: $("#weight-kg"),
  date: $("#weight-date"),
  time: $("#weight-time"),
  summary: $("#weight-summary"),
  list: $("#weight-list"),
  rangeButtons: [...document.querySelectorAll(".range-button")],
  chartWrap: $("#weight-chart-wrap"),
  canvas: $("#weight-chart"),
  tooltip: $("#weight-tooltip"),
  empty: $("#weight-empty"),
  subtitle: $("#weight-chart-subtitle"),
  toast: $("#toast"),
};

const chart = {
  points: [],
  plot: null,
};

async function init() {
  setDefaultDateTime();
  bindEvents();
  await refresh();
}

function bindEvents() {
  elements.form.addEventListener("submit", handleSubmit);
  elements.list.addEventListener("click", handleListClick);

  elements.rangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.range = button.dataset.range;
      elements.rangeButtons.forEach((b) =>
        b.classList.toggle("active", b === button)
      );
      render();
    });
  });

  window.addEventListener("resize", debounce(drawChart, 80));
  elements.canvas.addEventListener("mousemove", handleHover);
  elements.canvas.addEventListener("mouseleave", hideTooltip);
}

async function refresh() {
  try {
    const rows = await api.getWeightLogs();
    state.logs = (rows ?? [])
      .map((row) => new WeightLog(row))
      .sort((a, b) => a.unix_timestamp - b.unix_timestamp);
    render();
  } catch (error) {
    showToast(`Could not load weight logs: ${error.message}`, true);
  }
}

function render() {
  state.visibleLogs = getVisibleLogs();
  renderSummary();
  renderList();
  renderSubtitle();
  drawChart();
}

function renderSummary() {
  if (!state.logs.length) {
    elements.summary.innerHTML = `
      ${statCard("Current", "—", "No measurements")}
      ${statCard("Change", "—", "No measurements")}
      ${statCard("30 day change", "—", "No measurements")}
      ${statCard("Measurements", "0", "Total")}
    `;
    return;
  }

  const first = state.logs[0];
  const latest = state.logs[state.logs.length - 1];
  const totalChange = latest.kilograms - first.kilograms;

  const thirtyDaysAgo = Date.now() / 1000 - 30 * 86400;
  const recent = state.logs.filter((log) => log.unix_timestamp >= thirtyDaysAgo);
  const change30 = recent.length >= 2
    ? latest.kilograms - recent[0].kilograms
    : null;

  elements.summary.innerHTML = `
    ${statCard("Current", `${formatNumber(latest.kilograms)} kg`, formatDateTime(latest.unix_timestamp))}
    ${statCard("Overall change", signedKg(totalChange), `Since ${formatDate(first.unix_timestamp)}`)}
    ${statCard("30 day change", change30 == null ? "—" : signedKg(change30), change30 == null ? "Need 2 measurements" : "Recent trend")}
    ${statCard("Measurements", String(state.logs.length), "Total")}
  `;
}

function statCard(name, value, note) {
  return `
    <article class="weight-stat">
      <span>${name}</span>
      <strong>${value}</strong>
      <small>${note}</small>
    </article>
  `;
}

function renderList() {
  if (!state.logs.length) {
    elements.list.innerHTML = `<div class="empty-state">No weight measurements yet.</div>`;
    return;
  }

  const desc = [...state.logs].reverse();

  elements.list.innerHTML = desc.map((log, index) => {
    const previous = desc[index + 1];
    const change = previous ? log.kilograms - previous.kilograms : null;

    return `
      <article class="weight-row">
        <div>
          <div class="weight-value">
            <strong>${formatNumber(log.kilograms)} kg</strong>
            ${change == null ? "" : `<span class="weight-change">${signedKg(change)}</span>`}
          </div>
          <div class="meta">${formatDateTime(log.unix_timestamp)}</div>
        </div>

        <button
          type="button"
          class="danger-button"
          data-action="remove-weight"
          data-weight-id="${log.weight_id}"
        >
          Remove
        </button>
      </article>
    `;
  }).join("");
}

function renderSubtitle() {
  if (!state.visibleLogs.length) {
    elements.subtitle.textContent = "No measurements in this range.";
    return;
  }

  const first = state.visibleLogs[0];
  const last = state.visibleLogs[state.visibleLogs.length - 1];
  elements.subtitle.textContent =
    `${formatDate(first.unix_timestamp)} – ${formatDate(last.unix_timestamp)} · ${state.visibleLogs.length} measurements`;
}

async function handleSubmit(event) {
  event.preventDefault();

  const kg = Number(elements.kg.value);
  const timestamp = combineDateAndTime(elements.date.value, elements.time.value);

  const log = new WeightLog({
    unix_timestamp: timestamp,
    grams: kg * 1000,
  });

  try {
    await api.addWeightLog(log);
    elements.kg.value = "";
    await refresh();
    showToast("Weight added.");
  } catch (error) {
    showToast(`Could not add weight: ${error.message}`, true);
  }
}

async function handleListClick(event) {
  const button = event.target.closest('[data-action="remove-weight"]');
  if (!button) return;

  try {
    await api.removeWeightLog(Number(button.dataset.weightId));
    await refresh();
    showToast("Weight removed.");
  } catch (error) {
    showToast(`Could not remove weight: ${error.message}`, true);
  }
}

function getVisibleLogs() {
  if (state.range === "all") return [...state.logs];
  const days = Number(state.range);
  const cutoff = Date.now() / 1000 - days * 86400;
  return state.logs.filter((log) => log.unix_timestamp >= cutoff);
}

function drawChart() {
  const rect = elements.chartWrap.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const dpr = window.devicePixelRatio || 1;
  elements.canvas.width = Math.round(rect.width * dpr);
  elements.canvas.height = Math.round(rect.height * dpr);
  elements.canvas.style.width = `${rect.width}px`;
  elements.canvas.style.height = `${rect.height}px`;

  const ctx = elements.canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  elements.empty.classList.toggle("hidden", state.visibleLogs.length > 0);
  if (!state.visibleLogs.length) {
    chart.points = [];
    return;
  }

  const weights = state.visibleLogs.map((log) => log.kilograms);
  const scale = makeScale(weights);
  const padding = { top: 18, right: 24, bottom: 42, left: 62 };
  const plot = {
    x: padding.left,
    y: padding.top,
    width: rect.width - padding.left - padding.right,
    height: rect.height - padding.top - padding.bottom,
  };
  chart.plot = plot;

  drawAxes(ctx, plot, scale);

  const firstTs = state.visibleLogs[0].unix_timestamp;
  const lastTs = state.visibleLogs[state.visibleLogs.length - 1].unix_timestamp;
  const span = Math.max(1, lastTs - firstTs);

  chart.points = state.visibleLogs.map((log) => ({
    x: plot.x + ((log.unix_timestamp - firstTs) / span) * plot.width,
    y: yForWeight(log.kilograms, scale, plot),
    log,
  }));

  ctx.strokeStyle = "#b23a48";
  ctx.fillStyle = "#b23a48";
  ctx.lineWidth = 2.8;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  chart.points.forEach((point, i) => {
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  chart.points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  drawXAxis(ctx, plot);
}

function drawAxes(ctx, plot, scale) {
  const lines = 5;
  ctx.font = "12px system-ui, sans-serif";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= lines; i++) {
    const ratio = i / lines;
    const y = plot.y + plot.height - ratio * plot.height;
    const value = scale.min + (scale.max - scale.min) * ratio;

    ctx.strokeStyle = "#e8eaee";
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.width, y);
    ctx.stroke();

    ctx.fillStyle = "#707887";
    ctx.textAlign = "right";
    ctx.fillText(`${value.toFixed(1)}kg`, plot.x - 9, y);
  }
}

function drawXAxis(ctx, plot) {
  const points = chart.points;
  if (!points.length) return;

  const maxLabels = Math.max(2, Math.floor(plot.width / 90));
  const step = Math.max(1, Math.ceil(points.length / maxLabels));

  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = "#707887";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  points.forEach((point, index) => {
    if (index % step !== 0 && index !== points.length - 1) return;
    ctx.fillText(formatShortDate(point.log.unix_timestamp), point.x, plot.y + plot.height + 12);
  });
}

function handleHover(event) {
  if (!chart.points.length || !chart.plot) return;

  const rect = elements.canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  let closest = chart.points[0];
  let distance = Math.abs(mouseX - closest.x);

  for (const point of chart.points.slice(1)) {
    const d = Math.abs(mouseX - point.x);
    if (d < distance) {
      closest = point;
      distance = d;
    }
  }

  if (distance > 35) {
    hideTooltip();
    return;
  }

  elements.tooltip.innerHTML = `
    <strong>${formatNumber(closest.log.kilograms)} kg</strong>
    ${formatDateTime(closest.log.unix_timestamp)}
  `;
  elements.tooltip.classList.remove("hidden");

  const tip = elements.tooltip.getBoundingClientRect();
  let left = closest.x + 12;
  let top = mouseY - tip.height / 2;
  if (left + tip.width > rect.width) left = closest.x - tip.width - 12;
  top = Math.max(4, Math.min(rect.height - tip.height - 4, top));

  elements.tooltip.style.left = `${left}px`;
  elements.tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  elements.tooltip.classList.add("hidden");
}

function makeScale(values) {
  let min = Math.min(...values);
  let max = Math.max(...values);

  if (min === max) {
    const pad = Math.max(0.5, Math.abs(min) * 0.01);
    return { min: min - pad, max: max + pad };
  }

  const span = max - min;
  const pad = Math.max(0.25, span * 0.18);
  return {
    min: Math.floor((min - pad) * 2) / 2,
    max: Math.ceil((max + pad) * 2) / 2,
  };
}

function yForWeight(value, scale, plot) {
  const ratio = (value - scale.min) / (scale.max - scale.min || 1);
  return plot.y + plot.height - ratio * plot.height;
}

function setDefaultDateTime() {
  const now = new Date();
  elements.date.value = dateToInput(now);
  elements.time.value =
    `${String(now.getHours()).padStart(2, "0")}:` +
    `${String(now.getMinutes()).padStart(2, "0")}`;
}

function combineDateAndTime(dateValue, timeValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  return Math.floor(new Date(year, month - 1, day, hours, minutes).getTime() / 1000);
}

function signedKg(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)} kg`;
}

function formatNumber(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDate(unixTimestamp) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(unixTimestamp * 1000));
}

function formatShortDate(unixTimestamp) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
  }).format(new Date(unixTimestamp * 1000));
}

function formatDateTime(unixTimestamp) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(unixTimestamp * 1000));
}

function dateToInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
