/***************************************************************************
 * Merlotschadaua – FULL FINAL APP.JS (2025)
 * Mobile layout + AND filtering + stable Leaflet init + unringed fix.
 **************************************************************************/

console.log("Merlotschadaua app.js loaded");

// ------------------------------------------------------------------------
// GLOBAL STATE
// ------------------------------------------------------------------------

let birds = [];
let selectedRight = [];
let selectedLeft = [];
let currentBird = null;

let map = null;
let marker = null;

const DEFAULT_CENTER = [46.7000, 10.0833];
const CSV_URL = "/data/view_birdsCSV_apps.csv";

const OFFLINE_QUEUE_KEY = "merlotschadaua_offline_queue";

// FIXED COLOR PALETTE — matches your mobile UI
const COLOR_PALETTE = {
  alu:    "#808080",
  white:  "#eee",
  red:    "#e22c22",
  yellow: "#d6a51c",
  green:  "#227722",
  blue:   "#4b77b8",
  violet: "#6e009e",
  pink:   "#f58ac7",
  black:  "#222"
};

const COLOR_ORDER = [
  "alu","white","red","yellow","green","blue","pink","violet","black"
];

// ------------------------------------------------------------------------
// INITIALIZATION
// ------------------------------------------------------------------------

window.addEventListener("load", () => {
  console.log("Initializing app…");
  loadCSV();
  setupButtons();
  flushOfflineQueue();
});

// ------------------------------------------------------------------------
// CSV LOADING + PARSING
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
      console.log("CSV loaded:", birds.length, "rows");
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

  function idx(name) { return header.indexOf(name); }

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
    const textColor = (color === "white" ? "#000" : "#fff");

    const br = document.createElement("button");
    br.className = "color-button";
    br.textContent = color;
    br.style.background = hex;
    br.style.color = textColor;
    br.onclick = () => toggleColor("right", color, br);
    right.appendChild(br);

    const bl = document.createElement("button");
    bl.className = "color-button";
    bl.textContent = color;
    bl.style.background = hex;
    bl.style.color = textColor;
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
    if (arr.length === 2) return;      // max 2
    arr.push(color);
    btn.classList.add("selected");
  }

  renderBirds();
}

// ------------------------------------------------------------------------
// FILTERING — AND LOGIC
// ------------------------------------------------------------------------

function birdMatches(b) {
  const r = [b.R_top, b.R_bottom].filter(Boolean);
  const l = [b.L_top, b.L_bottom].filter(Boolean);

  if (selectedRight.length > 0) {
    if (!selectedRight.every(c => r.includes(c))) return false;
  }
  if (selectedLeft.length > 0) {
    if (!selectedLeft.every(c => l.includes(c))) return false;
  }

  return true;
}

// ------------------------------------------------------------------------
// RENDER TABLE
// ------------------------------------------------------------------------

function colorSpan(c) {
  if (!c) return "";
  const hex = COLOR_PALETTE[c] || "#777";
  const text = (c === "white" ? "#000" : "#fff");

  return `<span style="
      background:${hex};
      color:${text};
      padding:2px 4px;
      border-radius:4px;
      font-size:11px;
      display:inline-block;
    ">${c}</span>`;
}

function renderBirds() {
  const body = document.getElementById("birds-body");
  body.innerHTML = "";

  const visible = birds.filter(birdMatches);

  visible.forEach(b => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${b.name} <span class="tag">${b.bird_id}</span></td>
      <td>${b.sex}/${b.age}</td>
      <td>${b.territory} (${b.dist}) / ${b.banded_on}</td>
      <td>
        ${colorSpan(b.R_top)} /
        ${colorSpan(b.R_bottom)} –
        ${colorSpan(b.L_top)} /
        ${colorSpan(b.L_bottom)}
      </td>
      <td>
        <button class="submit-btn submit-btn-primary" data-id="${b.bird_id}" data-action="sighted">beobachtet</button>
        <button class="submit-btn submit-btn-ghost" data-id="${b.bird_id}" data-action="maybe">unsicher</button>
      </td>
    `;

    body.appendChild(tr);
  });

  document.querySelectorAll("button[data-id]").forEach((btn) => {
  btn.onclick = () => {
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    // update selection
    currentBird = {
      bird: birds.find(b => b.bird_id === id),
      action: action
    };

    // visual highlight
    document.querySelectorAll(`button[data-id="${id}"]`)
      .forEach(b => b.classList.remove("selected-action"));

    btn.classList.add("selected-action");
  };
});


// ------------------------------------------------------------------------
// SETUP BUTTONS
// ------------------------------------------------------------------------

function setupButtons() {
  document.getElementById("btn-reset").onclick = () => {
    selectedRight = [];
    selectedLeft = [];
    document.querySelectorAll(".color-button").forEach(b => b.classList.remove("selected"));
    renderBirds();
  };

  document.getElementById("btn-unringed").onclick = () => {
    openReportObject({
      bird_id: "unringed",
      name: "unberingt",
      territory: ""
    }, "maybe");
  };

document.getElementById("btn-report").onclick = () => {
  if (!currentBird) {
    alert("Bitte zuerst bei einem Vogel 'beobachtet' oder 'unsicher' wählen.");
    return;
  }
  openReportObject(currentBird.bird, currentBird.action);
};


  document.getElementById("btn-latest").onclick = loadLatest;
}

// ------------------------------------------------------------------------
// REPORT POPUP + FIXED MAP INIT
// ------------------------------------------------------------------------

function openReport(id, action) {
  const b = birds.find(x => x.bird_id === id);
  if (b) openReportObject(b, action);
}

function openReportObject(bird, action) {
  currentBird = { bird, action };

  document.getElementById("popup-bird-info").textContent =
    bird.bird_id === "unringed"
      ? "Unberingter Vogel"
      : `${bird.name} (${bird.bird_id})`;

  document.getElementById("coords-display").textContent = "Lat: — , Lng: —";

  openPopup("popup-report-bg");
  initMap();
}

function initMap() {
  const mapDiv = document.getElementById("map");

  // Reset container
  mapDiv.innerHTML = "";

  // Remove old map fully (fixes unringed map bug!)
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

  // Attempt GPS
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

  // Fix for mobile layout sizing
  setTimeout(() => map.invalidateSize(), 220);

  // “Find me”
  document.getElementById("btn-find-me").onclick = () => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 15);
        marker.setLatLng([pos.coords.latitude, pos.coords.longitude]);
        updateCoords(pos.coords.latitude, pos.coords.longitude);
      },
      () => alert("GPS konnte nicht abgerufen werden.")
    );
  };

  document.getElementById("btn-save-report").onclick = saveReport;
}

function updateCoords(lat, lng) {
  document.getElementById("coords-display").textContent =
    `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
}

// ------------------------------------------------------------------------
// SAVE REPORT
// ------------------------------------------------------------------------

async function saveReport() {
  if (!currentBird || !marker) return;

  const { lat, lng } = marker.getLatLng();
  const b = currentBird.bird;

  const payload = {
    bird_name: b.name || "",
    bird_id: b.bird_id,
    action: currentBird.action,
    latitude: lat,
    longitude: lng,
    territory: b.territory || ""
  };

  if (!navigator.onLine) {
    addToOfflineQueue(payload);
    closePopup("popup-report-bg");
    alert("Offline gespeichert.");
    return;
  }

  try {
    await sendToServer(payload);
    closePopup("popup-report-bg");
    alert("Beobachtung gespeichert.");
  } catch (err) {
    console.error(err);
    alert("Fehler beim Speichern.");
  }
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
      console.warn("Offline flush failed.");
      return;
    }
  }

  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

// ------------------------------------------------------------------------
// SERVER COMMUNICATION
// ------------------------------------------------------------------------

async function sendToServer(payload) {
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error("server error");
  return res.json();
}

// ------------------------------------------------------------------------
// LATEST OBSERVATIONS
// ------------------------------------------------------------------------

async function loadLatest() {
  openPopup("popup-latest-bg");

  const list = document.getElementById("latest-list");
  list.textContent = "Lade...";

  try {
    const res = await fetch("/api/submit?mode=list");
    const rows = await res.json();

    list.innerHTML = "";

    rows.forEach(r => {
      const div = document.createElement("div");

      div.innerHTML = `
        <strong>${r.bird_id}</strong> – ${r.action}<br>
        ${r.date}<br>
        (${r.latitude}, ${r.longitude})<br>
      `;

      const del = document.createElement("button");
      del.textContent = "Delete";
      del.onclick = async () => {
        await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "delete", id: r.id })
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
