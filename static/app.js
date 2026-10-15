(() => {
  const $ = (selector) => document.querySelector(selector);
  // Local-only mode: each browser/device stores its own data.
  let transactions = [];
  const localKey = "violet_transactions_v1";
  const goalsKey = "violet_savings_goals_v1";
  let savingsGoals = readGoals();
  const today = new Date();
  const categoryOptions = {
    income: ["Uang jajan", "Diberi orang tua/keluarga", "Freelance", "Kerja part-time", "Beasiswa", "Jualan", "Hadiah", "Cashback", "Lainnya"],
    expense: ["Jajan/makanan", "Transportasi", "Kuota/internet", "Alat tulis", "Print/fotokopi", "Kebutuhan sekolah", "Kas kelas/organisasi", "Nongkrong/hiburan", "Top up/game", "Belanja", "Tabungan", "Lainnya"]
  };
  const kindInput = $("#kind");
  const categoryInput = $("#category");
  let editingTransactionId = null;
  function updateCategoryOptions(preserve = true) {
    const previous = preserve ? categoryInput.value : "";
    const options = categoryOptions[kindInput.value] || categoryOptions.expense;
    categoryInput.replaceChildren(...options.map(category => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      return option;
    }));
    if (options.includes(previous)) categoryInput.value = previous;
  }
  kindInput.addEventListener("change", () => updateCategoryOptions(false));
  updateCategoryOptions(false);
  $("#today-label").textContent = today.toLocaleDateString("id-ID", {
    weekday: "short", day: "numeric", month: "short", year: "numeric"
  });
  $("#transaction-date").value = today.toISOString().slice(0, 10);

  // Format nominal live while typing, using Indonesian thousands separators.
  const amountInput = $("#amount");
  amountInput.addEventListener("input", () => {
    const oldValue = amountInput.value;
    const oldCursor = amountInput.selectionStart ?? oldValue.length;
    const digitsBeforeCursor = oldValue.slice(0, oldCursor).replace(/\D/g, "").length;
    const digits = oldValue.replace(/\D/g, "");
    const formatted = digits ? Number(digits).toLocaleString("id-ID", { maximumFractionDigits: 0 }) : "";
    amountInput.value = formatted;

    // Keep the caret beside the same digit so editing in the middle stays usable.
    let cursor = 0;
    let digitCount = 0;
    while (cursor < formatted.length && digitCount < digitsBeforeCursor) {
      if (/\d/.test(formatted[cursor])) digitCount++;
      cursor++;
    }
    amountInput.setSelectionRange(cursor, cursor);
  });
  amountInput.addEventListener("blur", () => {
    const digits = amountInput.value.replace(/\D/g, "");
    amountInput.value = digits ? Number(digits).toLocaleString("id-ID", { maximumFractionDigits: 0 }) : "";
  });

  const rupiah = (value) => new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0
  }).format(Number(value) || 0);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
  const localRead = () => {
    try { return JSON.parse(localStorage.getItem(localKey) || "[]"); }
    catch { return []; }
  };
  const localWrite = () => localStorage.setItem(localKey, JSON.stringify(transactions));
  
  const setMessage = (selector, message, error = false) => {
    const node = $(selector);
    if (!node) {
      console.warn("Elemen pesan tidak ditemukan:", selector);
      return;
    }
    node.textContent = message ?? "";
    node.style.color = error ? "#ff8d9a" : "";
  };


  async function loadTransactions() {
    transactions = localRead().map(normalizeTransaction);
    renderTransactions();
  }

  function renderTransactions() {
    const query = (($("#transaction-search") || {}).value || "").trim().toLocaleLowerCase("id-ID");
    const filter = $("#transaction-filter") ? $("#transaction-filter").value : "all";
    const matches = transactions.filter(t => {
      const haystack = `${t.category || ""} ${t.note || ""} ${t.transaction_date || t.date || ""} ${t.amount || ""}`.toLocaleLowerCase("id-ID");
      return (!query || haystack.includes(query)) && (filter === "all" || t.kind === filter);
    });
    const incomeTransactions = matches.filter(t => t.kind === "income");
    const expenseTransactions = matches.filter(t => t.kind === "expense");

    // Tampilkan hanya riwayat sesuai filter yang dipilih.
    const incomeHeading = $("#income-transaction-list").previousElementSibling;
    const expenseHeading = $("#expense-transaction-list").previousElementSibling;
    incomeHeading.hidden = filter === "expense";
    $("#income-transaction-list").hidden = filter === "expense";
    expenseHeading.hidden = filter === "income";
    $("#expense-transaction-list").hidden = filter === "income";
    const income = incomeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = expenseTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    $("#balance-value").textContent = rupiah(income - expenses);
    $("#income-value").textContent = rupiah(income);
    $("#expense-value").textContent = rupiah(expenses);
    $("#income-count").textContent = `${incomeTransactions.length} transaksi`;
    $("#expense-count").textContent = `${expenseTransactions.length} transaksi`;

    const renderList = (selector, rows, kind) => {
      const list = $(selector);
      if (!rows.length) {
        list.innerHTML = `<div class="empty-state">Belum ada ${kind === "income" ? "pemasukan" : "pengeluaran"} yang dicatat.</div>`;
        return;
      }
      list.innerHTML = rows.slice(0, 60).map(t => {
        const isIncome = kind === "income";
        const symbol = isIncome ? "+" : "−";
        const date = t.transaction_date || t.date || "";
        return `<div class="transaction-item">
          <div class="category-orb">${isIncome ? "↗" : "↘"}</div>
          <div class="transaction-info"><strong>${escapeHtml(t.category || "Lainnya")}</strong>
            <small>${escapeHtml(t.note || (isIncome ? "Pemasukan" : "Pengeluaran"))} · ${escapeHtml(date)}</small></div>
          <div class="transaction-side"><span class="transaction-amount ${isIncome ? "income" : "expense"}">${symbol}${rupiah(t.amount)}</span>
            <div class="transaction-actions"><button class="edit-btn" data-edit="${escapeHtml(t.id)}" type="button">Edit</button><button class="delete-btn" data-delete="${escapeHtml(t.id)}" type="button">Hapus</button></div></div>
        </div>`;
      }).join("");
    };
    renderList("#income-transaction-list", incomeTransactions, "income");
    renderList("#expense-transaction-list", expenseTransactions, "expense");
    renderMoneyInsights();
  }

  function readGoals() {
    try {
      const saved = JSON.parse(localStorage.getItem(goalsKey) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch { return []; }
  }
  function writeGoals() { localStorage.setItem(goalsKey, JSON.stringify(savingsGoals)); }
  function renderSavingsGoals() {
    const list = $("#goal-list");
    if (!savingsGoals.length) {
      list.innerHTML = '<div class="empty-state">Belum ada target. Mulai dari target kecil dulu.</div>';
      return;
    }
    list.innerHTML = savingsGoals.map(goal => {
      const target = Math.max(1, Number(goal.target) || 1);
      const saved = Math.max(0, Number(goal.saved) || 0);
      const percent = Math.min(100, Math.round(saved / target * 100));
      return `<article class="goal-item"><div class="goal-top"><div><strong>${escapeHtml(goal.name)}</strong><small>${rupiah(saved)} dari ${rupiah(target)}</small></div><strong class="goal-percent">${percent}%</strong></div><div class="goal-progress"><span style="width:${percent}%"></span></div><div class="goal-actions"><button type="button" class="goal-add" data-goal-add="${escapeHtml(goal.id)}">+ Tambah tabungan</button><button type="button" class="goal-delete" data-goal-delete="${escapeHtml(goal.id)}">Hapus</button></div>${percent >= 100 ? '<p class="goal-complete">Target tercapai. Mantap!</p>' : ''}</article>`;
    }).join("");
  }
  function renderMoneyInsights() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `${now.getFullYear()}-${month}`;
    const currentMonth = transactions.filter(t => String(t.transaction_date || t.date || "").startsWith(prefix));
    const income = currentMonth.filter(t => t.kind === "income").reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const expense = currentMonth.filter(t => t.kind === "expense").reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    $("#month-income").textContent = rupiah(income);
    $("#month-expense").textContent = rupiah(expense);
    $("#month-net").textContent = rupiah(income - expense);
    $("#month-net").classList.toggle("negative-value", income - expense < 0);
    const remaining = income - expense;
    const positiveRemaining = Math.max(0, remaining);
    const chartTotal = income + expense + positiveRemaining;
    const incomePct = chartTotal ? income / chartTotal * 100 : 0;
    const expensePct = chartTotal ? expense / chartTotal * 100 : 0;
    const donut = $("#stats-donut");
    if (donut) {
      donut.style.background = chartTotal ? `conic-gradient(#22c55e 0% ${incomePct}%, #ef4444 ${incomePct}% ${incomePct + expensePct}%, #eab308 ${incomePct + expensePct}% 100%)` : "conic-gradient(#383344 0% 100%)";
      $("#chart-income").textContent = rupiah(income); $("#chart-expense").textContent = rupiah(expense);
      $("#chart-savings").textContent = rupiah(remaining); $("#chart-net").textContent = rupiah(remaining);
      $("#stats-month-label").textContent = now.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
      $("#stats-note").textContent = remaining < 0 ? "Pengeluaran bulan ini melebihi pemasukan. Coba cek kembali pengeluaranmu." : chartTotal ? "Diagram berdasarkan total transaksi bulan ini." : "Belum ada transaksi bulan ini. Diagram akan terisi otomatis setelah lu mencatat transaksi.";
    }
    const categories = {};
    currentMonth.filter(t => t.kind === "expense").forEach(t => { const key = t.category || "Lainnya"; categories[key] = (categories[key] || 0) + (Number(t.amount) || 0); });
    const sorted = Object.entries(categories).sort((a,b) => b[1] - a[1]).slice(0, 5);
    const max = sorted.length ? sorted[0][1] : 0;
    $("#category-stats").innerHTML = sorted.length ? sorted.map(([name, amount]) => `<div class="category-stat"><div><span>${escapeHtml(name)}</span><strong>${rupiah(amount)}</strong></div><div class="category-bar"><span style="width:${max ? Math.max(4, amount/max*100) : 0}%"></span></div></div>`).join("") : '<p class="muted insight-empty">Belum ada pengeluaran bulan ini.</p>';
  }
  $("#goal-form").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("#goal-name").value.trim();
    const target = Number($("#goal-target").value.replace(/\D/g, ""));
    const saved = Number($("#goal-saved").value.replace(/\D/g, "")) || 0;
    if (!name || target <= 0) { setMessage("#goal-message", "Nama dan target harus diisi dengan benar.", true); return; }
    savingsGoals.unshift({ id: "goal-" + Date.now() + "-" + Math.random().toString(16).slice(2), name, target, saved });
    writeGoals(); renderSavingsGoals(); $("#goal-form").reset(); $("#goal-saved").value = "0";
    setMessage("#goal-message", "Target tabungan tersimpan di perangkat ini.");
  });
  $("#goal-list").addEventListener("click", event => {
    const add = event.target.closest("[data-goal-add]");
    const del = event.target.closest("[data-goal-delete]");
    if (add) {
      const goal = savingsGoals.find(item => item.id === add.dataset.goalAdd);
      if (!goal) return;
      const raw = prompt(`Berapa yang mau ditambahkan ke target “${goal.name}”? (Rp)`);
      if (raw === null) return;
      const amount = Number(raw.replace(/\D/g, ""));
      if (!Number.isFinite(amount) || amount <= 0) { alert("Masukkan nominal lebih dari 0."); return; }
      goal.saved = (Number(goal.saved) || 0) + amount; writeGoals(); renderSavingsGoals();
    } else if (del) {
      if (!confirm("Hapus target tabungan ini?")) return;
      savingsGoals = savingsGoals.filter(item => item.id !== del.dataset.goalDelete); writeGoals(); renderSavingsGoals();
    }
  });
  renderSavingsGoals();

  // Normalize local transaction data.
  function normalizeTransaction(row) {
    const rawType = String(row.kind ?? row.type ?? "").toLowerCase();
    const kind = ["income", "pemasukan", "in"].includes(rawType) ? "income" : "expense";
    return { ...row, kind, amount: Number(row.amount) || 0 };
  }

  async function saveTransaction(transaction) {
    const id = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : "violet-" + Date.now() + "-" + Math.random().toString(16).slice(2);
    transactions.unshift(normalizeTransaction({ ...transaction, id }));
    localWrite();
    renderTransactions();
  }

  function resetTransactionForm() {
    editingTransactionId = null;
    $("#transaction-form").reset();
    $("#transaction-date").value = new Date().toISOString().slice(0, 10);
    updateCategoryOptions(false);
    $("#transaction-submit").textContent = "+ Tambah transaksi";
    $("#cancel-edit").classList.add("hidden");
    setMessage("#transaction-message", "");
  }

  function beginEditTransaction(id) {
    const transaction = transactions.find(t => String(t.id) === String(id));
    if (!transaction) return;
    editingTransactionId = transaction.id;
    kindInput.value = transaction.kind;
    updateCategoryOptions(false);
    categoryInput.value = transaction.category || "Lainnya";
    $("#amount").value = Number(transaction.amount).toLocaleString("id-ID");
    $("#transaction-date").value = transaction.transaction_date || transaction.date || new Date().toISOString().slice(0, 10);
    $("#note").value = transaction.note || "";
    $("#transaction-submit").textContent = "Simpan perubahan";
    $("#cancel-edit").classList.remove("hidden");
    setMessage("#transaction-message", "Mode edit aktif. Ubah data lalu simpan.");
    $("#transaction-form").scrollIntoView({ behavior: "smooth", block: "center" });
    $("#amount").focus();
  }

  $("#transaction-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const amount = Number($("#amount").value.replace(/\./g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage("#transaction-message", "Nominal harus lebih dari 0.", true);
      return;
    }
    const transaction = {
      kind: $("#kind").value,
      amount,
      category: $("#category").value,
      note: $("#note").value.trim(),
      transaction_date: $("#transaction-date").value
    };
    try {
      if (editingTransactionId !== null) {
        transactions = transactions.map(t => String(t.id) === String(editingTransactionId) ? { ...t, ...transaction, id: t.id } : t);
        localWrite();
        renderTransactions();
        resetTransactionForm();
        setMessage("#transaction-message", "Perubahan transaksi berhasil disimpan secara lokal.");
      } else {
        await saveTransaction(transaction);
        $("#amount").value = "";
        $("#note").value = "";
        setMessage("#transaction-message", "Transaksi tersimpan di penyimpanan lokal perangkat ini.");
      }
    } catch (error) {
      setMessage("#transaction-message", "Gagal menyimpan: " + (error.message || "unknown error"), true);
    }
  });

  ["#income-transaction-list", "#expense-transaction-list"].forEach(selector => {
    $(selector).addEventListener("click", async (event) => {
      const editButton = event.target.closest("[data-edit]");
      if (editButton) { beginEditTransaction(editButton.dataset.edit); return; }
      const button = event.target.closest("[data-delete]");
      if (!button) return;
      const id = button.dataset.delete;
      if (!confirm("Hapus transaksi ini?")) return;
      transactions = transactions.filter(t => String(t.id) !== String(id));
      localWrite();
      renderTransactions();
    });
  });

  $("#cancel-edit").addEventListener("click", resetTransactionForm);
  $("#transaction-search").addEventListener("input", renderTransactions);
  $("#transaction-filter").addEventListener("change", renderTransactions);

  $("#export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({
      exportedAt: new Date().toISOString(), transactions
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `violet-backup-${today.toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  });

  const welcomeScreen = $("#welcome-screen");
  $("#welcome-start").addEventListener("click", () => {
    welcomeScreen.classList.add("is-hidden");
  });

  async function searchMusic(query) {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Pencarian gagal.");
    return body.results || [];
  }

  const audio = $("#violet-audio");
  const favoriteKey = "violet_music_favorites_v2";
  let queue = [];
  let queueIndex = -1;
  let favorites = [];
  let loadingStream = false;
  try { favorites = JSON.parse(localStorage.getItem(favoriteKey) || "[]"); }
  catch { favorites = []; }

  const safeSong = song => ({
    videoId: String(song.videoId || ""),
    title: String(song.title || "Judul tidak diketahui"),
    artists: String(song.artists || "Artis tidak diketahui"),
    album: String(song.album || ""),
    duration: String(song.duration || ""),
    thumbnail: String(song.thumbnail || "")
  });
  const currentSong = () => queue[queueIndex] || null;
  const isFavorite = song => favorites.some(item => item.videoId === song.videoId);
  const saveFavorites = () => localStorage.setItem(favoriteKey, JSON.stringify(favorites));
  const formatTime = seconds => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  function renderFavorites() {
    $("#favorite-count").textContent = `${favorites.length} lagu`;
    const list = $("#favorite-list");
    if (!favorites.length) {
      list.innerHTML = '<p class="library-empty">Lagu yang lu suka bakal muncul di sini.</p>';
      return;
    }
    list.innerHTML = favorites.map((song, index) => `
      <div class="favorite-item">
        <button type="button" class="favorite-pick" data-favorite-play="${index}">
          <img src="${escapeHtml(song.thumbnail)}" alt="" loading="lazy">
          <span><strong>${escapeHtml(song.title)}</strong><small>${escapeHtml(song.artists)}</small></span>
        </button>
        <button type="button" class="favorite-remove" data-favorite-remove="${escapeHtml(song.videoId)}" aria-label="Hapus favorit">♥</button>
      </div>`).join("");
  }

  function updateFavoriteButton() {
    const song = currentSong();
    const button = $("#favorite-current");
    button.textContent = song && isFavorite(song) ? "♥" : "♡";
    button.classList.toggle("is-favorite", Boolean(song && isFavorite(song)));
    button.disabled = !song;
  }

  function selectSong(song, list = null, index = 0) {
    const chosen = safeSong(song);
    queue = list && list.length ? list.map(safeSong) : [chosen];
    queueIndex = list && list.length ? index : 0;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    $("#now-playing-title").textContent = chosen.title;
    $("#now-playing-artist").textContent = chosen.artists;
    $("#player-artwork").src = chosen.thumbnail;
    $("#player-artwork").classList.toggle("hidden", !chosen.thumbnail);
    $("#player-art-placeholder").classList.toggle("hidden", Boolean(chosen.thumbnail));
    $("#player-duration").textContent = chosen.duration || "--:--";
    $("#player-current-time").textContent = "0:00";
    $("#player-seek").value = "0";
    $("#play-current").disabled = !chosen.videoId;
    $("#play-current").textContent = "▶";
    $("#player-status").textContent = "Lagu dipilih. Tekan putar untuk mencoba audio internal.";
    updateFavoriteButton();
  }

  async function playCurrent() {
    const song = currentSong();
    if (!song || loadingStream) return;
    if (audio.src && !audio.paused) {
      audio.pause();
      $("#play-current").textContent = "▶";
      return;
    }
    if (audio.src && audio.paused && audio.currentTime > 0) {
      try { await audio.play(); $("#play-current").textContent = "Ⅱ"; return; }
      catch (_) { /* retry by obtaining a fresh URL below */ }
    }
    loadingStream = true;
    $("#play-current").disabled = true;
    $("#player-status").textContent = "Sedang menyiapkan stream audio...";
    try {
      const response = await fetch(`/api/stream/${encodeURIComponent(song.videoId)}`);
      const body = await response.json();
      if (!response.ok || !body.url) throw new Error(body.error || "Stream tidak tersedia.");
      audio.pause();
audio.removeAttribute("src");
audio.load();

audio.src = body.url;
audio.load();

await new Promise((resolve, reject) => {
  audio.addEventListener("canplay", resolve, { once: true });
  audio.addEventListener("error", () => {
    reject(new Error("Browser tidak bisa memuat stream audio."));
  }, { once: true });
  setTimeout(() => reject(new Error("Audio terlalu lama dimuat.")), 15000);
});

await audio.play();
      $("#play-current").textContent = "Ⅱ";
      $("#player-status").textContent = "Memutar di Violet.";
    } catch (error) {
      $("#player-status").textContent = error.message || "Audio gagal diputar. Coba lagu lain atau perbarui yt-dlp.";
      $("#play-current").textContent = "▶";
    } finally {
      loadingStream = false;
      $("#play-current").disabled = false;
    }
  }

  $("#play-current").addEventListener("click", playCurrent);
  audio.addEventListener("play", () => { $("#play-current").textContent = "Ⅱ"; });
  audio.addEventListener("pause", () => { $("#play-current").textContent = "▶"; });
  audio.addEventListener("timeupdate", () => {
    $("#player-current-time").textContent = formatTime(audio.currentTime);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      $("#player-seek").value = String(Math.round(audio.currentTime / audio.duration * 1000));
      $("#player-duration").textContent = formatTime(audio.duration);
    }
  });
  audio.addEventListener("ended", () => {
    if (queue.length > 1) {
      queueIndex = (queueIndex + 1) % queue.length;
      selectSong(queue[queueIndex], queue, queueIndex);
      playCurrent();
    } else {
      $("#play-current").textContent = "▶";
      $("#player-status").textContent = "Lagu selesai.";
    }
  });
  audio.addEventListener("error", () => {
    if (audio.src) $("#player-status").textContent = "Browser gagal memutar stream ini. Coba lagu lain atau perbarui yt-dlp.";
  });
  $("#player-seek").addEventListener("input", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = Number($("#player-seek").value) / 1000 * audio.duration;
    }
  });

  $("#previous-track").addEventListener("click", () => {
    if (!queue.length) return;
    queueIndex = (queueIndex - 1 + queue.length) % queue.length;
    selectSong(queue[queueIndex], queue, queueIndex);
    playCurrent();
  });
  $("#next-track").addEventListener("click", () => {
    if (!queue.length) return;
    queueIndex = (queueIndex + 1) % queue.length;
    selectSong(queue[queueIndex], queue, queueIndex);
    playCurrent();
  });

  $("#favorite-current").addEventListener("click", () => {
    const song = currentSong();
    if (!song) return;
    favorites = isFavorite(song)
      ? favorites.filter(item => item.videoId !== song.videoId)
      : [song, ...favorites];
    saveFavorites();
    renderFavorites();
    updateFavoriteButton();
  });

  $("#favorite-list").addEventListener("click", event => {
    const playButton = event.target.closest("[data-favorite-play]");
    if (playButton) {
      const index = Number(playButton.dataset.favoritePlay);
      selectSong(favorites[index], favorites, index);
      playCurrent();
      return;
    }
    const removeButton = event.target.closest("[data-favorite-remove]");
    if (removeButton) {
      favorites = favorites.filter(item => item.videoId !== removeButton.dataset.favoriteRemove);
      saveFavorites();
      renderFavorites();
      updateFavoriteButton();
    }
  });
  renderFavorites();

  $("#search-form").addEventListener("submit", async event => {
    event.preventDefault();
    const query = $("#search-query").value.trim();
    if (!query) return;
    $("#search-results").innerHTML = "";
    setMessage("#search-message", "Sedang mencari lagu...");
    try {
      const results = await searchMusic(query);
      setMessage("#search-message", results.length ? `${results.length} hasil ditemukan.` : "Belum ada hasil. Coba kata kunci lain.");
      $("#search-results").innerHTML = results.map((song, index) => `
        <button type="button" class="song-result" data-song-index="${index}">
          <img src="${escapeHtml(song.thumbnail)}" alt="" loading="lazy">
          <span class="song-copy"><strong>${escapeHtml(song.title)}</strong><small>${escapeHtml(song.artists)}${song.album ? " · " + escapeHtml(song.album) : ""}</small></span>
          <span class="song-duration">${escapeHtml(song.duration)}</span>
        </button>`).join("");
      $("#search-results")._songs = results;
    } catch (error) {
      setMessage("#search-message", error.message || "Pencarian gagal.", true);
    }
  });

  $("#search-results").addEventListener("click", event => {
    const button = event.target.closest("[data-song-index]");
    if (!button) return;
    const songs = $("#search-results")._songs || [];
    const index = Number(button.dataset.songIndex);
    if (songs[index]) selectSong(songs[index], songs, index);
  });

  // Money and Music are separate views; no page navigation or tab opening needed.
  function activateView(view) {
    document.querySelectorAll("[data-view]").forEach(section => {
      section.classList.toggle("active", section.dataset.view === view);
    });
    document.querySelectorAll("[data-view-link]").forEach(link => {
      link.classList.toggle("active", link.dataset.viewLink === view);
    });
    if (view === "music") {
      $("#page-eyebrow").textContent = "RUANG MUSIK LU";
      $("#page-title").textContent = "Musik favorit, satu tempat.";
    } else {
      $("#page-eyebrow").textContent = "RUANG PRIBADI LU";
      $("#page-title").textContent = "Keuangan jadi lebih terarah.";
    }
  }
  document.querySelectorAll("[data-view-link]").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      activateView(link.dataset.viewLink);
      history.replaceState(null, "", link.getAttribute("href"));
    });
  });
  if (location.hash === "#music") activateView("music");

  loadTransactions().catch(error => {
    console.error(error);
    setMessage("#transaction-message", "Gagal memuat transaksi lokal.", true);
  });
  const statsModal = $("#stats-modal");
  const openStats = () => { renderMoneyInsights(); statsModal.hidden = false; document.body.classList.add("modal-open"); $("#close-stats").focus(); };
  const closeStats = () => { statsModal.hidden = true; document.body.classList.remove("modal-open"); $("#open-stats").focus(); };
  $("#open-stats").addEventListener("click", openStats);
  $("#close-stats").addEventListener("click", closeStats);
  statsModal.addEventListener("click", event => { if (event.target === statsModal) closeStats(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !statsModal.hidden) closeStats(); });
})();
