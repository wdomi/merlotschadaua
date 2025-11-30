/***************************************************************************
 * Merlotschadaua – FINAL APP.JS (Option C: Multi-Bird Selection)
 * Clean, stable, mobile UI compatible, Leaflet fixed, multi-select logic.
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
// bird_id → "sighted" | "maybe" | null

let map = null;
let marker = null;

const DEFAULT_CENTER = [46.7000, 10.0833];
const CSV_URL = "/data/view_birdsCSV_apps.csv";

const OFFLINE_QUEUE_KEY = "merlotschadaua_offline_queue";

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

window.addEventListener("load", () => {
  console.log("Initializing app…");
  loadCSV();
  setupButtons();
  flushOfflineQueue();
});

// ------------------------------------------------------------------------
// CSV LOADING
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
      console.log("Loaded", birds.length, "birds");
    })
    .catch(err => {
      console.error("CSV error:", err);
      alert("CSV konnte nicht geladen werden.");
    });
}

function stripBOM(text) {
  return text.replace(/^\uFEFF/, "");
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0]
    .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
    .map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());

  const idx = key => header.indexOf(key);

  const out = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;

    const cols = raw
      .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
      .map(v => v.replace(/^"|"$/g, "").trim());

    const row = {
      bird_id: cols[idx("bird_id")] || "",
      name: cols[idx("name")] || "",
      sex: cols[idx("sex")] || "",
      age: cols[idx("age")] || "",
      R_top: (cols[idx("r_top")] || "").toLowerCase(),
      R_bottom: (cols[idx("r_bottom")] || "").toLowerCase(),
      L_top: (cols[idx("l_top")] || "").toLowerCase(),
      L_bottom: (cols[idx("l_bottom")] || "").toLowerCase(),
      territory: cols[idx("territory_name")] || cols[idx("territory")] || "",
      dist: cols[idx("dist punt dal gal (m)")] || "",
      banded_on: cols[idx("banded_on")] || ""
    };

    if (row.bird_id) out.push(row);
  }

  return out;
}

// ------------------------------------------------------------------------
// COLOR BUTTONS
// ------------------------------------------------------------------------

function buildColorButtons() {
  const right = document.getElementById("right-leg");
  const left = document.getElementById("left-leg");

  right.innerHTML = "";
  left.innerHTML = "";

  COLOR_ORDER.forEach(color => {
    const hex = COLOR_PALETTE[color];
    const text = color === "white" ? "#000" : "#fff";

    const br = document.createElement("button");
    br.className = "color-button";
    br.textContent = color;
    br.style.background = hex;
    br.style.color = text;
    br.onclick = () => toggleColor("right", color, br);
    right.appendChild(br);

    const bl = document.createElement("button");
    bl.className = "color-button";
    bl.textContent = color;
    bl.style.background = hex;
    bl.style.color = text;
    bl.onclick = () => toggleColor("left", color, bl);
    left.appendChild(bl);
  });
}

function toggleColor(side, color, btn) {
  const arr = side === "right" ? selectedRight : selectedLeft;

  if (arr.includes(color)) {
    arr.splice(arr.indexOf(color), 1);
    btn.classList.remove("selected");
  } else {
    if (arr.length >= 2) return;
    arr.push(color);
    btn.classList.add("selected");
  }

  renderBirds();
}

// ------------------------------------------------------------------------
// FILTERING (AND-logic)
// ------------------------------------------------------------------------

function birdMatches(b) {
  const R = [b.R_top, b.R_bottom].filter(Boolean);
  const L = [b.L_top, b.L_bottom].filter(Boolean);

  if (selectedRight.length > 0) {
    if (!selectedRight.every(c => R.includes(c))) return false;
  }
  if (selectedLeft.length > 0) {
    if (!selectedLeft.every(c => L.includes(c))) return false;
  }

  return true;
}

// ------------------------------------------------------------------------
// TABLE RENDERING (multi-select logic)
// ------------------------------------------------------------------------

function colorPill(c) {
  if (!c) return "";
  const hex = COLOR_PALETTE[c] || "#777";
  const text = c === "white" ? "#000" : "#fff";

  return `<span style="
    background:${hex};
    color:${text};
    padding:2px 4px;
    border-radius:4px;
    font-size:11px;
    margin-right:2px;
  ">${c}</span>`;
}

function renderBirds() {
  const body = document.getElementById("birds-body");
  body.innerHTML = "";

  birds.filter(birdMatches).forEach(b => {
    const tr = document.createElement("tr");

    const act = perBirdSelection.get(b.bird_id) || null;

    tr.innerHTML = `
      <td>${b.name} <div class="tag">${b.bird_id}</div></td>
      <td>${b.sex}/${b.age}</td>
      <td>${b.territory} (${b.dist}) / ${b.banded_on}</td>
      <td>
        ${colorPill(b.R_top)} / ${colorPill(b.R_bottom)} –
        ${colorPill(b.L_top)} / ${colorPill(b.L_bottom)}
      </td>
      <td>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <button 
            class="submit-btn submit-btn-ghost ${act === "sighted" ? "selected-action" : ""}" 
            data-id="${b.bird_id}" 
            data-action="sighted"
          >beobachtet</button>

          <button 
            class="submit-btn submit-btn-ghost ${act === "maybe" ? "selected-action" : ""}" 
            data-id="${b.bird_id}" 
            data-action="maybe"
          >unsicher</button>
        </div>
      </td>
    `;

    body.appendChild(tr);
  });

  document.querySelectorAll("button[data-id]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;

      const current = perBirdSelection.get(id) || null;

      if (current === action) {
        perBirdSelection.delete(id);
      } else {
        perBirdSelection.set(id, action);
      }

      renderBirds();
    };
  });
}

// ------------------------------------------------------------------------
// TOP BUTTON LOGIC
// ------------------------------------------------------------------------

function setupButtons() {
  document.getElementById("btn-reset").onclick = () => {
    selectedLeft = [];
    selectedRight = [];
    perBirdSelection.clear();

    document.querySelectorAll(".color-button").forEach(b => b.classList.remove("selected"));
    renderBirds();
  };

  document.getElementById("btn-unringed").onclick = () => {
    perBirdSelection.clear();
    perBirdSelection.set("unringed", "maybe");
    openConfirmationPopup();
  };

  document.getElementById("btn-report").onclick = openConfirmationPopup;

  document.getElementById("btn-latest").onclick = loadLatest;
}

// ------------------------------------------------------------------------
// CONFIRMATION POPUP → MAP POPUP
// ------------------------------------------------------------------------

function openConfirmationPopup() {
  const entries = [];

  for (const [bird_id, action] of perBirdSelection.entries()) {
    if (!action) continue;

    if (bird_id === "unringed") {
      entries.push({
        bird: { bird_id: "unringed", name: "unberingt", territory: "" },
        action
      });
    } else {
      const b = birds.find(x => x.bird_id === bird_id);
      if (b) entries.push({ bird: b, action });
    }
  }

  if (entries.length === 0) {
    alert("Bitte zuerst mindestens einen Vogel mit 'beobachtet' oder 'unsicher' markieren.");
    return;
  }

  // save selection globally
  window._pendingSelections = entries;

  // open map popup
  openReportPopup(entries);
}

function openReportPopup(entries) {
  // show first bird name (or number of birds)
  if (entries.length === 1) {
    const b = entries[0].bird;
    document.getElementById("popup-bird-info").textContent =
      b.bird_id === "unringed" ? "Unberingter Vogel" : `${b.name} (${b.bird_id})`;
  } else {
    document.getElementById("popup-bird-info").textContent =
      `${entries.length} Vögel ausgewählt`;
  }

  openPopup("popup-report-bg");
  initMap();
}

// ------------------------------------------------------------------------
// MAP POPUP (Leaflet)
// ------------------------------------------------------------------------

function initMap() {
  const mapDiv = document.getElementById("map");

  mapDiv.innerHTML = "";

  if (map) {
    map.remove();
    map = null;
  }

  map = L.map("map").setView(DEFAULT_CENTER, 12);

  L.tileLayer(
    "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
    { maxZoom: 19 }
  ).addTo(map);

  marker = L.marker(DEFAULT_CENTER, { draggable: true }).addTo(map);

  marker.on("dragend", () => {
    const { lat, lng } = marker.getLatLng();
    updateCoords(lat, lng);
  });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        map.setView([lat, lng], 14);
        marker.setLatLng([lat, lng]);
        updateCoords(lat, lng);
      },
      () => updateCoords(DEFAULT_CENTER[0], DEFAULT_CENTER[1])
    );
  }

  setTimeout(() => map.invalidateSize(), 200);

  document.getElementById("btn-find-me").onclick = () => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        map.setView([lat, lng], 15);
        marker.setLatLng([lat, lng]);
        updateCoords(lat, lng);
      },
      () => alert("GPS konnte nicht abgerufen werden.")
    );
  };

  document.getElementById("btn-save-report").onclick = saveSelectedReports;
}

function updateCoords(lat, lng) {
  document.getElementById("coords-display").textContent =
    `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
}

// ------------------------------------------------------------------------
// SAVE REPORTS (multi-entry submission)
// ------------------------------------------------------------------------

async function saveSelectedReports() {
  if (!window._pendingSelections || !marker) return;

  const { lat, lng } = marker.getLatLng();

  let successCount = 0;

  for (const entry of window._pendingSelections) {
    const b = entry.bird;

    const payload = {
      bird_name: b.name || "",
      bird_id: b.bird_id === "unringed" ? null : b.bird_id,
      action: entry.action,
      latitude: lat,
      longitude: lng,
      territory: b.territory || ""
    };

    if (!navigator.onLine) {
      addToOfflineQueue(payload);
      continue;
    }

    try {
      await sendToServer(payload);
      successCount++;
    } catch (err) {
      console.error("Save error:", err);
    }
  }

  alert(`Gespeichert: ${successCount} Beobachtungen`);
  closePopup("popup-report-bg");
  perBirdSelection.clear();
  renderBirds();
}

// ------------------------------------------------------------------------
// OFFLINE QUEUE
// ------------------------------------------------------------------------

function addToOfflineQueue(entry) {
  const q = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
  q.push(entry);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
}

async function flushOfflineQueue() {
  if (!navigator.onLine) return;

  const q = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
  if (!q.length) return;

  for (const entry of q) {
    try {
      await sendToServer(entry);
    } catch {
      console.warn("Queue flush failed");
      return;
    }
  }

  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

// ------------------------------------------------------------------------
// SERVER COMMUNICATION
// ------------------------------------------------------------------------

async function sendToServer(payload) {

  // --- FIX GPS TYPES ----
  function fixNumber(n) {
    if (n === null || n === undefined) return null;
    const x = Number(n);
    return isNaN(x) ? null : x;
  }

  payload.latitude  = fixNumber(payload.latitude);
  payload.longitude = fixNumber(payload.longitude);

  // Also fix action (ensure numeric 4519311/4519312)
  payload.action = Number(payload.action);

  // -----------------------

  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error("Server response not OK");
  return res.json();
}


// ------------------------------------------------------------------------
// LATEST OBS
// ------------------------------------------------------------------------

async function loadLatest() {
  openPopup("popup-latest-bg");

  const list = document.getElementById("latest-list");
  list.textContent = "Lade...";

  try {
    const res = await fetch("/api/submit?mode=list");
    const rows = await res.json();

    list.innerHTML = "";

    rows.forEach(row => {
      const div = document.createElement("div");

      div.innerHTML = `
        <strong>${row.bird_id}</strong> – ${row.action}<br>
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
      list.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    list.textContent = "Fehler beim Laden.";
  }
}

// ------------------------------------------------------------------------
// POPUP UTILS
// ------------------------------------------------------------------------

function openPopup(id) {
  document.getElementById(id).style.display = "flex";
}

function closePopup(id) {
  document.getElementById(id).style.display = "none";
}
