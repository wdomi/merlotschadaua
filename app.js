/* ========================================================================
   Merlotschadaua – app.js
   Clean standalone JavaScript for index.html
   ======================================================================== */

console.log("app.js loaded");

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

// ------------------------------------------------------------------------
// Initialization
// ------------------------------------------------------------------------

window.addEventListener("load", () => {
  loadCSV();
  setupButtons();
  updateOfflineBanner();
  flushOfflineQueue();
});

// ------------------------------------------------------------------------
// CSV Loading
// ------------------------------------------------------------------------

function loadCSV() {
  fetch("/data/view_birdsCSV_apps.csv")
    .then((r) => r.text())
    .then(parseCSV)
    .then(() => {
      extractColors();
      buildColorButtons();
      renderBirds();
    })
    .catch((err) => console.error("CSV error:", err));
}

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (!lines.length) return;

  // Remove quotes from headers
  const header = lines[0]
    .split(",")
    .map(h => h.replace(/^"|"$/g, "").trim());

  for (let i = 1; i < lines.length; i++) {
    // Respect quoted CSV with commas inside
    const cols = lines[i]
      .match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
      .map(v => v.replace(/^"|"$/g, "").trim());

    if (!cols[0]) continue;

    const row = {};
    header.forEach((h, idx) => (row[h] = cols[idx] ?? ""));

    if (row.bird_id && row.bird_id !== "NULL") {
      birds.push(row);
    }
  }
}

// ------------------------------------------------------------------------
// Colors
// ------------------------------------------------------------------------

function extractColors() {
  birds.forEach((b) => {
    [b.R_top, b.R_bottom, b.L_top, b.L_bottom].forEach((c) => {
      if (c && c !== "NULL") colors.add(c);
    });
  });
}

function buildColorButtons() {
  const right = document.getElementById("right-leg");
  const left = document.getElementById("left-leg");

  colors.forEach((color) => {
    // Right
    const br = document.createElement("button");
    br.className = "color-button";
    br.style.background = color;
    br.onclick = () => toggleColor("right", color, br);
    right.appendChild(br);

    // Left
    const bl = document.createElement("button");
    bl.className = "color-button";
    bl.style.background = color;
    bl.onclick = () => toggleColor("left", color, bl);
    left.appendChild(bl);
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
// Filtering
// ------------------------------------------------------------------------

function birdMatches(b) {
  const rcolors = [b.R_top, b.R_bottom];
  const lcolors = [b.L_top, b.L_bottom];

  if (selectedRight.length > 0 && !selectedRight.some((c) => rcolors.includes(c))) return false;
  if (selectedLeft.length > 0 && !selectedLeft.some((c) => lcolors.includes(c))) return false;

  return true;
}

// ------------------------------------------------------------------------
// Table Rendering
// ------------------------------------------------------------------------

function renderBirds() {
  const body = document.getElementById("birds-body");
  body.innerHTML = "";

  birds.filter(birdMatches).forEach((b) => {
    const tr = document.createElement("tr");

    const dist = b["dist Punt dal Gal (m)"] || "";

    tr.innerHTML = `
      <td>${b.name || ""} <span class="tag">${b.bird_id}</span></td>
      <td>${b.sex || ""} / ${b.age || ""}</td>
      <td>${b.territory_name || b.territory || ""} (${dist}) / ${b.banded_on || ""}</td>
      <td>${b.R_top || ""}/${b.R_bottom || ""} – ${b.L_top || ""}/${b.L_bottom || ""}</td>
      <td>
        <button class="btn btn-primary" data-id="${b.bird_id}" data-action="sighted">beobachtet</button>
        <button class="btn btn-secondary" data-id="${b.bird_id}" data-action="maybe">unsicher</button>
      </td>
    `;

    body.appendChild(tr);
  });

  // Attach row button listeners
  document.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const action = btn.getAttribute("data-action");
      openReport(id, action);
    };
  });
}

// ------------------------------------------------------------------------
// Setup Main Buttons
// ------------------------------------------------------------------------

function setupButtons() {
  document.getElementById("btn-reset").onclick = resetFilters;

  document.getElementById("btn-report").onclick = () => {
    if (!currentBird) {
      alert("Bitte zuerst in der Liste einen Vogel auswählen.");
      return;
    }
    openReport(currentBird.bird.bird_id, currentBird.action);
  };

  document.getElementById("btn-unringed").onclick = () => {
    const pseudo = {
      bird_id: "unringed",
      name: "unberingt",
      territory_name: "",
    };
    openReportForBirdObj(pseudo, "maybe");
  };

  document.getElementById("btn-latest").onclick = loadLatest;
}

// ------------------------------------------------------------------------
// Reset
// ------------------------------------------------------------------------

function resetFilters() {
  selectedLeft = [];
  selectedRight = [];

  document.querySelectorAll(".color-button").forEach((b) => b.classList.remove("selected"));

  renderBirds();
}

// ------------------------------------------------------------------------
// Report Popup
// ------------------------------------------------------------------------

function openReport(bird_id, action) {
  const b = birds.find((x) => x.bird_id === bird_id);
  if (!b) return;

  openReportForBirdObj(b, action);
}

function openReportForBirdObj(bird, action) {
  currentBird = { bird, action };

  const info = document.getElementById("popup-bird-info");
  info.textContent = bird.bird_id === "unringed"
    ? "Unberingter Vogel"
    : `${bird.name} (${bird.bird_id})`;

  openPopup("popup-report-bg");
  initMap();
}

function initMap() {
  if (!map) {
    map = L.map("map").setView(DEFAULT_CENTER, 12);

    L.tileLayer(
      "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg",
      { maxZoom: 19 }
    ).addTo(map);

    marker = L.marker(DEFAULT_CENTER, { draggable: true }).addTo(map);
  }

  // GPS
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        map.setView([lat, lng], 13);
        marker.setLatLng([lat, lng]);
      },
      () => {
        map.setView(DEFAULT_CENTER, 12);
        marker.setLatLng(DEFAULT_CENTER);
      }
    );
  }

  setTimeout(() => {
    map.invalidateSize();
  }, 200);

  document.getElementById("btn-save-report").onclick = saveReport;
}

// ------------------------------------------------------------------------
// Save Report
// ------------------------------------------------------------------------

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
    alert("Offline – lokal gespeichert.");
    return;
  }

  try {
    await sendToServer(payload);
    closePopup("popup-report-bg");
    alert("Gespeichert.");
  } catch (err) {
    console.error(err);
    alert("Fehler beim Speichern.");
  }
}

// ------------------------------------------------------------------------
// Offline Queue
// ------------------------------------------------------------------------

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
      console.error("Failed to flush", err);
      return;
    }
  }

  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

function updateOfflineBanner() {
  // You can add an element if needed, left disabled intentionally
}

window.addEventListener("online", flushOfflineQueue);

// ------------------------------------------------------------------------
// Send To Server (Vercel function)
// ------------------------------------------------------------------------

async function sendToServer(payload) {
  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error("Server error");

  return res.json();
}

// ------------------------------------------------------------------------
// Latest Observations
// ------------------------------------------------------------------------

async function loadLatest() {
  openPopup("popup-latest-bg");

  const listEl = document.getElementById("latest-list");
  listEl.textContent = "Lade...";

  try {
    const res = await fetch("/api/submit?mode=list");
    const rows = await res.json();

    listEl.innerHTML = "";

    rows.forEach((row) => {
      const div = document.createElement("div");
      div.style.borderBottom = "1px solid #ddd";
      div.style.padding = "0.5rem 0";

      const actionLabel = row.action === "sighted" ? "beobachtet" : "unsicher";

      div.innerHTML = `
        <strong>${row.bird_id || "unringed"}</strong> – ${actionLabel}<br>
        ${row.date || ""}<br>
        (${row.latitude}, ${row.longitude})<br>
      `;

      const del = document.createElement("button");
      del.className = "btn btn-ghost";
      del.textContent = "Delete";
      del.onclick = async () => {
        if (!confirm("Löschen?")) return;

        await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "delete", id: row.id }),
        });

        loadLatest(); // Refresh
      };

      div.appendChild(del);
      listEl.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    listEl.textContent = "Fehler beim Laden.";
  }
}

// ------------------------------------------------------------------------
// Popup Controls
// ------------------------------------------------------------------------

function openPopup(id) {
  document.getElementById(id).style.display = "flex";
}

function closePopup(id) {
  document.getElementById(id).style.display = "none";
}
