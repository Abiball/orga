/* ============================================================
   ABIBALL '27 TRACKER – app.js
   ============================================================ */

/* ── CONFIG – hier anpassen ─────────────────────────────── */
const CLASS_PASSWORD = "abiball2027";

const MEMBERS = ["Adele", "Alexander", "Annika", "Carl", "Casey", "Cian", "Clemens", "Daniel", "Emilio", "Felix", "Finlay", "Florentine", "Hanna", "Hannah", "Heidi", "Henriette", "Ida", "Jessica", "Jonas", "Jonatan", "Josefine", "Julia", "Lara", "Laura", "Lena M.", "Lena W.", "Leon", "Leonie", "Luisa", "Luise P.", "Luise R.", "Mark", "Miriam", "Mya", "Nathalie", "Nele", "Paul", "Ruslan", "Salomon", "Tobias", "Vasyl", "Vienna"];

/* ── SUPABASE CONFIG ────────────────────────────────────── */
const SUPABASE_URL = "https://wjmvineibznokelncndm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqbXZpbmVpYnpub2tlbG5jbmRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzcyMzYsImV4cCI6MjA4OTUxMzIzNn0.7wZiQOk93wTS3pSo-0y3Pr9s5D9LeR3fDWrjzlpmi-A";
const USE_SUPABASE = true;

/* ── STATE ──────────────────────────────────────────────── */
let currentUser = null;
let allEntries  = []; // [{id, name, category, note, created_at}]

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
  const newEntry = { ...entry, id: Date.now(), created_at: entry.created_at || new Date().toISOString() };
  entries.unshift(newEntry);
  localStorage.setItem("abiball_entries", JSON.stringify(entries));
  return newEntry;
}

async function updateEntry(id, data) {
  if (USE_SUPABASE) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/entries?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      console.error("Supabase Update Error:", err);
      throw new Error(err.message || "Update failed");
    }
    return;
  }
  let entries = JSON.parse(localStorage.getItem("abiball_entries") || "[]");
  entries = entries.map(e => e.id == id ? { ...e, ...data } : e);
  localStorage.setItem("abiball_entries", JSON.stringify(entries));
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
  setInterval(loadAndRender, 60_000);
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
    map[m] = { name: m, entries: 0, cats: {} };
  });
  allEntries.forEach(e => {
    if (!map[e.name]) map[e.name] = { name: e.name, entries: 0, cats: {} };
    map[e.name].entries++;
    map[e.name].cats[e.category] = (map[e.name].cats[e.category] || 0) + 1;
  });
  return Object.values(map).sort((a, b) => b.entries - a.entries);
}

function topCat(cats) {
  let top = null, max = 0;
  Object.entries(cats).forEach(([c, count]) => { if (count > max) { max = count; top = c; } });
  return { cat: top, count: max };
}

function catSlug(c) {
  if (!c) return "default";
  return c.toString().replace(/\s+/g, "-").toLowerCase();
}

/* ── RENDER ─────────────────────────────────────────────── */

const DEFAULT_CATS = ["Deko", "Abimotto - Abizeitung", "Finanzen", "Mottowoche", "Sponsoren", "Schülerkonzert", "Abiball", "Verkauf"];

function renderDashboard() {
  const users = aggregateByUser();
  const me    = users.find(u => u.name === currentUser) || { entries: 0, cats: {} };

  // My stats
  document.getElementById("myEntryCount").textContent = me.entries;

  const tc = topCat(me.cats);
  document.getElementById("myTopCat").textContent      = tc.cat || "–";
  document.getElementById("myTopCatEntries").textContent = tc.cat ? tc.count + " Aktionen geloggt" : "Noch kein Eintrag";

  // Category breakdown bars
  const usedCustomCats = Object.keys(me.cats).filter(c => !DEFAULT_CATS.includes(c));
  const displayCats    = [...DEFAULT_CATS, ...usedCustomCats];

  const maxE = Math.max(...Object.values(me.cats), 1);
  const bd   = document.getElementById("catBreakdown");
  bd.innerHTML = "";
  displayCats.forEach(c => {
    const count = me.cats[c] || 0;
    const p = Math.round((count / maxE) * 100);
    bd.innerHTML += `
      <div class="flex items-center gap-3">
        <span class="cat-pill cat-${catSlug(c)} w-28 text-center shrink-0">${c}</span>
        <div class="flex-1 progress-track h-1.5">
          <div class="progress-fill h-1.5" style="width:${count > 0 ? p : 0}%"></div>
        </div>
        <span class="text-xs text-slate-400 w-14 text-right shrink-0">${count > 0 ? count : "–"}</span>
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
        <td class="px-4 py-3 lb-name-col">
          <span class="lb-name font-medium ${isMe ? "grad-text" : "text-slate-200"}">${u.name}${isMe ? " (du)" : ""}</span>
        </td>
        <td class="px-4 py-3 text-right font-display font-bold text-white">${u.entries}</td>
        <td class="px-4 py-3 hide-mobile">
          ${tc.cat
            ? `<span class="cat-pill cat-${catSlug(tc.cat)}">${tc.cat}</span>`
            : '<span class="text-slate-600">–</span>'}
        </td>
      </tr>`;
  });
}

function renderRecent() {
  const mine = allEntries.filter(e => e.name === currentUser).slice(0, 10);
  const el   = document.getElementById("recentEntries");
  if (mine.length === 0) {
    el.innerHTML = '<p class="text-slate-500 text-sm">Noch keine Einträge. Logge deine erste Aktion!</p>';
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
          <p class="text-xs text-slate-600 mt-0.5">
            <span class="date-text">${dateStr}</span>
            <span class="date-icon" title="${dateStr}">📅</span>
          </p>
        </div>
        <div class="flex items-center gap-4">
          <button
            onclick="event.stopPropagation(); editEntry(${e.id})"
            class="text-indigo-400/60 hover:text-indigo-400 transition-colors p-1"
            title="Eintrag bearbeiten"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onclick="event.stopPropagation(); confirmDelete(${e.id})"
            class="text-red-400/60 hover:text-red-400 text-2xl leading-none transition-colors p-1"
            title="Eintrag löschen"
          >×</button>
        </div>
      </div>`;
  }).join("");
}

async function confirmDelete(id) {
  const entry = allEntries.find(e => e.id == id);
  if (!entry) return;
  const label = `${entry.category}${entry.note ? " · " + entry.note : ""}`;
  if (!confirm(`Diesen Eintrag wirklich löschen?\n\n"${label}"`)) return;
  await deleteEntry(id);
  showToast("Eintrag gelöscht.");
  loadAndRender();
}

function editEntry(id) {
  const entry = allEntries.find(e => e.id == id);
  if (!entry) return;

  document.getElementById("editEntryId").value = entry.id;
  document.getElementById("modalTitle").textContent = "Eintrag bearbeiten";
  document.getElementById("submitBtn").textContent = "Speichern ✓";

  document.getElementById("inputDate").value = new Date(entry.created_at).toISOString().slice(0, 10);
  
  if (DEFAULT_CATS.includes(entry.category)) {
    document.getElementById("inputCategory").value = entry.category;
    document.getElementById("customCategoryWrapper").style.display = "none";
  } else {
    document.getElementById("inputCategory").value = "custom";
    document.getElementById("inputCustomCategory").value = entry.category;
    document.getElementById("customCategoryWrapper").style.display = "block";
  }
  
  document.getElementById("inputNote").value = entry.note || "";
  document.getElementById("trackModal").classList.add("open");
}

/* ── MODAL ──────────────────────────────────────────────── */

function openModal() {
  document.getElementById("editEntryId").value = "";
  document.getElementById("modalTitle").textContent = "Aktion eintragen";
  document.getElementById("submitBtn").textContent = "Eintragen ✓";
  
  document.getElementById("trackModal").classList.add("open");
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById("inputDate").value = today;
}

function openUserModal(name) {
  const modal = document.getElementById("userModal");
  const title = document.getElementById("userModalTitle");
  const stats = document.getElementById("userModalStats");
  const body  = document.getElementById("userEntriesBody");

  const entries = allEntries.filter(e => e.name === name);

  title.textContent = `Einträge von ${name}`;
  stats.textContent = `${entries.length} Einträge gesamt`;

  if (entries.length === 0) {
    body.innerHTML = '<tr><td colspan="3" class="py-8 text-center text-slate-500">Noch keine Einträge vorhanden.</td></tr>';
  } else {
    body.innerHTML = entries.map(e => {
      const d = new Date(e.created_at);
      const dateStr = d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
      return `
        <tr class="border-b border-slate-800/30 hover:bg-slate-800/20">
          <td class="py-3 px-2 text-slate-400 whitespace-nowrap">
            <span class="date-text">${dateStr}</span>
            <span class="date-icon" title="${dateStr}">📅</span>
          </td>
          <td class="py-3 px-2">
            <span class="cat-pill cat-${catSlug(e.category)} scale-90 origin-left">${e.category}</span>
          </td>
          <td class="py-3 px-2 text-slate-500 max-w-[200px] truncate" title="${e.note}">${e.note || "–"}</td>
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
  document.getElementById("editEntryId").value   = "";
  document.getElementById("inputDate").value     = "";
  document.getElementById("inputCategory").value = "";
  document.getElementById("inputNote").value     = "";
  document.getElementById("inputCustomCategory").value = "";
  document.getElementById("customCategoryWrapper").style.display = "none";
}

async function submitEntry() {
  const editId  = document.getElementById("editEntryId").value;
  const dateVal = document.getElementById("inputDate").value;
  let cat       = document.getElementById("inputCategory").value;
  const note    = document.getElementById("inputNote").value.trim();

  if (cat === "custom") {
    cat = document.getElementById("inputCustomCategory").value.trim();
  }

  if (!dateVal)            { showToast("Bitte Datum wählen.");    return; }
  if (!cat)                { showToast("Bitte Kategorie wählen."); return; }

  const entryDate = new Date(dateVal);
  const now = new Date();
  entryDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

  const data = {
    name:       currentUser,
    category:   cat,
    note:       note || "",
    created_at: entryDate.toISOString()
  };

  if (editId) {
    await updateEntry(editId, data);
    showToast("Eintrag aktualisiert!");
  } else {
    await pushEntry(data);
    showToast(`✓ Aktion in "${cat}" eingetragen!`);
  }

  closeModal();
  loadAndRender();
}

/* ── CSV EXPORT ─────────────────────────────────────────── */

function exportCSV() {
  const rows = [["Datum", "Name", "Kategorie", "Notiz"]];
  const sorted = [...allEntries].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  sorted.forEach(e => {
    const d = new Date(e.created_at).toISOString().slice(0, 10);
    rows.push([d, e.name, e.category, (e.note || "").replace(/;/g, ",")]);
  });

  const csv = rows.map(r => r.join(";")).join("\n");
  const a   = document.createElement("a");
  a.href    = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csv);
  a.download = `abiball_alle_eintraege_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast("CSV exportiert!");
}

/* ── TOAST ──────────────────────────────────────────────── */

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

/* ── STARTUP ────────────────────────────────────────────── */

const savedUser = sessionStorage.getItem("abiball_user");
if (savedUser) {
  currentUser = savedUser;
  updateUserDisplay(savedUser);
  document.getElementById("loginOverlay").classList.remove("open");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("fabBtn").classList.remove("hidden");
  initApp();
}

document.getElementById("trackModal").addEventListener("click", function (e) {
  if (e.target === this) closeModal();
});
document.getElementById("userModal").addEventListener("click", function (e) {
  if (e.target === this) closeUserModal();
});
document.getElementById("loginPw").addEventListener("keydown", e => {
  if (e.key === "Enter") handleLogin();
});

populateLoginNames();
