/***************************************************************************
 * Merlotschadaua – FULL app.js (UNIFIED REPORT FLOW)
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
    .then(t => t.replace(/^\uFEFF/, ""))
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
  return `<span style="background:${hex};color:${text};padding:2px 4px;border-radius:4px;font-size:11px;">${c.slice(0,3)}</span>`;
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
        <button
          class="submit-btn submit-btn-ghost action-btn ${act==="sighted" ? "selected-action" : ""}"
          data-id="${b.bird_id}"
          data-action="sighted">
          beobachtet
        </button>
        <button
          class="submit-btn submit-btn-ghost action-btn ${act==="maybe" ? "selected-action" : ""}"
          data-id="${b.bird_id}"
          data-action="maybe">
          unsicher
        </button>
      </td>
    `;
    body.appendChild(tr);
  });

  // IMPORTANT: rebind click handlers every render
  document.querySelectorAll(".action-btn").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const current = perBirdSelection.get(id);

      if (current === action) {
        perBirdSelection.delete(id); // toggle off
      } else {
        perBirdSelection.set(id, action); // set / switch
      }

      renderBirds(); // re-render to update visuals
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

  document.getElementById("btn-report").onclick = openReportPopup;
  document.getElementById("btn-unringed").onclick = () => {
    perBirdSelection.clear();
    perBirdSelection.set("unringed", "sighted");
    openReportPopup();
  };

  document.getElementById("lnk-latest").onclick = e => {
    e.preventDefault();
    loadLatest();
  };
}

// ------------------------------------------------------------------------
// REPORT POPUP + MAP
// ------------------------------------------------------------------------

function openReportPopup() {
  if (!perBirdSelection.size) {
    alert("Bitte mindestens einen Vogel auswählen.");
    return;
  }

  const entries = [];
  for (const [bird_id, action] of perBirdSelection.entries()) {
    let b = bird_id === "unringed"
      ? { bird_id: "", name: "unberingt", territory: "" }
      : birds.find(x => x.bird_id === bird_id);
    if (b) entries.push({ bird: b, action });
  }

  window._pendingSelections = entries;

  document.getElementById("popup-bird-info").textContent =
    entries.length === 1
      ? `${entries[0].bird.name} (${entries[0].bird.bird_id || "unberingt"})`
      : `${entries.length} Vögel ausgewählt`;

  const now = new Date();
  document.getElementById("report-date").value = now.toISOString().slice(0,10);
  document.getElementById("report-time").value = now.toTimeString().slice(0,8);

  openPopup("popup-report-bg");
  initMap();
}

function initMap() {
  const mapDiv = document.getElementById("map");
  mapDiv.innerHTML = "";
  if (map) map.remove();

  map = L.map("map").setView(DEFAULT_CENTER, 12);

  L.tileLayer("https://api.maptiler.com/maps/topo-v4/{z}/{x}/{y}.png?key=hTUZRiAhto38o94bZonV", {
    maxZoom: 20,
    tileSize: 512,
    zoomOffset: -1
  }).addTo(map);

  marker = L.marker(DEFAULT_CENTER, { draggable: true }).addTo(map);
  marker.on("dragend", () => {
    const p = marker.getLatLng();
    updateCoords(p.lat, p.lng);
  });

  updateCoords(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);

  const latEl = document.getElementById("report-lat");
  const lonEl = document.getElementById("report-lon");

  function applyTypedCoords() {
    const lat = Number(latEl.value);
    const lon = Number(lonEl.value);
    if (!isNaN(lat) && !isNaN(lon)) {
      marker.setLatLng([lat, lon]);
      map.setView([lat, lon]);
    }
  }

  latEl.onchange = applyTypedCoords;
  lonEl.onchange = applyTypedCoords;

  document.getElementById("btn-find-me").onclick = () => {
    navigator.geolocation.getCurrentPosition(pos => {
      marker.setLatLng([pos.coords.latitude, pos.coords.longitude]);
      map.setView([pos.coords.latitude, pos.coords.longitude], 15);
      updateCoords(pos.coords.latitude, pos.coords.longitude);
    });
  };

  setTimeout(() => map.invalidateSize(), 200);
}

function updateCoords(lat, lng) {
  document.getElementById("report-lat").value = lat.toFixed(10);
  document.getElementById("report-lon").value = lng.toFixed(10);
}

// ------------------------------------------------------------------------
// SAVE REPORTS
// ------------------------------------------------------------------------

async function saveSelectedReports() {
  const entries = window._pendingSelections;
  const lat = Number(document.getElementById("report-lat").value);
  const lng = Number(document.getElementById("report-lon").value);

  const dateVal = document.getElementById("report-date").value;
  const timeVal = document.getElementById("report-time").value;

  for (const entry of entries) {
    const payload = {
      bird_name: entry.bird.name,
      bird_id: entry.bird.bird_id,
      action: ACTION_IDS[entry.action],
      latitude: lat,
      longitude: lng,
      territory: entry.bird.territory || "",
      date_manual: dateVal,
      time_manual: timeVal
    };

    if (!navigator.onLine) {
      addToOfflineQueue(payload);
      continue;
    }

    await sendToServer(payload);
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
  if (!res.ok) throw new Error("Server error");
}

// ------------------------------------------------------------------------
// LATEST OBSERVATIONS
// ------------------------------------------------------------------------

async function loadLatest() {
  openPopup("popup-latest-bg");
  const box = document.getElementById("latest-list");
  box.textContent = "Lade...";

  try {
    const r = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "list" })
    });

    const rows = await r.json();
    box.innerHTML = "";

    rows.forEach(row => {
      const div = document.createElement("div");
      div.innerHTML = `<strong>${row.bird_name}</strong> – ${row.action}<br>
        (${row.latitude}, ${row.longitude})`;
      box.appendChild(div);
    });

  } catch {
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
