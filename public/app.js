"use strict";

const STORAGE_KEY = "fiszki.decks.v1";
const $ = (id) => document.getElementById(id);

// ---------- Przechowywanie talii ----------

let decks = loadDecks();
let currentDeck = null;

function loadDecks() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveDecks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  } catch {
    // Brak dostępu do localStorage (np. tryb prywatny) — talie żyją tylko do odświeżenia strony.
  }
}

// ---------- Nawigacja ----------

function show(view) {
  for (const name of ["home", "deck", "study"]) {
    $(`view-${name}`).hidden = name !== view;
  }
  window.scrollTo(0, 0);
}

function goHome() {
  currentDeck = null;
  renderDeckList();
  show("home");
}

document.addEventListener("click", (e) => {
  const nav = e.target.closest("[data-nav]");
  if (!nav) return;
  if (nav.dataset.nav === "home") goHome();
  else if (currentDeck) openDeck(currentDeck);
});
$("home-link").addEventListener("click", (e) => {
  e.preventDefault();
  goHome();
});

// ---------- Widok startowy ----------

function plural(n) {
  if (n === 1) return "fiszka";
  const d = n % 10, h = n % 100;
  return d >= 2 && d <= 4 && !(h >= 12 && h <= 14) ? "fiszki" : "fiszek";
}

function renderDeckList() {
  const list = $("deck-list");
  list.replaceChildren();
  $("decks-section").hidden = decks.length === 0;
  for (const deck of decks) {
    const btn = document.createElement("button");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = deck.title;
    const info = document.createElement("span");
    info.className = "info";
    info.textContent = `${deck.cards.length} ${plural(deck.cards.length)}`;
    btn.append(name, info);
    btn.addEventListener("click", () => openDeck(deck));
    const li = document.createElement("li");
    li.append(btn);
    list.append(li);
  }
}

function setStatus(text, isError = false) {
  const el = $("gen-status");
  el.textContent = text;
  el.classList.toggle("error", isError);
}

$("gen-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const topic = $("topic").value.trim();
  if (!topic) return;

  const btn = $("gen-btn");
  btn.disabled = true;
  btn.textContent = "Generuję…";
  setStatus("Tworzę fiszki — to może potrwać kilkanaście sekund.");

  try {
    const res = await fetch("/api/flashcards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, count: $("count").value, level: $("level").value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Coś poszło nie tak. Spróbuj ponownie.");

    const deck = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      title: data.title || topic,
      topic,
      createdAt: Date.now(),
      cards: data.cards,
    };
    decks.unshift(deck);
    saveDecks();
    $("topic").value = "";
    setStatus("");
    openDeck(deck);
  } catch (err) {
    const offline = err instanceof TypeError;
    setStatus(offline ? "Brak połączenia z serwerem. Sprawdź, czy aplikacja jest uruchomiona." : err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Generuj fiszki";
  }
});

// ---------- Widok talii ----------

function makeCard(card) {
  const btn = document.createElement("button");
  btn.className = "card";
  btn.setAttribute("aria-label", "Odwróć fiszkę");
  const inner = document.createElement("span");
  inner.className = "card-inner";
  for (const [cls, label, text] of [
    ["front", "Pytanie", card.question],
    ["back", "Odpowiedź", card.answer],
  ]) {
    const face = document.createElement("span");
    face.className = `face ${cls}`;
    const small = document.createElement("small");
    small.textContent = label;
    const body = document.createElement("span");
    body.textContent = text;
    face.append(small, body);
    inner.append(face);
  }
  btn.append(inner);
  btn.addEventListener("click", () => btn.classList.toggle("flipped"));
  return btn;
}

function openDeck(deck) {
  currentDeck = deck;
  $("deck-title").textContent = deck.title;
  $("deck-meta").textContent =
    `${deck.cards.length} ${plural(deck.cards.length)} · ${new Date(deck.createdAt).toLocaleDateString("pl-PL")}`;
  $("card-grid").replaceChildren(...deck.cards.map(makeCard));
  show("deck");
}

$("delete-btn").addEventListener("click", () => {
  if (!currentDeck || !confirm(`Usunąć talię „${currentDeck.title}”?`)) return;
  decks = decks.filter((d) => d.id !== currentDeck.id);
  saveDecks();
  goHome();
});

$("export-btn").addEventListener("click", () => {
  if (!currentDeck) return;
  const cell = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const csv = currentDeck.cards.map((c) => `${cell(c.question)},${cell(c.answer)}`).join("\r\n");
  // BOM, żeby Excel poprawnie odczytał polskie znaki.
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${currentDeck.title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "fiszki"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// ---------- Tryb nauki ----------

const study = { queue: [], total: 0, repeats: 0 };

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function startStudy() {
  if (!currentDeck) return;
  study.queue = shuffle([...currentDeck.cards]);
  study.total = study.queue.length;
  study.repeats = 0;
  $("study-area").hidden = false;
  $("study-done").hidden = true;
  show("study");
  renderStudy();
}

function setFlipped(flipped) {
  $("study-card").classList.toggle("flipped", flipped);
  $("show-btn").hidden = flipped;
  $("again-btn").hidden = !flipped;
  $("know-btn").hidden = !flipped;
}

function renderStudy() {
  const done = study.total - study.queue.length;
  $("progress-bar").style.width = `${(done / study.total) * 100}%`;

  if (study.queue.length === 0) {
    $("study-count").textContent = "";
    $("study-area").hidden = true;
    $("study-done").hidden = false;
    $("done-text").textContent = study.repeats === 0
      ? `Wszystkie ${study.total} ${plural(study.total)} za pierwszym razem!`
      : `Opanowano ${study.total} ${plural(study.total)}. Powtórek po drodze: ${study.repeats}.`;
    return;
  }

  $("study-count").textContent = `Opanowane: ${done} z ${study.total}`;
  // Nowa fiszka pojawia się od razu pytaniem do góry — bez animacji, żeby nie mignęła odpowiedź.
  const card = $("study-card");
  card.classList.add("no-anim");
  setFlipped(false);
  $("study-q").textContent = study.queue[0].question;
  $("study-a").textContent = study.queue[0].answer;
  void card.offsetWidth;
  card.classList.remove("no-anim");
}

function answer(known) {
  const card = study.queue.shift();
  if (!known) {
    study.repeats++;
    study.queue.push(card); // wróci na końcu kolejki
  }
  renderStudy();
}

$("study-btn").addEventListener("click", startStudy);
$("restart-btn").addEventListener("click", startStudy);
$("study-card").addEventListener("click", () => setFlipped(!$("study-card").classList.contains("flipped")));
$("show-btn").addEventListener("click", () => setFlipped(true));
$("again-btn").addEventListener("click", () => answer(false));
$("know-btn").addEventListener("click", () => answer(true));

document.addEventListener("keydown", (e) => {
  if ($("view-study").hidden || $("study-area").hidden) return;
  const flipped = $("study-card").classList.contains("flipped");
  if (e.code === "Space") {
    e.preventDefault();
    setFlipped(!flipped);
  } else if (flipped && e.key === "1") {
    answer(false);
  } else if (flipped && e.key === "2") {
    answer(true);
  }
});

renderDeckList();
