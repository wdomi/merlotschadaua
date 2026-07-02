/***************************************************************************
 * Merls da l'Ova – FULL app.js (NO LV95)
 **************************************************************************/

console.log("Merlotschadaua app.js loaded");

L.TileLayer.prototype.options.crossOrigin = true;

// ------------------------------------------------------------------------
// GLOBAL STATE
// ------------------------------------------------------------------------

let birds = [];
let selectedRight = [];
let selectedLeft = [];
let perBirdSelection = new Map();

let map = null;
let marker = null;
let birdSearchQuery = "";

const DEFAULT_CENTER = [46.7000, 10.0833];
const OFFLINE_QUEUE_KEY = "merlotschadaua_offline_queue";

// ------------------------------------------------------------------------
// OFFLINE QUEUE
// ------------------------------------------------------------------------

function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setOfflineQueue(q) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q || []));
}

function addToOfflineQueue(entry) {
  const q = getOfflineQueue();
  q.push({ ...entry, queued_at: new Date().toISOString() });
  setOfflineQueue(q);
}

async function flushOfflineQueue() {
  if (!navigator.onLine) return;
  const q = getOfflineQueue();
  if (!q.length) return;

  const remaining = [];
  for (const entry of q) {
    try {
      await sendToServer(entry);
    } catch {
      remaining.push(entry);
    }
  }
  setOfflineQueue(remaining);
}

// ------------------------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------------------------

const ACTION_IDS = {
  sighted: 1,
  maybe: 4,
  catch: 2,
  nest_ringing: 7,
  dead_find: 6
};

const COLOR_PALETTE = {
  alu: "#808080",
  white: "#eee",
  red: "#e22c22",
  yellow: "#d6a51c",
  green: "#227722",
  blue: "#4b77b8",
  violet: "#6e009e",
  pink: "#f58ac7",
  black: "#222"
};

const COLOR_ORDER = ["alu","white","red","yellow","green","blue","pink","violet","black"];

// ------------------------------------------------------------------------
// INIT
// ------------------------------------------------------------------------

window.addEventListener("load", () => {
  loadIndividuals();
  setupButtons();
  flushOfflineQueue();
});

// ------------------------------------------------------------------------
// LOAD FROM API
// ------------------------------------------------------------------------

async function loadIndividuals() {
  try {
    const r = await fetch("/api/individuals");
    if (!r.ok) throw new Error("API Error: " + r.status);
    birds = await r.json();
    if (!Array.isArray(birds)) birds = [];
    buildColorButtons();
    renderBirds();
  } catch (err) {
    console.error("Failed to load birds:", err);
    alert("Bird list could not be loaded: " + err.message);
  }
}

// ------------------------------------------------------------------------
// COLOR BUTTONS
// ------------------------------------------------------------------------

function buildColorButtons() {
  ["left", "right"].forEach(side => {
    const el = document.getElementById(side + "-leg");
    if (!el) return;
    el.innerHTML = "";
    COLOR_ORDER.forEach(color => {
      const btn = document.createElement("button");
      btn.className = "color-button";
      btn.textContent = color;
      btn.style.background = COLOR_PALETTE[color];
      btn.style.color = color === "white" ? "#000" : "#fff";
      btn.onclick = () => toggleColor(side, color, btn);
      el.appendChild(btn);
    });
  });
}

function toggleColor(side, color, btn) {
  const arr = side === "left" ? selectedLeft : selectedRight;
  if (arr.includes(color)) {
    arr.splice(arr.indexOf(color), 1);
    btn.classList.remove("selected");
  } else if (arr.length < 2) {
    arr.push(color);
    btn.classList.add("selected");
  }
  renderBirds();
}

// ------------------------------------------------------------------------
// FILTER & RENDER TABLE
// ------------------------------------------------------------------------

function birdMatches(b) {
  const L = [b.L_top, b.L_bottom].filter(Boolean);
  const R = [b.R_top, b.R_bottom].filter(Boolean);
  if (!selectedLeft.every(c => L.includes(c))) return false;
  if (!selectedRight.every(c => R.includes(c))) return false;
  if (birdSearchQuery) {
    const haystack = `${b.name} ${b.ring_number}`.toLowerCase();
    if (!haystack.includes(birdSearchQuery)) return false;
  }
  return true;
}

function colorPill(c) {
  if (!c) return "";
  const hex = COLOR_PALETTE[c] || "#777";
  const text = c === "white" ? "#000" : "#fff";
  return `<span style="background:${hex};color:${text};padding:1px 3px;border-radius:3px;font-size:10px;line-height:1;display:inline-block;">${c.slice(0,3)}</span>`;
}






function renderBirds() {
  const body = document.getElementById("birds-body");
  if (!body) return;
  
  if (!birds || !birds.length) {
    body.innerHTML = "<tr><td colspan='4'>Lade Vögel...</td></tr>";
    return;
  }

  body.innerHTML = "";

  birds.filter(birdMatches).forEach(b => {
    const currentAction = perBirdSelection.get(b.ring_number) || "";
    const tr = document.createElement("tr");
    
    // Determine if we should add the dark class immediately
    const hasValueClass = currentAction ? "action-select has-value" : "action-select";

    tr.innerHTML = `
      <!-- Name Column: Constrained width -->
      <td style="vertical-align: middle; text-align: left; max-width: 90px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 8px;">
        <div style="font-weight:600; font-size: 12px; line-height: 1.2;">${b.name || ""}</div>
        <div style="font-size: 10px; color:#666; line-height: 1.2;">${b.ring_number || ""}</div>
      </td>
      
      <td style="vertical-align: middle; text-align: left;">
        ${b.territory || ""} (${b.dist || ""})<br>${b.banded_on || ""}
      </td>
      <td style="vertical-align: middle; text-align: center;">
        <div style="display:grid; grid-template-columns:auto auto; column-gap:4px; justify-content: center;">
          <div>${colorPill(b.L_top)}</div><div>${colorPill(b.R_top)}</div>
          <div>${colorPill(b.L_bottom)}</div><div>${colorPill(b.R_bottom)}</div>
        </div>
      </td>
      <!-- Action Column: Very narrow, small font -->
      <td style="vertical-align: middle; text-align: right; width: 1%; white-space: nowrap;">
        <select class="${hasValueClass}" data-id="${b.ring_number}" style="padding: 2px 4px; border-radius: 4px; border: 1px solid #ccc; font-size: 10px; min-width: 80px; max-width: 80px; transition: all 0.2s;">
          <option value="">Aktion...</option>
          <option value="sighted" ${currentAction === "sighted" ? "selected" : ""}>beobachtet</option>
          <option value="maybe" ${currentAction === "maybe" ? "selected" : ""}>unsicher</option>
          <option value="catch" ${currentAction === "catch" ? "selected" : ""}>Fang</option>
          <option value="dead_find" ${currentAction === "dead_find" ? "selected" : ""}>Totfund</option>
        </select>
      </td>
    `;

    body.appendChild(tr);
  });
          // → took this line out: <option value="nest_ringing" ${currentAction === "nest_ringing" ? "selected" : ""}>Nest.</option>

  // Re-bind events and ensure class is correct on change
  document.querySelectorAll(".action-select").forEach(select => {
    // Function to update class based on value
    const updateStyle = () => {
      if (select.value) {
        select.classList.add("has-value");
      } else {
        select.classList.remove("has-value");
      }
    };

    // Run once on load (in case value was pre-selected)
    updateStyle();

    // Run on change
    select.onchange = function() {
      const id = this.dataset.id;
      const action = this.value;
      
      updateStyle(); // Apply dark style immediately

      if (!action) perBirdSelection.delete(id);
      else perBirdSelection.set(id, action);
    };
  });
}









// ------------------------------------------------------------------------
// BUTTONS
// ------------------------------------------------------------------------

function setupButtons() {
  const resetBtn = document.getElementById("btn-reset");
  if (resetBtn) resetBtn.onclick = () => {
    selectedLeft = []; selectedRight = []; perBirdSelection.clear();
    document.querySelectorAll(".color-button").forEach(b => b.classList.remove("selected"));
    renderBirds();
  };
  const searchEl = document.getElementById("bird-search");
  if (searchEl) searchEl.oninput = () => {
    birdSearchQuery = searchEl.value.trim().toLowerCase();
    renderBirds();
  };
  const reportBtn = document.getElementById("btn-report");
  if (reportBtn) reportBtn.onclick = openReportPopup;
  const unringedBtn = document.getElementById("btn-unringed");
  if (unringedBtn) unringedBtn.onclick = () => {
    perBirdSelection.clear();
    perBirdSelection.set("unringed", "sighted");
    openReportPopup();
  };
  const latestLink = document.getElementById("lnk-latest");
  if (latestLink) latestLink.onclick = e => { e.preventDefault(); loadLatest(); };
}

// ------------------------------------------------------------------------
// REPORT POPUP + MAP
// ------------------------------------------------------------------------

function openReportPopup() {
  if (!perBirdSelection.size) { alert("Bitte mindestens einen Vogel auswählen."); return; }
  const entries = [];
  for (const [ring_number, action] of perBirdSelection.entries()) {
    let b = ring_number === "unringed" ? { ring_number: "", name: "unberingt", territory: "" } : birds.find(x => x.ring_number === ring_number);
    if (b) entries.push({ bird: b, action });
  }
  window._pendingSelections = entries;
  const infoEl = document.getElementById("popup-bird-info");
  if (entries.length === 1) {
    const b = entries[0].bird;
    infoEl.textContent = b.ring_number ? `${b.name} (${b.ring_number})` : "Unberingter Vogel";
  } else {
    const names = entries.map(e => e.bird.ring_number ? `${e.bird.name} (${e.bird.ring_number})` : "Unberingt");
    infoEl.innerHTML = `<strong>${entries.length} Vögel ausgewählt:</strong><ul style="margin:6px 0 0 16px; padding:0;">${names.map(n => `<li>${n}</li>`).join("")}</ul>`;
  }
  const now = new Date();
  document.getElementById("report-date").value = now.toISOString().slice(0,10);
  document.getElementById("report-time").value = now.toTimeString().slice(0,8);
  openPopup("popup-report-bg");
  initMap();
}

function initMap() {
  const mapDiv = document.getElementById("map");
  if (!mapDiv) return;
  mapDiv.innerHTML = "";
  if (map) map.remove();
  map = L.map("map").setView(DEFAULT_CENTER, 12);
  L.tileLayer("https://api.maptiler.com/maps/topo-v4/{z}/{x}/{y}.png?key=hTUZRiAhto38o94bZonV", { maxZoom: 20, tileSize: 512, zoomOffset: -1 }).addTo(map);
  marker = L.marker(DEFAULT_CENTER, { draggable: true }).addTo(map);
  marker.on("dragend", () => {
    const p = marker.getLatLng();
    updateCoords(p.lat, p.lng);
  });
  updateCoords(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);

  document.querySelectorAll(".quick-loc").forEach(el => {
    el.style.cursor = "pointer"; el.style.textDecoration = "underline"; el.style.color = "#2a4d69";
    el.onclick = function () {
      const lat = Number(this.dataset.lat);
      const lon = Number(this.dataset.lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        marker.setLatLng([lat, lon]); map.setView([lat, lon], 15); updateCoords(lat, lon);
      }
    };
  });

  const findMeEl = document.getElementById("quick-find-me");
  if (findMeEl) {
    findMeEl.style.cursor = "pointer"; findMeEl.style.textDecoration = "underline"; findMeEl.style.color = "#2a4d69";
    findMeEl.onclick = () => {
      navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        marker.setLatLng([lat, lon]); map.setView([lat, lon], 15); updateCoords(lat, lon);
      });
    };
  }

  const saveBtn = document.getElementById("btn-save-report");
  if (saveBtn) saveBtn.onclick = saveSelectedReports;
  setTimeout(() => map.invalidateSize(), 200);
}

function updateCoords(lat, lng) {
  const latInput = document.getElementById("report-lat");
  const lonInput = document.getElementById("report-lon");
  if (latInput) latInput.value = lat.toFixed(10);
  if (lonInput) lonInput.value = lng.toFixed(10);
}

// ------------------------------------------------------------------------
// SAVE REPORTS (NO LV95)
// ------------------------------------------------------------------------

async function saveSelectedReports() {
  const entries = window._pendingSelections;
  if (!entries || !entries.length) return;

  const latInput = document.getElementById("report-lat");
  const lonInput = document.getElementById("report-lon");
  const observerSelect = document.getElementById("observer-select");
  
  if (!latInput || !lonInput || !observerSelect) { alert("Form elements missing."); return; }

  const lat = Number(latInput.value);
  const lng = Number(lonInput.value);
  
  if (isNaN(lat) || isNaN(lng)) { alert("Ungültige Koordinaten."); return; }

  // ❌ LV95 Calculation Removed

  const dateVal = document.getElementById("report-date").value;
  const timeVal = document.getElementById("report-time").value || "";

  for (const entry of entries) {
    const actionId = ACTION_IDS[entry.action];
    if (!actionId) { alert("Bitte für jeden Vogel eine Aktion auswählen."); return; }

    const payload = {
      individual_id: entry.bird.individual_id,
      action: entry.action,
      latitude: lat,
      longitude: lng,
      date: dateVal,
      time_manual: timeVal,
      observer: Number(observerSelect.value)
      // ❌ lv95_x and lv95_y removed
    };

    try {
      if (!navigator.onLine) addToOfflineQueue(payload);
      else await sendToServer(payload);
    } catch (err) {
      console.error("Save failed:", err);
      alert("Fehler beim Speichern:\n\n" + err.message);
      return;
    }
  }

  closePopup("popup-report-bg");
  perBirdSelection.clear();
  renderBirds();
  alert("Gespeichert.");
}

// ------------------------------------------------------------------------
// SERVER
// ------------------------------------------------------------------------

async function sendToServer(payload) {
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt);
  }
  return res.json();
}

// ------------------------------------------------------------------------
// LATEST OBSERVATIONS
// ------------------------------------------------------------------------

let latestMap = null;
let latestLayer = null;
let latestData = [];
let latestBirdFilter = "";
let latestMaxDays = 14;

async function loadLatest() {
  openPopup("popup-latest-bg");
  try {
    const r = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "list" })
    });
    latestData = await r.json();
    const slider = document.getElementById("time-slider");
    const label = document.getElementById("days-label");
    if (slider && label) { slider.value = latestMaxDays; label.textContent = latestMaxDays; }
    initLatestMap();
    populateLatestDropdown();
    renderLatestMap();
  } catch (err) {
    alert("Fehler beim Laden der Beobachtungen.");
    console.error(err);
  }
}

function initLatestMap() {
  const el = document.getElementById("latest-map");
  if (!el) return;
  el.innerHTML = "";
  if (latestMap) latestMap.remove();
  latestMap = L.map(el).setView([46.628584, 10.194596], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(latestMap);
  latestLayer = L.layerGroup().addTo(latestMap);
  setTimeout(() => latestMap.invalidateSize(), 200);
}

function populateLatestDropdown() {
  const sel = document.getElementById("latest-bird-filter");
  if (!sel) return;
  sel.innerHTML = `<option value="">Vogel auswählen</option>`;
  const seen = new Set();
  latestData.forEach(r => {
    const key = `${r.name} (${r.ring_number})`;
    if (!seen.has(key)) {
      seen.add(key);
      const opt = document.createElement("option");
      opt.value = r.ring_number;
      opt.textContent = key;
      sel.appendChild(opt);
    }
  });
  sel.onchange = () => { latestBirdFilter = sel.value; renderLatestMap(); };
  const resetBtn = document.getElementById("latest-reset");
  if (resetBtn) resetBtn.onclick = () => { latestBirdFilter = ""; sel.value = ""; renderLatestMap(); };
  const slider = document.getElementById("time-slider");
  const label = document.getElementById("days-label");
  if (slider && label) {
    slider.oninput = () => { latestMaxDays = Number(slider.value); label.textContent = slider.value; renderLatestMap(); };
  }
}

function renderLatestMap() {
  if (!latestLayer || !latestMap) return;
  latestLayer.clearLayers();
  const now = Date.now();
  let visible = [];
  latestData.forEach(r => {
    if (!r.latitude || !r.longitude || !r.date) return;
    if (latestBirdFilter && r.ring_number !== latestBirdFilter) return;
    const daysOld = (now - new Date(r.date)) / (1000 * 60 * 60 * 24);
    if (daysOld > latestMaxDays) return;
    visible.push(r);
  });
  if (!visible.length) return;
  visible.sort((a, b) => new Date(b.date) - new Date(a.date));
  const mostRecent = visible[0];
  visible.forEach(r => {
    const lat = Number(r.latitude);
    const lon = Number(r.longitude);
    if (isNaN(lat) || isNaN(lon)) return;
    const daysOld = (now - new Date(r.date)) / (1000 * 60 * 60 * 24);
    const opacity = Math.max(0.2, 1 - daysOld / latestMaxDays);
    const color = r.action === "sighted" ? "#3b82f6" : r.action === "maybe" ? "#f59e0b" : "#999";
    const isNewest = r === mostRecent;
    const marker = L.circleMarker([lat, lon], {
      radius: isNewest ? 14 : 10,
      fillColor: color,
      fillOpacity: isNewest ? 1 : opacity,
      color: isNewest ? "#ffffff" : "transparent",
      weight: isNewest ? 3 : 0
    })
    .bindPopup(`<div><strong>${r.name}</strong> (${r.ring_number || "—"})<br>${r.date}<br><span style="font-size:11px;color:#c33;cursor:pointer;text-decoration:underline;" onclick="deleteObservation(${r.id})">löschen</span></div>`)
    .addTo(latestLayer);
    if (isNewest) { marker.openPopup(); marker.bringToFront(); }
  });
  const newestLat = Number(mostRecent.latitude);
  const newestLon = Number(mostRecent.longitude);
  if (!isNaN(newestLat) && !isNaN(newestLon)) latestMap.setView([newestLat, newestLon], 17);
}

async function deleteObservation(id) {
  const ok = confirm("Möchtest du wirklich die Beobachtung löschen?");
  if (!ok) return;
  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "set_deleted", id: id, deleted: true })
    });
    if (!res.ok) { alert("Fehler beim Löschen."); return; }
    await loadLatest();
  } catch (err) {
    console.error(err);
    alert("Serverfehler.");
  }
}

// ------------------------------------------------------------------------
// POPUPS
// ------------------------------------------------------------------------

function openPopup(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "flex";
}
function closePopup(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}
