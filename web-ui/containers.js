const API = {
  foods: "/api/v1/food/food",
  containers: "/api/v1/food/tracked-container/tracked-container",
  containerLogs: "/api/v1/food/tracked-container/log",
  containerIngredients: "/api/v1/food/tracked-container/ingredient",
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

const { TrackedContainer, TrackedContainerLog, TrackedContainerIngredient } = window.TrackedContainers;

const api = {
  async request(url, options = {}) {
    const r = await fetch(url, { ...options, headers: {
      ...(options.headers || {}), "Content-Type":"application/json",
      "Remote-User":"TestUser", "Remote-Email":"TestUser@Test.test",
      "Remote-Name":"TestUserName", "Remote-Groups":"TestGroup1, TestGroup2",
    }});
    if (!r.ok) {
      let message = `${r.status} ${r.statusText}`;
      try { const body = await r.text(); if (body) message = body; } catch (_) {}
      throw new Error(message);
    }
    if (r.status === 204) return null;
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  },
  getFoods(){return this.request(API.foods)},
  getContainers(){return this.request(API.containers)},
  getContainerLogs(){return this.request(API.containerLogs)},
  getContainerIngredients(){return this.request(API.containerIngredients)},
  addContainer(x){return this.request(API.containers,{method:"POST",body:JSON.stringify(x.toApiPayload())})},
  removeContainer(id){return this.request(API.containers,{method:"DELETE",body:JSON.stringify({tracked_container_id:id})})},
  addContainerLog(x){return this.request(API.containerLogs,{method:"POST",body:JSON.stringify(x.toApiPayload())})},
  removeContainerLog(id){return this.request(API.containerLogs,{method:"DELETE",body:JSON.stringify({tracked_container_log_id:id})})},
  addIngredient(x){return this.request(API.containerIngredients,{method:"POST",body:JSON.stringify(x.toApiPayload())})},
  removeIngredient(id){return this.request(API.containerIngredients,{method:"DELETE",body:JSON.stringify({Tracked_container_ingredient_id:id})})},
};

const state={foods:[],containers:[],logs:[],ingredients:[]};
const $=(s)=>document.querySelector(s);
const elements={
  form:$("#container-form"), name:$("#container-name"), startDate:$("#container-start-date"), startTime:$("#container-start-time"),
  ingredientRows:$("#ingredient-rows"), ingredientTotal:$("#ingredient-total-grams"), addIngredientRow:$("#add-ingredient-row"),
  list:$("#containers-list"), toast:$("#toast"),
};

async function init(){ setDefaultDateTime(); bindEvents(); await refresh(); addIngredientBuilderRow(); }
function bindEvents(){
  elements.form.addEventListener("submit",handleAddContainer);
  elements.addIngredientRow.addEventListener("click",()=>addIngredientBuilderRow());
  elements.ingredientRows.addEventListener("click",handleBuilderClick);
  elements.ingredientRows.addEventListener("input",renderBuilderTotal);
  elements.list.addEventListener("submit",handleListSubmit);
  elements.list.addEventListener("click",handleListClick);
}

async function refresh(){
  try{
    const [foods,containers,logs,ingredients]=await Promise.all([api.getFoods(),api.getContainers(),api.getContainerLogs(),api.getContainerIngredients()]);
    state.foods=(foods??[]).map(x=>new Food(x));
    state.containers=(containers??[]).map(x=>new TrackedContainer(x));
    state.logs=(logs??[]).map(x=>new TrackedContainerLog(x));
    state.ingredients=(ingredients??[]).map(x=>new TrackedContainerIngredient(x));
    renderContainers(); renderBuilderFoodOptions();
  }catch(error){showToast(`Could not load containers: ${error.message}`,true)}
}

function foodOptions(selected=null){
  return state.foods.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(f=>
    `<option value="${f.food_id}" ${Number(selected)===Number(f.food_id)?"selected":""}>${escapeHtml(f.name)}${f.brand?` — ${escapeHtml(f.brand)}`:""}</option>`
  ).join("");
}
function addIngredientBuilderRow(foodId=null, grams=""){
  const row=document.createElement("div"); row.className="ingredient-row";
  row.innerHTML=`<label>Food<select name="food_id" required>${foodOptions(foodId)}</select></label><label>Starting grams<input name="grams_start" type="number" min="0.1" step="0.1" value="${grams}" required></label><button class="danger-button" data-action="remove-builder-row" type="button">Remove</button>`;
  elements.ingredientRows.appendChild(row); renderBuilderTotal();
}
function renderBuilderFoodOptions(){
  [...elements.ingredientRows.querySelectorAll('select[name="food_id"]')].forEach(select=>{const value=select.value;select.innerHTML=foodOptions(value)});
}
function handleBuilderClick(e){const b=e.target.closest('[data-action="remove-builder-row"]');if(!b)return;const rows=elements.ingredientRows.querySelectorAll('.ingredient-row');if(rows.length<=1){showToast("A container needs at least one ingredient.",true);return}b.closest('.ingredient-row').remove();renderBuilderTotal()}
function builderIngredients(){return [...elements.ingredientRows.querySelectorAll('.ingredient-row')].map(row=>({food_id:Number(row.querySelector('[name="food_id"]').value),grams_start:Number(row.querySelector('[name="grams_start"]').value)}))}
function renderBuilderTotal(){const total=builderIngredients().reduce((s,x)=>s+(Number.isFinite(x.grams_start)?x.grams_start:0),0);elements.ingredientTotal.textContent=`${formatNumber(total)} g`}

function renderContainers(){
  if(!state.containers.length){elements.list.innerHTML='<div class="empty-state">No tracked containers yet.</div>';return}
  const sorted=[...state.containers].sort((a,b)=>b.start_unix_timestamp-a.start_unix_timestamp);
  elements.list.innerHTML=sorted.map(container=>{
    const ingredients=window.TrackedContainers.ingredientsForContainer(container.tracked_container_id,state.ingredients);
    const logs=window.TrackedContainers.logsForContainer(container.tracked_container_id,state.logs);
    const status=window.TrackedContainers.statusForContainer(container,state.logs,state.ingredients);
    const locked=logs.length>0;
    return `<article class="container-card">
      <div class="container-card-main"><div class="container-card-header"><div><h4>${escapeHtml(container.name||"Tracked container")}</h4><div class="meta"><span>Started ${formatDateTime(container.start_unix_timestamp)}</span><span>${ingredients.length} ingredient${ingredients.length===1?"":"s"}</span></div></div><button class="danger-button" type="button" data-action="remove-container" data-container-id="${container.tracked_container_id}">Remove</button></div>
      <div class="container-stats"><div class="container-stat"><span>Initial total</span><strong>${formatNumber(status.initial_grams)} g</strong></div><div class="container-stat"><span>Current remaining</span><strong>${formatNumber(status.current_grams)} g</strong></div><div class="container-stat"><span>Measured consumed</span><strong>${formatNumber(status.measured_consumed_grams)} g</strong></div></div>
      <div class="container-ingredients">${ingredients.map(i=>{const f=findFood(i.food_id);const pct=status.initial_grams>0?i.grams_start/status.initial_grams*100:0;return `<div class="container-ingredient-row"><div class="container-ingredient-main"><strong>${f?escapeHtml(f.name):`Food #${i.food_id}`}</strong><div class="meta">${formatNumber(i.grams_start)} g · ${formatNumber(pct)}%</div></div>${locked?"":`<button class="danger-button" type="button" data-action="remove-ingredient" data-ingredient-id="${i.tracked_container_ingredient_id}">Remove</button>`}</div>`}).join("")}</div>
      ${locked?'<div class="composition-locked">Composition locked after the first checkpoint so past estimates cannot change.</div>':`<form class="container-add-ingredient" data-container-id="${container.tracked_container_id}"><label>Food<select name="food_id" required>${foodOptions()}</select></label><label>Starting grams<input name="grams_start" type="number" min="0.1" step="0.1" required></label><button class="secondary-button" type="submit">Add ingredient</button></form>`}
      ${status.warning_intervals?`<div class="container-warning">${status.warning_intervals} interval${status.warning_intervals===1?"":"s"} increased in measured weight and is excluded from intake.</div>`:""}</div>
      <form class="container-update" data-container-id="${container.tracked_container_id}"><label>Remaining measured weight (g)<input name="grams_remaining" type="number" min="0" step="0.1" required></label><label>Date<input name="date" type="date" value="${dateToInput(new Date())}" required></label><label>Time<input name="time" type="time" value="${timeToInput(new Date())}" required></label><button class="primary-button" type="submit" ${status.initial_grams<=0?"disabled":""}>Add checkpoint</button></form>
      <details class="container-history"><summary>${logs.length} checkpoint${logs.length===1?"":"s"} · show history</summary><div class="container-history-list"><div class="container-history-row"><div><strong>${formatNumber(status.initial_grams)} g</strong><div class="meta">Calculated initial weight · ${formatDateTime(container.start_unix_timestamp)}</div></div></div>${logs.slice().reverse().map(log=>`<div class="container-history-row"><div><strong>${formatNumber(log.grams_remaining)} g</strong><div class="meta">${formatDateTime(log.unix_timestamp)}</div></div><button class="danger-button" type="button" data-action="remove-container-log" data-log-id="${log.tracked_container_log_id}">Remove</button></div>`).join("")}</div></details>
    </article>`;
  }).join("");
}

async function handleAddContainer(e){
  e.preventDefault(); const ingredients=builderIngredients();
  if(!ingredients.length||ingredients.some(x=>!x.food_id||x.grams_start<=0)){showToast("Add at least one valid ingredient.",true);return}
  const container=new TrackedContainer({name:elements.name.value.trim(),start_unix_timestamp:combineDateAndTime(elements.startDate.value,elements.startTime.value)});
  try{
    const result=await api.addContainer(container); const id=Number(result?.id);
    if(!id) throw new Error("backend did not return a container id");
    for(const item of ingredients){ await api.addIngredient(new TrackedContainerIngredient({tracked_container_id:id,food_id:item.food_id,grams_start:item.grams_start})) }
    elements.form.reset(); elements.ingredientRows.innerHTML=""; setDefaultDateTime(); addIngredientBuilderRow(); await refresh(); showToast("Container started.");
  }catch(error){showToast(`Could not start container completely: ${error.message}`,true);await refresh()}
}

async function handleListSubmit(e){
  const update=e.target.closest('.container-update');
  if(update){e.preventDefault();const d=new FormData(update);try{await api.addContainerLog(new TrackedContainerLog({tracked_container_id:Number(update.dataset.containerId),unix_timestamp:combineDateAndTime(d.get('date'),d.get('time')),grams_remaining:Number(d.get('grams_remaining'))}));await refresh();showToast("Checkpoint added.")}catch(error){showToast(`Could not add checkpoint: ${error.message}`,true)}return}
  const add=e.target.closest('.container-add-ingredient');
  if(add){e.preventDefault();const id=Number(add.dataset.containerId);if(window.TrackedContainers.logsForContainer(id,state.logs).length){showToast("Ingredients are locked after the first checkpoint.",true);return}const d=new FormData(add);try{await api.addIngredient(new TrackedContainerIngredient({tracked_container_id:id,food_id:Number(d.get('food_id')),grams_start:Number(d.get('grams_start'))}));await refresh();showToast("Ingredient added.")}catch(error){showToast(`Could not add ingredient: ${error.message}`,true)}}
}

async function handleListClick(e){
  const c=e.target.closest('[data-action="remove-container"]');if(c){try{await api.removeContainer(Number(c.dataset.containerId));await refresh();showToast("Container removed.")}catch(error){showToast(`Could not remove container: ${error.message}`,true)}return}
  const l=e.target.closest('[data-action="remove-container-log"]');if(l){try{await api.removeContainerLog(Number(l.dataset.logId));await refresh();showToast("Checkpoint removed.")}catch(error){showToast(`Could not remove checkpoint: ${error.message}`,true)}return}
  const i=e.target.closest('[data-action="remove-ingredient"]');if(i){const ingredient=state.ingredients.find(x=>Number(x.tracked_container_ingredient_id)===Number(i.dataset.ingredientId));if(ingredient&&window.TrackedContainers.logsForContainer(ingredient.tracked_container_id,state.logs).length){showToast("Ingredients are locked after the first checkpoint.",true);return}try{await api.removeIngredient(Number(i.dataset.ingredientId));await refresh();showToast("Ingredient removed.")}catch(error){showToast(`Could not remove ingredient: ${error.message}`,true)}}
}
function findFood(id){return state.foods.find(f=>Number(f.food_id)===Number(id))}
function setDefaultDateTime(){const n=new Date();elements.startDate.value=dateToInput(n);elements.startTime.value=timeToInput(n)}
function combineDateAndTime(d,t){const[y,m,day]=String(d).split('-').map(Number),[h,min]=String(t).split(':').map(Number);return Math.floor(new Date(y,m-1,day,h,min).getTime()/1000)}
function dateToInput(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function timeToInput(d){return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function formatDateTime(ts){return new Intl.DateTimeFormat(undefined,{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(ts*1000))}
function formatNumber(v){return Number(v||0).toLocaleString(undefined,{maximumFractionDigits:1})}
function escapeHtml(v){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function showToast(m,e=false){elements.toast.textContent=m;elements.toast.classList.toggle('error',e);elements.toast.classList.add('show');clearTimeout(showToast.timeout);showToast.timeout=setTimeout(()=>elements.toast.classList.remove('show'),2600)}
init();
