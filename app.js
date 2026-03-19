/* ============================================================
   ABIBALL '27 TRACKER – app.js
   ============================================================ */

/* ── CONFIG – hier anpassen ─────────────────────────────── */
const CLASS_PASSWORD = "abiball2027"; // ← Klassenpasswort ändern

const MEMBERS = ["Adele", "Alexander", "Annika", "Carl", "Casey", "Cian", "Clemens", "Daniel", "Emilio", "Felix", "Finlay", "Florentine", "Hanna", "Hannah", "Heidi", "Henriette", "Ida", "Jessica", "Jonas", "Jonatan", "Josefine", "Julia", "Lara", "Laura", "Lena M.", "Lena W.", "Leon", "Leonie", "Luisa", "Luise P.", "Luise R.", "Mark", "Miriam", "Mya", "Nathalie", "Nele", "Paul", "Ruslan", "Salomon", "Tobias", "Vasyl", "Vienna"];
  // ← Namen der Klasse anpassen


/* ── SUPABASE CONFIG ────────────────────────────────────── */
const SUPABASE_URL = "https://wjmvineibznokelncndm.supabase.co"; // ← ersetzen
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqbXZpbmVpYnpub2tlbG5jbmRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzcyMzYsImV4cCI6MjA4OTUxMzIzNn0.7wZiQOk93wTS3pSo-0y3Pr9s5D9LeR3fDWrjzlpmi-A";                    // ← ersetzen
const USE_SUPABASE = true; // → auf true setzen wenn bereit

/* Stunden-Ziel der gesamten Stufe (für Fortschrittsbalken) */
const HOUR_GOAL = 500;

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ── STATE ──────────────────────────────────────────────── */
let currentUser = null;
let allEntries  = []; // [{id, name, hours, category, note, created_at}]

/* ── DATA LAYER (Supabase / localStorage fallback) ──────── */

async function fetchAllEntries() {
  if (USE_SUPABASE) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/entries?select=*&order=created_at.desc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    return await res.json();
  }
  return JSON.parse(localStorage.getItem("abiball_entries") || "[]");
}

async function pushEntry(entry) {
  if (USE_SUPABASE) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/entries`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(entry)
    });
    return await res.json();
  }
  const entries = JSON.parse(localStorage.getItem("abiball_entries") || "[]");
  const newEntry = { ...entry, id: Date.now(), created_at: new Date().toISOString() };
  entries.unshift(newEntry);
  localStorage.setItem("abiball_entries", JSON.stringify(entries));
  return newEntry;
}

async function deleteEntry(id) {
  if (USE_SUPABASE) {
    await fetch(`${SUPABASE_URL}/rest/v1/entries?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    return;
  }
  const entries = JSON.parse(localStorage.getItem("abiball_entries") || "[]");
  localStorage.setItem("abiball_entries", JSON.stringify(entries.filter(e => e.id !== id)));
}

/* ── AUTH ───────────────────────────────────────────────── */

function updateUserDisplay(name) {
  document.querySelectorAll(".currentUserDisplay").forEach(el => {
    el.textContent = name;
  });
}

function handleLogin() {
  const name = document.getElementById("loginName").value.trim();
  const pw   = document.getElementById("loginPw").value;
  if (!name || pw !== CLASS_PASSWORD) {
    document.getElementById("loginErr").classList.remove("hidden");
    return;
  }
  currentUser = name;
  sessionStorage.setItem("abiball_user", name);
  updateUserDisplay(name);
  document.getElementById("loginOverlay").classList.remove("open");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("fabBtn").classList.remove("hidden");
  initApp();
}

function handleLogout() {
  sessionStorage.removeItem("abiball_user");
  currentUser = null;
  document.getElementById("loginOverlay").classList.add("open");
  document.getElementById("app").classList.add("hidden");
  document.getElementById("fabBtn").classList.add("hidden");
}

/* ── INIT ───────────────────────────────────────────────── */

function initApp() {
  populateLoginNames();
  loadAndRender();
  setInterval(loadAndRender, 60_000); // Auto-refresh jede Minute
}

function populateLoginNames() {
  const sel = document.getElementById("loginName");
  MEMBERS.forEach(m => {
    if (!sel.querySelector(`option[value="${m}"]`)) {
      const o = document.createElement("option");
      o.value = o.textContent = m;
      sel.appendChild(o);
    }
  });
}

async function loadAndRender() {
  allEntries = await fetchAllEntries();
  renderDashboard();
  renderLeaderboard();
  renderRecent();
}

/* ── DATA HELPERS ───────────────────────────────────────── */

function aggregateByUser() {
  const map = {};
  MEMBERS.forEach(m => {
    map[m] = { name: m, totalHours: 0, entries: 0, cats: {} };
  });
  allEntries.forEach(e => {
    if (!map[e.name]) map[e.name] = { name: e.name, totalHours: 0, entries: 0, cats: {} };
    map[e.name].totalHours += e.hours;
    map[e.name].entries++;
    map[e.name].cats[e.category] = (map[e.name].cats[e.category] || 0) + e.hours;
  });
  return Object.values(map).sort((a, b) => b.totalHours - a.totalHours);
}

function topCat(cats) {
  let top = null, max = 0;
  Object.entries(cats).forEach(([c, h]) => { if (h > max) { max = h; top = c; } });
  return { cat: top, hours: max };
}

function fmtH(h) {
  const whole = Math.floor(h);
  const mins  = Math.round((h - whole) * 60);
  return mins > 0 ? `${whole}h ${mins}m` : `${whole}h`;
}

function catSlug(c) {
  if (!c) return "default";
  return c.toString().replace(/\s+/g, "-").toLowerCase();
}

/* ── RENDER ─────────────────────────────────────────────── */

const DEFAULT_CATS = ["Deko", "Abimotto - Abizeitung", "Finanzen", "Mottowoche", "Sponsoren", "Schülerkonzert", "Abiball", "Verkauf"];

function renderDashboard() {
  const users = aggregateByUser();
  const grand = users.reduce((s, u) => s + u.totalHours, 0);
  const me    = users.find(u => u.name === currentUser) || { totalHours: 0, entries: 0, cats: {} };
  const rank  = users.findIndex(u => u.name === currentUser) + 1;

  // Global progress
  const pct = Math.min(100, (grand / HOUR_GOAL) * 100).toFixed(1);
  ["globalProgressBar", "globalProgressBarMobile"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.width = pct + "%";
  });
  document.getElementById("totalHoursLabel").textContent       = fmtH(grand);
  document.getElementById("totalHoursLabelMobile").textContent = fmtH(grand);

  // My stats
  document.getElementById("myHoursDisplay").textContent = Math.floor(me.totalHours);
  document.getElementById("myEntryCount").textContent   = me.entries;

  const tc = topCat(me.cats);
  document.getElementById("myTopCat").textContent      = tc.cat || "–";
  document.getElementById("myTopCatHours").textContent = tc.cat ? fmtH(tc.hours) + " investiert" : "Noch kein Eintrag";

  // Rank badge
  const rb = document.getElementById("myRankBadge");
  rb.textContent = rank || "–";
  rb.className   = "rank-badge " + (rank === 1 ? "rank-1" : rank === 2 ? "rank-2" : rank === 3 ? "rank-3" : "rank-other");
  document.getElementById("myRankText").textContent = rank
    ? `Platz ${rank} von ${users.filter(u => u.totalHours > 0).length || 1}`
    : "Noch kein Eintrag";

  // Category breakdown bars
  // Show default categories + any custom ones the user has actually used
  const usedCustomCats = Object.keys(me.cats).filter(c => !DEFAULT_CATS.includes(c));
  const displayCats    = [...DEFAULT_CATS, ...usedCustomCats];

  const maxH = Math.max(...Object.values(me.cats), 0.01);
  const bd   = document.getElementById("catBreakdown");
  bd.innerHTML = "";
  displayCats.forEach(c => {
    const h = me.cats[c] || 0;
    const p = Math.round((h / maxH) * 100);
    bd.innerHTML += `
      <div class="flex items-center gap-3">
        <span class="cat-pill cat-${catSlug(c)} w-28 text-center shrink-0">${c}</span>
        <div class="flex-1 progress-track h-1.5">
          <div class="progress-fill h-1.5" style="width:${h > 0 ? p : 0}%"></div>
        </div>
        <span class="text-xs text-slate-400 w-14 text-right shrink-0">${h > 0 ? fmtH(h) : "–"}</span>
      </div>`;
  });
}

function renderLeaderboard() {
  const users = aggregateByUser();
  const tbody = document.getElementById("leaderboardBody");
  tbody.innerHTML = "";
  users.forEach((u, i) => {
    const rank      = i + 1;
    const isMe      = u.name === currentUser;
    const tc        = topCat(u.cats);
    const rankClass = rank === 1 ? "rank-1" : rank === 2 ? "rank-2" : rank === 3 ? "rank-3" : "rank-other";
    tbody.innerHTML += `
      <tr class="lb-row ${isMe ? "bg-indigo-500/5" : ""} cursor-pointer hover:bg-slate-800/30 transition-colors" onclick="openUserModal('${u.name}')">
        <td class="px-4 py-3">
          <div class="rank-badge ${rankClass}">${rank}</div>
        </td>
        <td class="px-4 py-3">
          <span class="lb-name font-medium ${isMe ? "grad-text" : "text-slate-200"}">${u.name}${isMe ? " (du)" : ""}</span>
        </td>
        <td class="px-4 py-3 text-right font-display font-bold text-white">${fmtH(u.totalHours)}</td>
        <td class="px-4 py-3 hide-mobile">
          ${tc.cat
            ? `<span class="cat-pill cat-${catSlug(tc.cat)}">${tc.cat}</span>`
            : '<span class="text-slate-600">–</span>'}
        </td>
        <td class="px-4 py-3 text-right text-slate-400 hide-mobile">${u.entries}</td>
      </tr>`;
  });
}

function renderRecent() {
  const mine = allEntries.filter(e => e.name === currentUser).slice(0, 8);
  const el   = document.getElementById("recentEntries");
  if (mine.length === 0) {
    el.innerHTML = '<p class="text-slate-500 text-sm">Noch keine Einträge. Trag deine ersten Stunden ein!</p>';
    return;
  }
  el.innerHTML = mine.map(e => {
    const d       = new Date(e.created_at);
    const dateStr = d.toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
    return `
      <div class="flex items-start gap-3 py-2 border-b border-slate-800 last:border-0 group">
        <span class="cat-pill cat-${catSlug(e.category)} mt-0.5 shrink-0">${e.category}</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-slate-300 truncate">${e.note || "Kein Kommentar"}</p>
          <p class="text-xs text-slate-600 mt-0.5">${dateStr}</p>
        </div>
        <span class="font-display font-bold text-white text-sm shrink-0">${fmtH(e.hours)}</span>
        <button
          onclick="event.stopPropagation(); confirmDelete(${e.id})"
          class="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity
                 text-slate-600 hover:text-red-400 text-lg leading-none ml-1"
          title="Eintrag löschen"
        >×</button>
      </div>`;
  }).join("");
}

async function confirmDelete(id) {
  const entry = allEntries.find(e => e.id === id);
  if (!entry) return;
  const label = `${fmtH(entry.hours)} · ${entry.category}${entry.note ? " · " + entry.note : ""}`;
  if (!confirm(`Diesen Eintrag wirklich löschen?\n\n"${label}"\n\nDas kann nicht rückgängig gemacht werden.`)) return;
  await deleteEntry(id);
  showToast("Eintrag gelöscht.");
  loadAndRender();
}

/* ── MODAL ──────────────────────────────────────────────── */

function openModal() {
  document.getElementById("trackModal").classList.add("open");
}

function openUserModal(name) {
  const modal = document.getElementById("userModal");
  const title = document.getElementById("userModalTitle");
  const stats = document.getElementById("userModalStats");
  const body  = document.getElementById("userEntriesBody");

  const entries = allEntries.filter(e => e.name === name);
  const total   = entries.reduce((s, e) => s + e.hours, 0);

  title.textContent = `Einträge von ${name}`;
  stats.textContent = `${fmtH(total)} gesamt · ${entries.length} Einträge`;

  if (entries.length === 0) {
    body.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-slate-500">Noch keine Einträge vorhanden.</td></tr>';
  } else {
    body.innerHTML = entries.map(e => {
      const d = new Date(e.created_at);
      const dateStr = d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
      return `
        <tr class="border-b border-slate-800/30 hover:bg-slate-800/20">
          <td class="py-3 px-2 text-slate-400 whitespace-nowrap">${dateStr}</td>
          <td class="py-3 px-2">
            <span class="cat-pill cat-${catSlug(e.category)} scale-90 origin-left">${e.category}</span>
          </td>
          <td class="py-3 px-2 text-right font-display font-bold text-slate-200">${fmtH(e.hours)}</td>
          <td class="py-3 px-2 hide-mobile text-slate-500 max-w-[150px] truncate" title="${e.note}">${e.note || "–"}</td>
        </tr>`;
    }).join("");
  }

  modal.classList.add("open");
}

function closeUserModal() {
  document.getElementById("userModal").classList.remove("open");
}

function toggleCustomCategory(val) {
  const wrapper = document.getElementById("customCategoryWrapper");
  if (val === "custom") {
    wrapper.style.display = "block";
  } else {
    wrapper.style.display = "none";
  }
}

function closeModal() {
  document.getElementById("trackModal").classList.remove("open");
  document.getElementById("inputHours").value    = "";
  document.getElementById("inputMinutes").value  = "";
  document.getElementById("inputCategory").value = "";
  document.getElementById("inputNote").value     = "";
  document.getElementById("inputCustomCategory").value = "";
  document.getElementById("customCategoryWrapper").style.display = "none";
}

async function submitEntry() {
  const h    = parseFloat(document.getElementById("inputHours").value)   || 0;
  const m    = parseFloat(document.getElementById("inputMinutes").value) || 0;
  let cat    = document.getElementById("inputCategory").value;
  const note = document.getElementById("inputNote").value.trim();

  if (cat === "custom") {
    cat = document.getElementById("inputCustomCategory").value.trim();
  }

  if (h === 0 && m === 0) { showToast("Bitte Zeit eingeben.");    return; }
  if (!cat)                { showToast("Bitte Kategorie wählen."); return; }

  const totalH = h + m / 60;

  await pushEntry({
    name:     currentUser,
    hours:    Math.round(totalH * 100) / 100,
    category: cat,
    note:     note || ""
  });

  closeModal();
  showToast(`✓ ${fmtH(totalH)} in "${cat}" eingetragen!`);
  loadAndRender();
}

/* ── CSV EXPORT ─────────────────────────────────────────── */

function exportCSV() {
  // Jetzt werden ALLE Einträge exportiert
  const rows = [["Datum", "Name", "Kategorie", "Stunden", "Notiz"]];

  // Sortiert nach Datum absteigend
  const sorted = [...allEntries].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  sorted.forEach(e => {
    const d = new Date(e.created_at).toISOString().slice(0, 10);
    rows.push([d, e.name, e.category, e.hours.toFixed(2), (e.note || "").replace(/;/g, ",")]);
  });

  const csv = rows.map(r => r.join(";")).join("\n");
  const a   = document.createElement("a");
  a.href    = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csv);
  a.download = `abiball_alle_eintraege_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast("CSV exportiert (Alle Einträge)!");
}

/* ── TOAST ──────────────────────────────────────────────── */

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

/* ── STARTUP ────────────────────────────────────────────── */

populateLoginNames();

// Session wiederherstellen
const savedUser = sessionStorage.getItem("abiball_user");
if (savedUser) {
  currentUser = savedUser;
  updateUserDisplay(savedUser);
  document.getElementById("loginOverlay").classList.remove("open");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("fabBtn").classList.remove("hidden");
  initApp();
}

// Modal schließen bei Klick auf Overlay-Hintergrund
document.getElementById("trackModal").addEventListener("click", function (e) {
  if (e.target === this) closeModal();
});
document.getElementById("userModal").addEventListener("click", function (e) {
  if (e.target === this) closeUserModal();
});

// Enter im Passwort-Feld → Login
document.getElementById("loginPw").addEventListener("keydown", e => {
  if (e.key === "Enter") handleLogin();
});
