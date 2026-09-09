const API = {
  foods: '/api/v1/food/food',
  logs: '/api/v1/food/log',
  foodAndLog: '/api/v1/food/food-and-log',
  trackedContainers: '/api/v1/food/tracked-container/tracked-container',
  trackedContainerLogs: '/api/v1/food/tracked-container/log',
}
class Food {
  constructor({
    food_id = null,
    name = '',
    brand = '',
    barcode = '',
    calories = 0,
    protein = 0,
    fat = 0,
    carbs = 0,
  } = {}) {
    this.food_id = food_id
    this.name = name ?? ''
    this.brand = brand ?? ''
    this.barcode = barcode ?? ''
    this.calories = Number(calories ?? 0)
    this.protein = Number(protein ?? 0)
    this.fat = Number(fat ?? 0)
    this.carbs = Number(carbs ?? 0)
  }
  toApiPayload() {
    return {
      name: this.name,
      brand: this.brand || null,
      barcode: this.barcode || null,
      calories: this.calories,
      protein: this.protein,
      fat: this.fat,
      carbs: this.carbs,
    }
  }
}
class FoodLog {
  constructor({
    log_id = null,
    food_id = null,
    unix_timestamp = null,
    grams = 0,
  } = {}) {
    this.log_id = log_id
    this.food_id = food_id
    this.unix_timestamp = Number(unix_timestamp ?? 0)
    this.grams = Number(grams ?? 0)
  }
  toApiPayload() {
    return {
      food_id: this.food_id,
      unix_timestamp: this.unix_timestamp,
      grams: this.grams,
    }
  }
}
const state = {
  foods: [],
  logs: [],
  trackedContainers: [],
  trackedContainerLogs: [],
  selectedDate: startOfLocalDay(new Date()),
  selectedWeek: startOfWeek(new Date()),
  selectedMonth: startOfMonth(new Date()),
  addMode: 'existing',
}
const api = {
  async request(url, options = {}) {
    const r = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        'Content-Type': 'application/json',
        'Remote-User': 'TestUser',
        'Remote-Email': 'TestUser@Test.test',
        'Remote-Name': 'TestUserName',
        'Remote-Groups': 'TestGroup1, TestGroup2'
      },
    })
    if (!r.ok) {
      let m = `${r.status} ${r.statusText}`
      try {
        const b = await r.text()
        if (b) {
          m = b
        }
      } catch {}
      throw new Error(m)
    }
    if (r.status === 204) {
      return null
    }
    const t = await r.text()
    return t ? JSON.parse(t) : null
  },
  getFoods() {
    return this.request(API.foods)
  },
  getLogs() {
    return this.request(API.logs)
  },
  getTrackedContainers() {
    return this.request(API.trackedContainers)
  },
  getTrackedContainerLogs() {
    return this.request(API.trackedContainerLogs)
  },
  addFood(food) {
    return this.request(API.foods, {
      method: 'POST',
      body: JSON.stringify(food.toApiPayload()),
    })
  },
  removeFood(foodId) {
    return this.request(API.foods, {
      method: 'DELETE',
      body: JSON.stringify({ food_id: foodId }),
    })
  },
  addLog(log) {
    return this.request(API.logs, {
      method: 'POST',
      body: JSON.stringify(log.toApiPayload()),
    })
  },
  removeLog(logId) {
    return this.request(API.logs, {
      method: 'DELETE',
      body: JSON.stringify({ log_id: logId }),
    })
  },
  addFoodAndLog(food, log) {
    return this.request(API.foodAndLog, {
      method: 'POST',
      body: JSON.stringify({
        food: food.toApiPayload(),
        log: log.toApiPayload(),
      }),
    })
  },
}
const $ = (s) => document.querySelector(s)
const elements = {
  tabs: [...document.querySelectorAll('.tab-button')],
  views: [...document.querySelectorAll('.view')],
  selectedDate: $('#selected-date'),
  previousDay: $('#previous-day'),
  nextDay: $('#next-day'),
  todayButton: $('#today-button'),
  dayTitle: $('#day-title'),
  dayLogList: $('#day-log-list'),
  foodsList: $('#foods-list'),
  addFoodForm: $('#add-food-form'),
  addLogForm: $('#add-log-form'),
  existingFoodMode: $('#existing-food-mode'),
  newFoodMode: $('#new-food-mode'),
  existingFoodFields: $('#existing-food-fields'),
  newFoodFields: $('#new-food-fields'),
  addLogSubmit: $('#add-log-submit'),
  logFoodId: $('#log-food-id'),
  logGrams: $('#log-grams'),
  logTime: $('#log-time'),
  summaryCalories: $('#summary-calories'),
  summaryProtein: $('#summary-protein'),
  summaryCarbs: $('#summary-carbs'),
  summaryFat: $('#summary-fat'),
  previousWeek: $('#previous-week'),
  currentWeek: $('#current-week'),
  nextWeek: $('#next-week'),
  weekRangeLabel: $('#week-range-label'),
  weekSummary: $('#week-summary'),
  weekDays: $('#week-days'),
  previousMonth: $('#previous-month'),
  currentMonth: $('#current-month'),
  nextMonth: $('#next-month'),
  monthRangeLabel: $('#month-range-label'),
  monthSummary: $('#month-summary'),
  monthDays: $('#month-days'),
  toast: $('#toast'),
}
async function init() {
  bindEvents()
  setDefaultInputs()
  setAddMode('existing')
  try {
    await refreshData()
  } catch (e) {
    showToast(`Could not load data: ${e.message}`, true)
  }
}
function bindEvents() {
  elements.tabs.forEach((b) =>
    b.addEventListener('click', () => showView(b.dataset.view))
  )
  elements.selectedDate.addEventListener('change', () => {
    state.selectedDate = dateInputToLocalDate(elements.selectedDate.value)
    renderDay()
  })
  elements.previousDay.addEventListener('click', () => moveSelectedDate(-1))
  elements.nextDay.addEventListener('click', () => moveSelectedDate(1))
  elements.todayButton.addEventListener('click', () => {
    state.selectedDate = startOfLocalDay(new Date())
    renderDay()
  })
  elements.existingFoodMode.addEventListener('click', () =>
    setAddMode('existing')
  )
  elements.newFoodMode.addEventListener('click', () => setAddMode('new'))
  elements.addFoodForm.addEventListener('submit', handleAddFood)
  elements.addLogForm.addEventListener('submit', handleAddLog)
  elements.foodsList.addEventListener('click', handleFoodListClick)
  elements.dayLogList.addEventListener('click', handleLogListClick)
  elements.previousWeek.addEventListener('click', () => moveSelectedWeek(-1))
  elements.nextWeek.addEventListener('click', () => moveSelectedWeek(1))
  elements.currentWeek.addEventListener('click', () => {
    state.selectedWeek = startOfWeek(new Date())
    renderWeek()
  })
  elements.previousMonth.addEventListener('click', () => moveSelectedMonth(-1))
  elements.nextMonth.addEventListener('click', () => moveSelectedMonth(1))
  elements.currentMonth.addEventListener('click', () => {
    state.selectedMonth = startOfMonth(new Date())
    renderMonth()
  })
  elements.weekDays.addEventListener('click', handlePeriodDayClick)
  elements.monthDays.addEventListener('click', handlePeriodDayClick)
}
async function refreshData() {
  const [f, l, containers, containerLogs] = await Promise.all([
    api.getFoods(),
    api.getLogs(),
    api.getTrackedContainers(),
    api.getTrackedContainerLogs(),
  ])
  state.foods = (f ?? []).map((x) => new Food(x))
  state.logs = (l ?? []).map((x) => new FoodLog(x))
  state.trackedContainers = (containers ?? []).map(
    (x) => new window.TrackedContainers.FoodTrackedContainer(x)
  )
  state.trackedContainerLogs = (containerLogs ?? []).map(
    (x) => new window.TrackedContainers.FoodTrackedContainerLog(x)
  )
  renderAll()
}
function renderAll() {
  renderFoodOptions()
  renderFoods()
  renderDay()
  renderWeek()
  renderMonth()
}
function showView(id) {
  elements.views.forEach((v) => v.classList.toggle('active', v.id === id))
  elements.tabs.forEach((b) =>
    b.classList.toggle('active', b.dataset.view === id)
  )
}
function setAddMode(mode) {
  state.addMode = mode
  const ex = mode === 'existing'
  elements.existingFoodMode.classList.toggle('active', ex)
  elements.newFoodMode.classList.toggle('active', !ex)
  elements.existingFoodFields.classList.toggle('hidden', !ex)
  elements.newFoodFields.classList.toggle('hidden', ex)
  elements.logFoodId.required = ex
  ;[
    '#quick-food-name',
    '#quick-food-calories',
    '#quick-food-protein',
    '#quick-food-carbs',
    '#quick-food-fat',
  ].forEach((s) => ($(s).required = !ex))
  elements.addLogSubmit.textContent = ex ? 'Add log' : 'Create food & add log'
}
function renderFoods() {
  if (!state.foods.length) {
    elements.foodsList.innerHTML = emptyState('No foods yet.')
    return
  }
  const foods = [...state.foods].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )
  elements.foodsList.innerHTML = foods
    .map(
      (f) =>
        `<article class="food-row"><div class="food-main"><strong>${escapeHtml(
          f.name
        )}</strong><div class="meta">${
          f.brand ? `<span>${escapeHtml(f.brand)}</span>` : ''
        }<span>${formatNumber(
          f.calories
        )} kcal / 100 g</span><span>P ${formatNumber(
          f.protein
        )} g</span><span>C ${formatNumber(
          f.carbs
        )} g</span><span>F ${formatNumber(
          f.fat
        )} g</span></div></div><div class="row-actions"><button type="button" class="danger-button" data-action="remove-food" data-food-id="${
          f.food_id
        }">Remove</button></div></article>`
    )
    .join('')
}
function renderFoodOptions() {
  if (!state.foods.length) {
    elements.logFoodId.innerHTML =
      '<option value="">No foods available</option>'
    elements.logFoodId.disabled = true
    return
  }
  elements.logFoodId.disabled = false
  elements.logFoodId.innerHTML = state.foods
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      (f) =>
        `<option value="${f.food_id}">${escapeHtml(f.name)}${
          f.brand ? ` — ${escapeHtml(f.brand)}` : ''
        }</option>`
    )
    .join('')
}
function renderDay() {
  syncDateInput()
  const start = startOfLocalDay(state.selectedDate)
  const end = addDays(state.selectedDate, 1)
  const logs = logsForRange(start, end).sort(
    (a, b) => a.unix_timestamp - b.unix_timestamp
  )
  const estimates = estimatedContainerEntriesForRange(start, end)

  elements.dayTitle.textContent = formatDateHeading(state.selectedDate)

  const regularRows = logs.map((l) => {
    const f = findFood(l.food_id)
    const n = f ? nutritionForLog(f, l.grams) : null
    return `<article class="log-row"><div class="log-main"><strong>${
      f ? escapeHtml(f.name) : `Food #${l.food_id}`
    }</strong><div class="meta"><span>${formatTime(
      l.unix_timestamp
    )}</span><span>${formatNumber(l.grams)} g</span>${
      n ? `<span>${formatNumber(n.calories)} kcal</span>` : ''
    }</div></div><div class="row-actions"><button type="button" class="danger-button" data-action="remove-log" data-log-id="${
      l.log_id
    }">Remove</button></div></article>`
  })

  const estimatedByContainer = new Map()
  for (const entry of estimates) {
    const key = Number(entry.tracked_container_id)
    const current = estimatedByContainer.get(key) ?? { ...entry, grams: 0 }
    current.grams += entry.grams
    estimatedByContainer.set(key, current)
  }

  const estimatedRows = [...estimatedByContainer.values()].map((entry) => {
    const f = findFood(entry.food_id)
    const n = f ? nutritionForLog(f, entry.grams) : null
    return `<article class="log-row estimated-log-row"><div class="log-main"><strong>${
      f ? escapeHtml(f.name) : `Food #${entry.food_id}`
    }</strong><div class="meta"><span class="estimated-badge">Estimated · ${escapeHtml(
      entry.label || 'tracked container'
    )}</span><span>${formatNumber(entry.grams)} g</span>${
      n ? `<span>${formatNumber(n.calories)} kcal</span>` : ''
    }</div></div><div class="row-actions"><a class="small-link" href="containers.html">Container</a></div></article>`
  })

  const rows = [...regularRows, ...estimatedRows]
  elements.dayLogList.innerHTML = rows.length
    ? rows.join('')
    : emptyState('Nothing logged or estimated for this day.')

  const t = totalsForRange(start, end)
  elements.summaryCalories.textContent = `${formatNumber(t.calories)} kcal`
  elements.summaryProtein.textContent = `${formatNumber(t.protein)} g`
  elements.summaryCarbs.textContent = `${formatNumber(t.carbs)} g`
  elements.summaryFat.textContent = `${formatNumber(t.fat)} g`
}
function renderWeek() {
  const start = startOfWeek(state.selectedWeek),
    end = addDays(start, 7),
    logs = logsForRange(start, end),
    totals = totalsForRange(start, end),
    active = countActiveDays(start, 7)
  elements.weekRangeLabel.textContent = `${formatShortDate(
    start
  )} – ${formatShortDate(addDays(end, -1))}`
  elements.weekSummary.innerHTML = renderOverviewCards(totals, 7, active)
  elements.weekDays.innerHTML = Array.from({ length: 7 }, (_, i) =>
    addDays(start, i)
  )
    .map((d) => {
      const dl = logsForRange(d, addDays(d, 1)),
        estimated = estimatedContainerEntriesForRange(d, addDays(d, 1)),
        t = totalsForRange(d, addDays(d, 1))
      return `<article class="period-row" data-date="${localDateToInputValue(
        d
      )}"><div class="period-main"><strong>${formatWeekday(
        d
      )}</strong><div class="meta"><span>${formatShortDate(d)}</span><span>${
        dl.length
      } ${dl.length === 1 ? 'log' : 'logs'}${
        estimated.length ? ` · ${estimated.length} estimated` : ''
      }</span></div></div><div class="period-macros"><span>${formatNumber(
        t.calories
      )} kcal</span><span>P ${formatNumber(
        t.protein
      )} g</span><span>C ${formatNumber(
        t.carbs
      )} g</span><span>F ${formatNumber(t.fat)} g</span></div></article>`
    })
    .join('')
}
function renderMonth() {
  const start = startOfMonth(state.selectedMonth),
    end = addMonths(start, 1),
    days = Math.round((end - start) / 86400000),
    logs = logsForRange(start, end),
    totals = totalsForRange(start, end),
    active = countActiveDays(start, days)
  elements.monthRangeLabel.textContent = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(start)
  elements.monthSummary.innerHTML = renderOverviewCards(totals, days, active)
  const lead = (start.getDay() + 6) % 7,
    cells = []
  for (let i = 0; i < lead; i++) {
    cells.push('<div class="month-day empty"></div>')
  }
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i),
      dl = logsForRange(d, addDays(d, 1)),
      estimated = estimatedContainerEntriesForRange(d, addDays(d, 1)),
      t = totalsForRange(d, addDays(d, 1))
    cells.push(
      `<article class="month-day" data-date="${localDateToInputValue(
        d
      )}"><div class="day-number">${d.getDate()}</div><span class="day-kcal">${formatNumber(
        t.calories
      )} kcal</span><span class="day-meta">${dl.length} ${
        dl.length === 1 ? 'log' : 'logs'
      }${estimated.length ? ` · ${estimated.length} est.` : ''}</span><span class="day-meta">P ${formatNumber(
        t.protein
      )} · C ${formatNumber(t.carbs)} · F ${formatNumber(
        t.fat
      )}</span></article>`
    )
  }
  elements.monthDays.innerHTML = cells.join('')
}
function renderOverviewCards(t, d, a) {
  const avg = divideTotals(t, d),
    aa = a ? divideTotals(t, a) : emptyTotals()
  return `<article class="overview-card"><span>Total calories</span><strong>${formatNumber(
    t.calories
  )} kcal</strong><small>${formatNumber(
    avg.calories
  )} kcal average / day</small></article><article class="overview-card"><span>Total protein</span><strong>${formatNumber(
    t.protein
  )} g</strong><small>${formatNumber(
    avg.protein
  )} g average / day</small></article><article class="overview-card"><span>Total carbs</span><strong>${formatNumber(
    t.carbs
  )} g</strong><small>${formatNumber(
    avg.carbs
  )} g average / day</small></article><article class="overview-card"><span>Total fat</span><strong>${formatNumber(
    t.fat
  )} g</strong><small>${a} active ${a === 1 ? 'day' : 'days'} · ${formatNumber(
    aa.calories
  )} kcal / active day</small></article>`
}
async function handleAddFood(e) {
  e.preventDefault()
  const f = new Food({
    name: $('#food-name').value.trim(),
    brand: $('#food-brand').value.trim(),
    barcode: $('#food-barcode').value.trim(),
    calories: $('#food-calories').value,
    protein: $('#food-protein').value,
    carbs: $('#food-carbs').value,
    fat: $('#food-fat').value,
  })
  try {
    await api.addFood(f)
    elements.addFoodForm.reset()
    await refreshData()
    showToast('Food added.')
  } catch (err) {
    showToast(`Could not add food: ${err.message}`, true)
  }
}
async function handleAddLog(e) {
  e.preventDefault()
  const grams = Number(elements.logGrams.value),
    ts = combineDateAndTime(state.selectedDate, elements.logTime.value)
  try {
    if (state.addMode === 'existing') {
      await api.addLog(
        new FoodLog({
          food_id: Number(elements.logFoodId.value),
          grams,
          unix_timestamp: ts,
        })
      )
      showToast('Log added.')
    } else {
      const f = new Food({
        name: $('#quick-food-name').value.trim(),
        brand: $('#quick-food-brand').value.trim(),
        barcode: $('#quick-food-barcode').value.trim(),
        calories: $('#quick-food-calories').value,
        protein: $('#quick-food-protein').value,
        carbs: $('#quick-food-carbs').value,
        fat: $('#quick-food-fat').value,
      })
      await api.addFoodAndLog(
        f,
        new FoodLog({
          food_id: null,
          grams,
          unix_timestamp: ts,
        })
      )
      ;[
        '#quick-food-name',
        '#quick-food-brand',
        '#quick-food-barcode',
        '#quick-food-calories',
        '#quick-food-protein',
        '#quick-food-carbs',
        '#quick-food-fat',
      ].forEach((s) => ($(s).value = ''))
      setAddMode('existing')
      showToast('Food created and logged.')
    }
    elements.logGrams.value = ''
    await refreshData()
  } catch (err) {
    showToast(`Could not add entry: ${err.message}`, true)
  }
}
async function handleFoodListClick(e) {
  const b = e.target.closest('[data-action="remove-food"]')
  if (!b) {
    return
  }
  try {
    await api.removeFood(Number(b.dataset.foodId))
    await refreshData()
    showToast('Food removed.')
  } catch (err) {
    showToast(`Could not remove food: ${err.message}`, true)
  }
}
async function handleLogListClick(e) {
  const b = e.target.closest('[data-action="remove-log"]')
  if (!b) {
    return
  }
  try {
    await api.removeLog(Number(b.dataset.logId))
    await refreshData()
    showToast('Log removed.')
  } catch (err) {
    showToast(`Could not remove log: ${err.message}`, true)
  }
}
function handlePeriodDayClick(e) {
  const row = e.target.closest('[data-date]')
  if (!row) {
    return
  }
  state.selectedDate = dateInputToLocalDate(row.dataset.date)
  showView('day-view')
  renderDay()
}
function totalsForLogs(logs) {
  return logs.reduce((s, l) => {
    const f = findFood(l.food_id)
    if (!f) {
      return s
    }
    const n = nutritionForLog(f, l.grams)
    s.calories += n.calories
    s.protein += n.protein
    s.carbs += n.carbs
    s.fat += n.fat
    return s
  }, emptyTotals())
}
function emptyTotals() {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  }
}
function divideTotals(t, d) {
  return d
    ? {
        calories: t.calories / d,
        protein: t.protein / d,
        carbs: t.carbs / d,
        fat: t.fat / d,
      }
    : emptyTotals()
}
function countActiveDays(s, n) {
  let c = 0
  for (let i = 0; i < n; i++) {
    const d = addDays(s, i)
    const end = addDays(d, 1)
    if (
      logsForRange(d, end).length ||
      estimatedContainerEntriesForRange(d, end).length
    ) {
      c++
    }
  }
  return c
}
function estimatedContainerEntriesForRange(start, end) {
  return window.TrackedContainers.estimatedEntriesForRange(
    state.trackedContainers,
    state.trackedContainerLogs,
    start,
    end
  )
}
function totalsForEstimatedEntries(entries) {
  return entries.reduce((sum, entry) => {
    const food = findFood(entry.food_id)
    if (!food) return sum
    const n = nutritionForLog(food, entry.grams)
    sum.calories += n.calories
    sum.protein += n.protein
    sum.carbs += n.carbs
    sum.fat += n.fat
    return sum
  }, emptyTotals())
}
function totalsForRange(start, end) {
  const regular = totalsForLogs(logsForRange(start, end))
  const estimated = totalsForEstimatedEntries(
    estimatedContainerEntriesForRange(start, end)
  )
  return {
    calories: regular.calories + estimated.calories,
    protein: regular.protein + estimated.protein,
    carbs: regular.carbs + estimated.carbs,
    fat: regular.fat + estimated.fat,
  }
}
function logsForRange(s, e) {
  const a = s.getTime() / 1000,
    b = e.getTime() / 1000
  return state.logs.filter((l) => l.unix_timestamp >= a && l.unix_timestamp < b)
}
function findFood(id) {
  return state.foods.find((f) => Number(f.food_id) === Number(id))
}
function nutritionForLog(f, g) {
  const k = Number(g) / 100
  return {
    calories: f.calories * k,
    protein: f.protein * k,
    carbs: f.carbs * k,
    fat: f.fat * k,
  }
}
function moveSelectedDate(d) {
  state.selectedDate = addDays(state.selectedDate, d)
  renderDay()
}
function moveSelectedWeek(w) {
  state.selectedWeek = addDays(state.selectedWeek, w * 7)
  renderWeek()
}
function moveSelectedMonth(m) {
  state.selectedMonth = addMonths(state.selectedMonth, m)
  renderMonth()
}
function setDefaultInputs() {
  syncDateInput()
  const n = new Date()
  elements.logTime.value = `${String(n.getHours()).padStart(2, '0')}:${String(
    n.getMinutes()
  ).padStart(2, '0')}`
}
function syncDateInput() {
  elements.selectedDate.value = localDateToInputValue(state.selectedDate)
}
function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function startOfWeek(d) {
  const r = startOfLocalDay(d),
    x = (r.getDay() + 6) % 7
  return addDays(r, -x)
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function addDays(d, a) {
  const r = new Date(d)
  r.setDate(r.getDate() + a)
  return startOfLocalDay(r)
}
function addMonths(d, a) {
  return new Date(d.getFullYear(), d.getMonth() + a, 1)
}
function combineDateAndTime(d, t) {
  const [h, m] = t.split(':').map(Number)
  return Math.floor(
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime() / 1000
  )
}
function dateInputToLocalDate(v) {
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function localDateToInputValue(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(d.getDate()).padStart(2, '0')}`
}
function formatDateHeading(d) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}
function formatShortDate(d) {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
  }).format(d)
}
function formatWeekday(d) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(d)
}
function formatTime(ts) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts * 1000))
}
function formatNumber(v) {
  return Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })
}
function emptyState(m) {
  return `<div class="empty-state">${escapeHtml(m)}</div>`
}
function showToast(m, e = false) {
  elements.toast.textContent = m
  elements.toast.classList.toggle('error', e)
  elements.toast.classList.add('show')
  clearTimeout(showToast.timeout)
  showToast.timeout = setTimeout(
    () => elements.toast.classList.remove('show'),
    2500
  )
}
function escapeHtml(v) {
  return String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
init()
