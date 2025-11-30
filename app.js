/***************************************************************************
 * Merlotschadaua – Full Working app.js
 * Clean, validated, fully functional version
 **************************************************************************/

console.log("Merlotschadaua app.js loaded");

// ------------------------------------------------------------------------
// Global State
// ------------------------------------------------------------------------

let birds = [];
let colors = new Set();
let selectedRight = [];
let selectedLeft = [];
let currentBird = null; // { bird, action }
let map = null;
let marker = null;

const DEFAULT_CENTER = [46.7000, 10.0833]; // Zernez fallback
const OFFLINE_QUEUE_KEY = "merlotschadaua_offline_queue";

// ========================================================================
// INITIALIZATION
// ========================================================================

window.addEventListener("load", () => {
  console.log("Initializing app…");
  loadCSV();
  setupMainButtons();
  flushOfflineQueue();
});

// ========================================================================
// CSV LOADING + PARSING
// ========================================================================

function loadCSV() {
  console.log("Loading CSV…");

  fetch("/data/view_birdsCSV_apps.csv")
    .then((r) => r.text())
    .then(parseCSV)
    .then(() => {
      console.log("CSV parsed:", birds.length, "birds loaded");
      extractColors();
      buildColorButtons();
      renderBirds();
    })
    .catch((err) => {
      console.error("CSV failed to load:", err);
      alert("CSV konnte nicht geladen werden.");
    });
}

/**
 * Fully robust CSV parser:
 * - Handles quoted headers
 * - Handles quoted fields
 * - Handles commas inside quotes
 * - Converts "NULL" → ""
 */
function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (!lines.length) return;

  // Extract header row correctly
  const header = lines[0]
    .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
    .map((h) => h.replace(/^"|"$/g, "").trim());

  // Process each row
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const cols = lines[i]
      .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
      .map((v) => {
        v = v.replace(/^"|"$/g, "").trim();
        return v === "NULL" ? "" : v;
      });

    const row = {};
    header.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });

    if (row.bird_id && row.bird_id !== "") {
      birds.push(row);
    }
  }
}

// ========================================================================
// COLOR EXTRACTION + BUTTONS
// ========================================================================

// text color for rings' list
function colorToCSS(c) {
  if (!c) return "black";

  const lower = c.toLowerCase();

  if (lower === "white" || lower === "whi") return "#d5d5d5";   // slightly lighter grey
  if (lower === "alu") return "#8a8a8a";                        // aluminum grey
  if (lower === "yellow" || lower === "yel") return "#c7a400";  // darker yellow
  if (lower === "silver") return "#aaa";

  return lower; // use raw color name for others
}

function coloredLabel(c) {
  if (!c) return "";
  const hex = colorToHex(c);
  return `<span style="
      background:${hex};
      color:white;
      padding:2px 6px;
      border-radius:4px;
      font-weight:600;
      font-size:13px;
      display:inline-block;
    ">${c}</span>`;
}


function extractColors() {
  colors.clear();

  birds.forEach((b) => {
    [b.R_top, b.R_bottom, b.L_top, b.L_bottom].forEach((c) => {
      if (c && c !== "NULL" && c !== "") colors.add(c);
    });
  });

  console.log("Extracted colors:", Array.from(colors));
}

function buildColorButtons() {
  const orderedColors = [
    "alu",
    "black",
    "blue",
    "pink",
    "red",
    "violet",
    "white",
    "yellow",
    "green",
  ];

  orderedColors.forEach((color, index) => {
    const hex = colorToHex(color);

    // RIGHT LEG
    const rSlot = document.getElementById(`right-${index + 1}`);
    const rBtn = document.createElement("button");
    rBtn.className = "color-button";
    rBtn.style.background = hex;
    rBtn.textContent = color;
    rBtn.onclick = () => toggleColor("right", color, rBtn);
    rSlot.appendChild(rBtn);

    // LEFT LEG
    const lSlot = document.getElementById(`left-${index + 1}`);
    const lBtn = document.createElement("button");
    lBtn.className = "color-button";
    lBtn.style.background = hex;
    lBtn.textContent = color;
    lBtn.onclick = () => toggleColor("left", color, lBtn);
    lSlot.appendChild(lBtn);
  });
}



function colorToHex(c) {
  const map = {
    white: "#f3f3f3",
    whi: "#f3f3f3",
    alu: "#8a8a8a",
    red: "#e53935",
    blue: "#5586c1",
    pink: "#f48ac2",
    yellow: "#d4a72c",
    yel: "#d4a72c",
    green: "#2c7d2c",
    gre: "#2c7d2c",
    violet: "#6b008b",
    vio: "#6b008b",
    black: "#222",
    bla: "#222",
  };

  const key = c.toLowerCase();
  return map[key] ?? "#999"; // fallback grey
}


function toggleColor(side, color, btn) {
  const selected = side === "right" ? selectedRight : selectedLeft;

  if (selected.includes(color)) {
    selected.splice(selected.indexOf(color), 1);
    btn.classList.remove("selected");
  } else {
    if (selected.length === 2) return; // Max 2 colors per leg
    selected.push(color);
    btn.classList.add("selected");
  }

  console.log("Filter:", selectedRight, selectedLeft);
  renderBirds();
}

// ========================================================================
// FILTERING
// ========================================================================

function birdMatches(b) {
  const r = [b.R_top, b.R_bottom];
  const l = [b.L_top, b.L_bottom];

  // RIGHT LEG — AND logic
  if (selectedRight.length > 0) {
    const allRightMatch = selectedRight.every((c) => r.includes(c));
    if (!allRightMatch) return false;
  }

  // LEFT LEG — AND logic
  if (selectedLeft.length > 0) {
    const allLeftMatch = selectedLeft.every((c) => l.includes(c));
    if (!allLeftMatch) return false;
  }

  return true;
}

// ========================================================================
// TABLE RENDERING
// ========================================================================

function renderBirds() {
  const body = document.getElementById("birds-body");
  body.innerHTML = "";

  const visible = birds.filter(birdMatches);

  visible.forEach((b) => {
    const tr = document.createElement("tr");

    const dist = b["dist Punt dal Gal (m)"] || "";

    tr.innerHTML = `
      <td>${b.name} <span class="tag">${b.bird_id}</span></td>
      <td>${b.sex}/${b.age}</td>
      <td>${b.territory_name} (${dist}) / ${b.banded_on}</td>
      <td>
        ${coloredLabel(b.R_top)} / ${coloredLabel(b.R_bottom)} – ${coloredLabel(b.L_top)} / ${coloredLabel(b.L_bottom)}
      </td>
      <td>
        <button class="btn btn-primary" data-id="${b.bird_id}" data-action="sighted">beobachtet</button>
        <button class="btn btn-secondary" data-id="${b.bird_id}" data-action="maybe">unsicher</button>
      </td>
    `;

    body.appendChild(tr);
  });

  // Add handlers
  document.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      openReport(id, action);
    };
  });

  console.log("Rendered", visible.length, "birds");
}

// ========================================================================
// MAIN BUTTONS
// ========================================================================

function setupMainButtons() {
  document.getElementById("btn-reset").onclick = () => {
    selectedLeft = [];
    selectedRight = [];
    document
      .querySelectorAll(".color-button")
      .forEach((b) => b.classList.remove("selected"));
    renderBirds();
  };

  document.getElementById("btn-unringed").onclick = () => {
    const pseudo = {
      bird_id: "unringed",
      name: "unberingt",
      territory_name: "",
    };
    openReportObject(pseudo, "maybe");
  };

  document.getElementById("btn-report").onclick = () => {
    if (!currentBird) {
      alert("Bitte zuerst einen Vogel auswählen.");
      return;
    }
    openReportObject(currentBird.bird, currentBird.action);
  };

  document.getElementById("btn-latest").onclick = loadLatest;
}

// ========================================================================
// REPORT POPUP + MAP
// ========================================================================

function openReport(id, action) {
  const b = birds.find((x) => x.bird_id === id);
  if (!b) return;
  openReportObject(b, action);
}

function openReportObject(bird, action) {
  currentBird = { bird, action };

  const info = document.getElementById("popup-bird-info");
  info.textContent =
    bird.bird_id === "unringed"
      ? "Unberingter Vogel"
      : `${bird.name} (${bird.bird_id})`;

  openPopup("popup-report-bg");
  initMap();
}

function updateCoordsDisplay(lat, lng) {
  const el = document.getElementById("coords-display");
  if (!el) return;
  el.textContent = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
}

function initMap() {
  if (!map) {
    map = L.map("map").setView(DEFAULT_CENTER, 12);

    L.tileLayer(
      "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
      { maxZoom: 19 }
    ).addTo(map);

    marker = L.marker(DEFAULT_CENTER, { draggable: true }).addTo(map);

    // Update coordinates when marker is dragged
    marker.on("dragend", () => {
      const { lat, lng } = marker.getLatLng();
      updateCoordsDisplay(lat, lng);
    });
  }

  // Initial GPS attempt
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        map.setView([lat, lng], 13);
        marker.setLatLng([lat, lng]);
        updateCoordsDisplay(lat, lng);
      },
      () => {
        map.setView(DEFAULT_CENTER, 12);
        marker.setLatLng(DEFAULT_CENTER);
        updateCoordsDisplay(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
      }
    );
  } else {
    map.setView(DEFAULT_CENTER, 12);
    marker.setLatLng(DEFAULT_CENTER);
    updateCoordsDisplay(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
  }

  // Ensure map renders correctly
  setTimeout(() => map.invalidateSize(), 150);

  // Save report button
  document.getElementById("btn-save-report").onclick = saveReport;

  // FIND ME BUTTON
  const findMeBtn = document.getElementById("btn-find-me");
  if (findMeBtn) {
    findMeBtn.onclick = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setView([lat, lng], 15);
            marker.setLatLng([lat, lng]);
            updateCoordsDisplay(lat, lng);
          },
          () => alert("GPS konnte nicht abgerufen werden.")
        );
      } else {
        alert("GPS wird von diesem Gerät nicht unterstützt.");
      }
    };
  }
}

// ========================================================================
// SAVE REPORT
// ========================================================================

async function saveReport() {
  if (!currentBird || !marker) return;

  const { lat, lng } = marker.getLatLng();
  const b = currentBird.bird;

  const payload = {
    mode: "create",
    bird_name: b.name || (b.bird_id === "unringed" ? "unringed" : ""),
    bird_id: b.bird_id,
    action: currentBird.action,
    latitude: lat,
    longitude: lng,
    territory: b.territory_name || b.territory || "",
  };

  if (!navigator.onLine) {
    addToOfflineQueue(payload);
    closePopup("popup-report-bg");
    alert("Offline – Beobachtung lokal gespeichert.");
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

// ========================================================================
// OFFLINE QUEUE
// ========================================================================

function addToOfflineQueue(entry) {
  const list = getOfflineQueue();
  list.push({ entry, ts: Date.now() });
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(list));
}

function getOfflineQueue() {
  const s = localStorage.getItem(OFFLINE_QUEUE_KEY);
  if (!s) return [];
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}

async function flushOfflineQueue() {
  if (!navigator.onLine) return;
  const list = getOfflineQueue();
  if (!list.length) return;

  for (const item of list) {
    try {
      await sendToServer(item.entry);
    } catch (err) {
      console.warn("Failed flushing offline queue");
      return;
    }
  }

  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

// ========================================================================
// SERVER COMMUNICATION
// ========================================================================

async function sendToServer(payload) {
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Server returned error:", text);
    throw new Error("Server error");
  }

  return res.json();
}

// ========================================================================
// LATEST OBSERVATIONS
// ========================================================================

async function loadLatest() {
  openPopup("popup-latest-bg");

  const list = document.getElementById("latest-list");
  list.textContent = "Lade...";

  try {
    const res = await fetch("/api/submit?mode=list");
    const rows = await res.json();

    list.innerHTML = "";

    rows.forEach((row) => {
      const div = document.createElement("div");
      div.style.borderBottom = "1px solid #ddd";
      div.style.padding = "0.5rem 0";

      div.innerHTML = `
        <strong>${row.bird_id}</strong> – ${row.action}<br>
        ${row.date || ""}<br>
        (${row.latitude}, ${row.longitude})<br>
      `;

      const del = document.createElement("button");
      del.className = "btn btn-ghost";
      del.textContent = "Delete";
      del.onclick = async () => {
        await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "delete", id: row.id }),
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

// ========================================================================
// POPUPS
// ========================================================================

function openPopup(id) {
  document.getElementById(id).style.display = "flex";
}

function closePopup(id) {
  document.getElementById(id).style.display = "none";
}
