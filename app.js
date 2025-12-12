/***************************************************************************
 * Merlotschadaua – FULL app.js 
 * - Original functionality preserved
 * - Offline queue
 * - Latest observations
 * - Normal observation flow
 * - CSV parsing
 * - Map logic
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

let manualMap = null;
let manualMarker = null;

const CSV_URL = "/data/view_birdsCSV_apps.csv";
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
  sighted: 4519311,
  maybe: 4519312
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

const COLOR_ORDER = [
  "alu","white","red","yellow","green","blue","pink","violet","black"
];

// ------------------------------------------------------------------------
// INIT
// ------------------------------------------------------------------------

window.addEventListener("load", () => {
  loadCSV();
  setupButtons();
  flushOfflineQueue();
});

// ------------------------------------------------------------------------
// CSV
// ------------------------------------------------------------------------

function loadCSV() {
  fetch(CSV_URL)
    .then(r => r.text())
    .then(stripBOM)
    .then(parseCSV)
    .then(rows => {
      birds = rows;
      buildColorButtons();
      renderBirds();
    })
    .catch(err => {
      console.error(err);
      alert("CSV konnte nicht geladen werden.");
    });
}

function stripBOM(t) {
  return t.replace(/^\uFEFF/, "");
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0]
    .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
    .map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());

  const idx = k => header.indexOf(k);

  return lines.slice(1).map(raw => {
    const cols = raw
      .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
      .map(v => v.replace(/^"|"$/g, "").trim());

    return {
      bird_id: cols[idx("bird_id")] || "",
      name: cols[idx("name")] || "",
      sex: cols[idx("sex")] || "",
      age: cols[idx("age")] || "",
      R_top: (cols[idx("r_top")] || "").toLowerCase(),
      R_bottom: (cols[idx("r_bottom")] || "").toLowerCase(),
      L_top: (cols[idx("l_top")] || "").toLowerCase(),
      L_bottom: (cols[idx("l_bottom")] || "").toLowerCase(),
      territory: cols[idx("territory_name")] || "",
      dist: cols[idx("dist punt dal gal (m)")] || "",
      banded_on: cols[idx("banded_on")] || ""
    };
  }).filter(Boolean);
}

// ------------------------------------------------------------------------
// COLOR BUTTONS
// ------------------------------------------------------------------------

function buildColorButtons() {
  ["right", "left"].forEach(side => {
    const el = document.getElementById(side + "-leg");
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
  const arr = side === "right" ? selectedRight : selectedLeft;

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
  const R = [b.R_top, b.R_bottom].filter(Boolean);
  const L = [b.L_top, b.L_bottom].filter(Boolean);

  if (!selectedRight.every(c => R.includes(c))) return false;
  if (!selectedLeft.every(c => L.includes(c))) return false;

  return true;
}

function colorPill(c) {
  if (!c) return "";
  const hex = COLOR_PALETTE[c] || "#777";
  const text = c === "white" ? "#000" : "#fff";
  return `<span style="background:${hex};color:${text};padding:2px 4px;border-radius:4px;font-size:11px;">${c}</span>`;
}

function renderBirds() {
  const body = document.getElementById("birds-body");
  if (!body) return;

  body.innerHTML = "";

  birds.filter(birdMatches).forEach(b => {
    const act = perBirdSelection.get(b.bird_id) || "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${b.name}<div class="tag">${b.bird_id}</div></td>
      <td>${b.sex}/${b.age}</td>
      <td>${b.territory} (${b.dist}) / ${b.banded_on}</td>
      <td>${colorPill(b.R_top)} / ${colorPill(b.R_bottom)} – ${colorPill(b.L_top)} / ${colorPill(b.L_bottom)}</td>
      <td>
        <button class="submit-btn submit-btn-ghost ${act==="sighted"?"selected-action":""}"
          data-id="${b.bird_id}" data-action="sighted">beobachtet</button>
        <button class="submit-btn submit-btn-ghost ${act==="maybe"?"selected-action":""}"
          data-id="${b.bird_id}" data-action="maybe">unsicher</button>
      </td>
    `;
    body.appendChild(tr);
  });

  document.querySelectorAll("button[data-id]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const cur = perBirdSelection.get(id);
      if (cur === action) perBirdSelection.delete(id);
      else perBirdSelection.set(id, action);
      renderBirds();
    };
  });
}

// ------------------------------------------------------------------------
// BUTTONS
// ------------------------------------------------------------------------

function setupButtons() {
  document.getElementById("btn-reset").onclick = () => {
    selectedLeft = [];
    selectedRight = [];
    perBirdSelection.clear();
    document.querySelectorAll(".color-button").forEach(b => b.classList.remove("selected"));
    renderBirds();
  };

  document.getElementById("btn-report").onclick = openConfirmationPopup;
  document.getElementById("btn-latest").onclick = loadLatest;

  const manualLink = document.getElementById("lnk-manual");
  if (manualLink) manualLink.onclick = openManualPopup;
}
// ------------------------------------------------------------------------
// CONFIRMATION POPUP → MAP POPUP
// ------------------------------------------------------------------------

function openConfirmationPopup() {
  const entries = [];

  for (const [bird_id, action] of perBirdSelection.entries()) {
    let b;
    if (bird_id === "unringed") {
      b = { bird_id: "unringed", name: "unberingt", territory: "" };
    } else {
      b = birds.find(x => x.bird_id === bird_id);
    }
    if (b) entries.push({ bird: structuredClone(b), action });
  }

  if (entries.length === 0) {
    alert("Bitte mindestens einen Vogel auswählen.");
    return;
  }

  window._pendingSelections = entries;
  openReportPopup(entries);
}

function openReportPopup(entries) {
  const el = document.getElementById("popup-bird-info");

  if (entries.length === 1) {
    const b = entries[0].bird;
    if (b.bird_id === "unringed") el.textContent = "Unberingter Vogel";
    else el.textContent = `${b.name} (${b.bird_id})`;
  } else {
    el.textContent = `${entries.length} Vögel ausgewählt`;
  }

  openPopup("popup-report-bg");
  initMap();
}

// ------------------------------------------------------------------------
// MAP POPUP (NORMAL FLOW)
// ------------------------------------------------------------------------

function initMap() {
  const mapDiv = document.getElementById("map");
  mapDiv.innerHTML = "";

  if (map) map.remove();

  map = L.map("map").setView(DEFAULT_CENTER, 12);

  L.tileLayer(
    "https://api.maptiler.com/maps/topo-v4/{z}/{x}/{y}.png?key=hTUZRiAhto38o94bZonV",
    {
      maxZoom: 20,
      tileSize: 512,
      zoomOffset: -1,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
        '&copy; <a href="https://www.maptiler.com/">MapTiler</a>'
    }
  ).addTo(map);

  marker = L.marker(DEFAULT_CENTER, { draggable: true }).addTo(map);

  marker.on("dragend", () => {
    const p = marker.getLatLng();
    updateCoords(p.lat, p.lng);
  });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        map.setView([latitude, longitude], 14);
        marker.setLatLng([latitude, longitude]);
        updateCoords(latitude, longitude);
      },
      () => updateCoords(DEFAULT_CENTER[0], DEFAULT_CENTER[1])
    );
  }

  setTimeout(() => map.invalidateSize(), 200);

  const findBtn = document.getElementById("btn-find-me");
  if (findBtn) {
    findBtn.onclick = () => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          map.setView([latitude, longitude], 15);
          marker.setLatLng([latitude, longitude]);
          updateCoords(latitude, longitude);
        },
        () => alert("GPS konnte nicht abgerufen werden.")
      );
    };
  }

  const saveBtn = document.getElementById("btn-save-report");
  if (saveBtn) saveBtn.onclick = saveSelectedReports;
}

function updateCoords(lat, lng) {
  const el = document.getElementById("coords-display");
  if (!el) return;
  el.textContent = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
}

// ------------------------------------------------------------------------
// SAVE REPORTS → SERVER (NORMAL FLOW)
// ------------------------------------------------------------------------

async function saveSelectedReports() {
  const entries = window._pendingSelections;
  if (!entries) return;

  const { lat, lng } = marker.getLatLng();
  const lat10 = Number(lat.toFixed(10));
  const lng10 = Number(lng.toFixed(10));

  let successCount = 0;
  let offlineCount = 0;

  for (const entry of entries) {
    const b = entry.bird;
    const actionKey = entry.action === "maybe" ? "maybe" : "sighted";

    const payload = {
      bird_name: b.name || "",
      bird_id: b.bird_id === "unringed" ? "" : b.bird_id,
      action: ACTION_IDS[actionKey],
      latitude: lat10,
      longitude: lng10,
      territory: b.territory || ""
    };

    if (!navigator.onLine) {
      addToOfflineQueue(payload);
      offlineCount++;
      continue;
    }

    try {
      await sendToServer(payload);
      successCount++;
    } catch (err) {
      console.error("Save error:", err);
    }
  }

  if (offlineCount && !successCount) {
    alert(
      offlineCount === 1
        ? "1 Beobachtung wurde lokal gespeichert und wird abgeschickt, sobald wieder Signal vorhanden ist."
        : `${offlineCount} Beobachtungen wurden lokal gespeichert und werden abgeschickt, sobald wieder Signal vorhanden ist.`
    );
  } else if (offlineCount && successCount) {
    alert(`${successCount} Beobachtungen wurden gesendet, ${offlineCount} weitere wurden lokal gespeichert (offline).`);
  } else {
    alert(`Gespeichert: ${successCount} Beobachtungen`);
  }

  closePopup("popup-report-bg");
  perBirdSelection.clear();
  renderBirds();
}

// ------------------------------------------------------------------------
// SERVER COMMUNICATION
// ------------------------------------------------------------------------

async function sendToServer(payload) {
  function fixNumber(n) {
    if (n === null || n === undefined) return null;
    const x = Number(n);
    return isNaN(x) ? null : x;
  }
  payload.latitude = fixNumber(payload.latitude);
  payload.longitude = fixNumber(payload.longitude);

  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error("Server not OK");
  return res.json();
}

// ------------------------------------------------------------------------
// LATEST OBSERVATIONS
// ------------------------------------------------------------------------

async function loadLatest() {
  openPopup("popup-latest-bg");

  const box = document.getElementById("latest-list");
  if (!box) return;
  box.textContent = "Lade...";

  try {
    const res = await fetch("/api/submit?mode=list");
    const rows = await res.json();

    box.innerHTML = "";

    rows.forEach(row => {
      const div = document.createElement("div");
      div.innerHTML = `
        <strong>${row.bird_name}</strong> – ${row.action}<br>
        ${row.date}<br>
        (${row.latitude}, ${row.longitude})<br>
      `;

      const del = document.createElement("button");
      del.textContent = "Delete";
      del.onclick = async () => {
        await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "delete", id: row.id })
        });
        loadLatest();
      };

      div.appendChild(del);
      box.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    box.textContent = "Fehler beim Laden.";
  }
}

// ------------------------------------------------------------------------
// POPUPS
// ------------------------------------------------------------------------

function openPopup(id) {
  document.getElementById(id).style.display = "flex";
}
function closePopup(id) {
  document.getElementById(id).style.display = "none";
}

// ========================================================================
// NEW: MANUAL SINGLE-BIRD ENTRY
// ========================================================================

function uniqNonEmpty(arr) {
  return [...new Set(arr.map(x => (x || "").trim()).filter(Boolean))];
}

function fillSelectOptions(selectEl, values) {
  if (!selectEl) return;
  selectEl.innerHTML = "";

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "—";
  selectEl.appendChild(empty);

  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

function normalizeTimeToHMS(t) {
  if (!t) return "";
  if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
  return t;
}

function setManualCoords(lat, lon, { moveMap = true } = {}) {
  const lat10 = Number(Number(lat).toFixed(10));
  const lon10 = Number(Number(lon).toFixed(10));

  const latEl = document.getElementById("manual-lat");
  const lonEl = document.getElementById("manual-lon");
  const disp = document.getElementById("manual-coords-display");

  if (latEl) latEl.value = String(lat10);
  if (lonEl) lonEl.value = String(lon10);
  if (disp) disp.textContent = `Lat: ${lat10.toFixed(6)}, Lng: ${lon10.toFixed(6)}`;

  if (manualMarker) manualMarker.setLatLng([lat10, lon10]);
  if (manualMap && moveMap) manualMap.setView([lat10, lon10], Math.max(manualMap.getZoom(), 14));
}

function initManualMap() {
  const mapDiv = document.getElementById("map-manual");
  if (!mapDiv) return;

  mapDiv.innerHTML = "";
  if (manualMap) manualMap.remove();

  manualMap = L.map("map-manual").setView(DEFAULT_CENTER, 12);

  L.tileLayer(
    "https://api.maptiler.com/maps/topo-v4/{z}/{x}/{y}.png?key=hTUZRiAhto38o94bZonV",
    {
      maxZoom: 20,
      tileSize: 512,
      zoomOffset: -1,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
        '&copy; <a href="https://www.maptiler.com/">MapTiler</a>'
    }
  ).addTo(manualMap);

  manualMarker = L.marker(DEFAULT_CENTER, { draggable: true }).addTo(manualMap);

  manualMarker.on("dragend", () => {
    const p = manualMarker.getLatLng();
    setManualCoords(p.lat, p.lng, { moveMap: false });
  });

  setManualCoords(DEFAULT_CENTER[0], DEFAULT_CENTER[1], { moveMap: false });

  const latEl = document.getElementById("manual-lat");
  const lonEl = document.getElementById("manual-lon");

  function tryApplyTypedCoords() {
    const lat = Number(latEl.value);
    const lon = Number(lonEl.value);
    if (isNaN(lat) || isNaN(lon)) return;
    setManualCoords(lat, lon, { moveMap: true });
  }

  if (latEl) latEl.onchange = tryApplyTypedCoords;
  if (lonEl) lonEl.onchange = tryApplyTypedCoords;

  const findBtn = document.getElementById("btn-manual-find-me");
  if (findBtn) {
    findBtn.onclick = () => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          setManualCoords(latitude, longitude, { moveMap: true });
        },
        () => alert("GPS konnte nicht abgerufen werden.")
      );
    };
  }

  setTimeout(() => manualMap.invalidateSize(), 200);
}

function openManualPopup() {
  if (!birds.length) {
    alert("CSV wird noch geladen – bitte kurz warten.");
    return;
  }

  const birdSel = document.getElementById("manual-bird");
  if (!birdSel) return;

  birdSel.innerHTML = "";
  birds.forEach(b => {
    const opt = document.createElement("option");
    opt.value = b.bird_id;
    opt.textContent = `${b.name} (${b.bird_id})`;
    birdSel.appendChild(opt);
  });

  fillSelectOptions(document.getElementById("manual-r-top"), uniqNonEmpty(birds.map(b => b.R_top)));
  fillSelectOptions(document.getElementById("manual-r-bottom"), uniqNonEmpty(birds.map(b => b.R_bottom)));
  fillSelectOptions(document.getElementById("manual-l-top"), uniqNonEmpty(birds.map(b => b.L_top)));
  fillSelectOptions(document.getElementById("manual-l-bottom"), uniqNonEmpty(birds.map(b => b.L_bottom)));

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  const dateEl = document.getElementById("manual-date");
  if (dateEl) dateEl.value = `${yyyy}-${mm}-${dd}`;

  birdSel.onchange = () => {
    const b = birds.find(x => x.bird_id === birdSel.value);
    if (!b) return;
    const rt = document.getElementById("manual-r-top");
    const rb = document.getElementById("manual-r-bottom");
    const lt = document.getElementById("manual-l-top");
    const lb = document.getElementById("manual-l-bottom");
    if (rt) rt.value = b.R_top || "";
    if (rb) rb.value = b.R_bottom || "";
    if (lt) lt.value = b.L_top || "";
    if (lb) lb.value = b.L_bottom || "";
  };
  birdSel.onchange();

  openPopup("popup-manual-bg");
  initManualMap();

  const saveBtn = document.getElementById("btn-manual-save");
  if (saveBtn) saveBtn.onclick = saveManualReport;
}

async function saveManualReport() {
  const dateVal = document.getElementById("manual-date")?.value || "";
  const timeVal = normalizeTimeToHMS(document.getElementById("manual-time")?.value || "");

  if (!dateVal) {
    alert("Bitte Datum eingeben.");
    return;
  }

  const birdId = document.getElementById("manual-bird")?.value || "";
  const b = birds.find(x => x.bird_id === birdId);
  if (!b) {
    alert("Bitte Vogel auswählen.");
    return;
  }

  const typ = Number(document.getElementById("manual-typ")?.value || ACTION_IDS.sighted);

  const rTop = document.getElementById("manual-r-top")?.value || "";
  const rBottom = document.getElementById("manual-r-bottom")?.value || "";
  const lTop = document.getElementById("manual-l-top")?.value || "";
  const lBottom = document.getElementById("manual-l-bottom")?.value || "";

  let lat, lng;
  if (manualMarker) {
    const p = manualMarker.getLatLng();
    lat = p.lat;
    lng = p.lng;
  } else {
    lat = Number(document.getElementById("manual-lat")?.value);
    lng = Number(document.getElementById("manual-lon")?.value);
  }

  const lat10 = Number(Number(lat).toFixed(10));
  const lng10 = Number(Number(lng).toFixed(10));

  if (isNaN(lat10) || isNaN(lng10)) {
    alert("Bitte gültige Koordinaten (lat/lon) eingeben.");
    return;
  }

  const payload = {
    bird_name: b.name || "",
    bird_id: b.bird_id || "",
    action: typ,
    latitude: lat10,
    longitude: lng10,
    territory: b.territory || "",

    // manual fields (new)
    date_manual: dateVal,
    time_manual: timeVal,

    // ring fields (optional extra, harmless if backend ignores)
    R_top: rTop,
    R_bottom: rBottom,
    L_top: lTop,
    L_bottom: lBottom
  };

  if (!navigator.onLine) {
    addToOfflineQueue(payload);
    alert("Beobachtung wurde lokal gespeichert und wird abgeschickt, sobald wieder Signal vorhanden ist.");
    closePopup("popup-manual-bg");
    return;
  }

  try {
    await sendToServer(payload);
    alert("Gespeichert.");
    closePopup("popup-manual-bg");
  } catch (err) {
    console.error("Manual save error:", err);
    alert("Fehler beim Speichern.");
  }
}
