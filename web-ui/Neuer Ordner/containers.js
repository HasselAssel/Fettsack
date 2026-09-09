const API = {
  foods: "/api/v1/food/food",
  containers: "/api/v1/food/tracked-container/tracked-container",
  containerLogs: "/api/v1/food/tracked-container/log",
};

class Food {
  constructor(row = {}) {
    this.food_id = row.food_id ?? null;
    this.name = row.name ?? "";
    this.brand = row.brand ?? "";
    this.calories = Number(row.calories ?? 0);
    this.protein = Number(row.protein ?? 0);
    this.carbs = Number(row.carbs ?? 0);
    this.fat = Number(row.fat ?? 0);
  }
}

const { FoodTrackedContainer, FoodTrackedContainerLog } = window.TrackedContainers;

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

  getFoods() {
    return this.request(API.foods);
  },

  getContainers() {
    return this.request(API.containers);
  },

  getContainerLogs() {
    return this.request(API.containerLogs);
  },

  addContainer(container) {
    return this.request(API.containers, {
      method: "POST",
      body: JSON.stringify(container.toApiPayload()),
    });
  },

  removeContainer(id) {
    return this.request(API.containers, {
      method: "DELETE",
      body: JSON.stringify({ tracked_container_id: id }),
    });
  },

  addContainerLog(log) {
    return this.request(API.containerLogs, {
      method: "POST",
      body: JSON.stringify(log.toApiPayload()),
    });
  },

  removeContainerLog(id) {
    return this.request(API.containerLogs, {
      method: "DELETE",
      body: JSON.stringify({ tracked_container_log_id: id }),
    });
  },
};

const state = {
  foods: [],
  containers: [],
  logs: [],
};

const $ = (selector) => document.querySelector(selector);
const elements = {
  form: $("#container-form"),
  foodId: $("#container-food-id"),
  label: $("#container-label"),
  startGrams: $("#container-start-grams"),
  startDate: $("#container-start-date"),
  startTime: $("#container-start-time"),
  list: $("#containers-list"),
  toast: $("#toast"),
};

async function init() {
  setDefaultDateTime();
  bindEvents();
  await refresh();
}

function bindEvents() {
  elements.form.addEventListener("submit", handleAddContainer);
  elements.list.addEventListener("submit", handleContainerUpdate);
  elements.list.addEventListener("click", handleContainerClick);
}

async function refresh() {
  try {
    const [foodRows, containerRows, logRows] = await Promise.all([
      api.getFoods(),
      api.getContainers(),
      api.getContainerLogs(),
    ]);

    state.foods = (foodRows ?? []).map((row) => new Food(row));
    state.containers = (containerRows ?? []).map((row) => new FoodTrackedContainer(row));
    state.logs = (logRows ?? []).map((row) => new FoodTrackedContainerLog(row));

    renderFoodOptions();
    renderContainers();
  } catch (error) {
    showToast(`Could not load containers: ${error.message}`, true);
  }
}

function renderFoodOptions() {
  if (!state.foods.length) {
    elements.foodId.innerHTML = `<option value="">No foods available</option>`;
    elements.foodId.disabled = true;
    return;
  }

  elements.foodId.disabled = false;
  elements.foodId.innerHTML = state.foods
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((food) => `
      <option value="${food.food_id}">
        ${escapeHtml(food.name)}${food.brand ? ` — ${escapeHtml(food.brand)}` : ""}
      </option>
    `)
    .join("");
}

function renderContainers() {
  if (!state.containers.length) {
    elements.list.innerHTML = `<div class="empty-state">No tracked containers yet.</div>`;
    return;
  }

  const sorted = [...state.containers].sort(
    (a, b) => b.start_unix_timestamp - a.start_unix_timestamp
  );

  elements.list.innerHTML = sorted.map((container) => {
    const food = findFood(container.food_id);
    const logs = window.TrackedContainers.logsForContainer(
      container.tracked_container_id,
      state.logs
    );
    const status = window.TrackedContainers.statusForContainer(container, state.logs);

    return `
      <article class="container-card">
        <div class="container-card-main">
          <div class="container-card-header">
            <div>
              <h4>${escapeHtml(container.label || food?.name || "Tracked container")}</h4>
              <div class="meta">
                <span>${food ? escapeHtml(food.name) : `Food #${container.food_id}`}</span>
                <span>Started ${formatDateTime(container.start_unix_timestamp)}</span>
              </div>
            </div>
            <button
              class="danger-button"
              type="button"
              data-action="remove-container"
              data-container-id="${container.tracked_container_id}"
            >Remove</button>
          </div>

          <div class="container-stats">
            <div class="container-stat">
              <span>Current remaining</span>
              <strong>${formatNumber(status.current_grams)} g</strong>
            </div>
            <div class="container-stat">
              <span>Measured consumed</span>
              <strong>${formatNumber(status.measured_consumed_grams)} g</strong>
            </div>
            <div class="container-stat">
              <span>Last checkpoint</span>
              <strong>${formatShortDate(status.latest_unix_timestamp)}</strong>
            </div>
          </div>

          ${status.warning_intervals ? `
            <div class="container-warning">
              ${status.warning_intervals} interval${status.warning_intervals === 1 ? "" : "s"} had a higher remaining weight than before.
              Those intervals are excluded from estimated intake.
            </div>
          ` : ""}
        </div>

        <form class="container-update" data-container-id="${container.tracked_container_id}">
          <label>
            Remaining measured weight (g)
            <input name="grams_remaining" type="number" min="0" step="0.1" required />
          </label>
          <label>
            Date
            <input name="date" type="date" value="${dateToInput(new Date())}" required />
          </label>
          <label>
            Time
            <input name="time" type="time" value="${timeToInput(new Date())}" required />
          </label>
          <button class="primary-button" type="submit">Add checkpoint</button>
        </form>

        <details class="container-history">
          <summary>${logs.length} checkpoint${logs.length === 1 ? "" : "s"} · show history</summary>
          <div class="container-history-list">
            <div class="container-history-row">
              <div>
                <strong>${formatNumber(container.start_grams)} g</strong>
                <div class="meta">Starting weight · ${formatDateTime(container.start_unix_timestamp)}</div>
              </div>
            </div>

            ${logs.slice().reverse().map((log) => `
              <div class="container-history-row">
                <div>
                  <strong>${formatNumber(log.grams_remaining)} g</strong>
                  <div class="meta">${formatDateTime(log.unix_timestamp)}</div>
                </div>
                <button
                  class="danger-button"
                  type="button"
                  data-action="remove-container-log"
                  data-log-id="${log.tracked_container_log_id}"
                >Remove</button>
              </div>
            `).join("")}
          </div>
        </details>
      </article>
    `;
  }).join("");
}

async function handleAddContainer(event) {
  event.preventDefault();

  const container = new FoodTrackedContainer({
    food_id: Number(elements.foodId.value),
    start_unix_timestamp: combineDateAndTime(elements.startDate.value, elements.startTime.value),
    start_grams: Number(elements.startGrams.value),
    label: elements.label.value.trim(),
  });

  try {
    await api.addContainer(container);
    elements.form.reset();
    setDefaultDateTime();
    await refresh();
    showToast("Container started.");
  } catch (error) {
    showToast(`Could not start container: ${error.message}`, true);
  }
}

async function handleContainerUpdate(event) {
  const form = event.target.closest(".container-update");
  if (!form) return;
  event.preventDefault();

  const id = Number(form.dataset.containerId);
  const data = new FormData(form);
  const log = new FoodTrackedContainerLog({
    tracked_container_id: id,
    unix_timestamp: combineDateAndTime(data.get("date"), data.get("time")),
    grams_remaining: Number(data.get("grams_remaining")),
  });

  try {
    await api.addContainerLog(log);
    await refresh();
    showToast("Checkpoint added.");
  } catch (error) {
    showToast(`Could not add checkpoint: ${error.message}`, true);
  }
}

async function handleContainerClick(event) {
  const removeContainer = event.target.closest('[data-action="remove-container"]');
  if (removeContainer) {
    try {
      await api.removeContainer(Number(removeContainer.dataset.containerId));
      await refresh();
      showToast("Container removed.");
    } catch (error) {
      showToast(`Could not remove container: ${error.message}`, true);
    }
    return;
  }

  const removeLog = event.target.closest('[data-action="remove-container-log"]');
  if (removeLog) {
    try {
      await api.removeContainerLog(Number(removeLog.dataset.logId));
      await refresh();
      showToast("Checkpoint removed.");
    } catch (error) {
      showToast(`Could not remove checkpoint: ${error.message}`, true);
    }
  }
}

function findFood(id) {
  return state.foods.find((food) => Number(food.food_id) === Number(id));
}

function setDefaultDateTime() {
  const now = new Date();
  elements.startDate.value = dateToInput(now);
  elements.startTime.value = timeToInput(now);
}

function combineDateAndTime(dateValue, timeValue) {
  const [year, month, day] = String(dateValue).split("-").map(Number);
  const [hours, minutes] = String(timeValue).split(":").map(Number);
  return Math.floor(new Date(year, month - 1, day, hours, minutes).getTime() / 1000);
}

function dateToInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timeToInput(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDateTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function formatShortDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
  }).format(new Date(timestamp * 1000));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
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

init();
