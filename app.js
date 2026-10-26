(() => {
  const $ = (id) => document.getElementById(id);
  const STORE_KEY = "spelling-practice-v1";
  const LISTS = window.WORD_LISTS;

  // ---------- Settings / storage ----------
  const defaults = {
    level: "one",
    count: "20",
    shuffle: true,
    customText: "",
    voiceURI: "",
    rate: 0.85,
    autoSentence: false,
  };

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      return { ...defaults, ...saved };
    } catch {
      return { ...defaults };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(settings));
    } catch {
      // Storage blocked (private mode etc.) — settings just won't persist.
    }
  }

  let settings = loadSettings();

  // "word OR alt | sentence" -> { word, alts, sentence }
  function parseWords(text) {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const [spellings, ...rest] = line.split("|");
        const [word, ...alts] = spellings.split(/\s+OR\s+/).map((s) => s.trim());
        return { word, alts, sentence: rest.join("|").trim() };
      })
      .filter((w) => w.word);
  }

  function wordsForLevel(level) {
    if (level === "custom") return parseWords(settings.customText);
    if (level === "all") return Object.values(LISTS).flatMap((l) => parseWords(l.words));
    return parseWords(LISTS[level].words);
  }

  // ---------- Speech ----------
  const synth = window.speechSynthesis;
  let voices = [];

  function loadVoices() {
    if (!synth) return;
    voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
    const sel = $("voiceSel");
    sel.innerHTML = "";
    sel.add(new Option("Default voice", ""));
    voices.forEach((v) => sel.add(new Option(`${v.name} (${v.lang})`, v.voiceURI)));
    sel.value = settings.voiceURI;
  }

  function speak(text, { rate = settings.rate } = {}) {
    return new Promise((resolve) => {
      if (!synth) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = rate;
      const voice = voices.find((v) => v.voiceURI === settings.voiceURI);
      if (voice) u.voice = voice;
      u.onend = resolve;
      u.onerror = resolve;
      synth.speak(u);
    });
  }

  function stopSpeaking() {
    if (synth) synth.cancel();
  }

  async function sayWord() {
    stopSpeaking();
    const item = queue[index];
    await speak(item.word);
    if (settings.autoSentence && item.sentence) {
      await speak(item.sentence);
      await speak(item.word);
    }
  }

  async function saySentence() {
    stopSpeaking();
    const item = queue[index];
    if (item.sentence) await speak(item.sentence);
    await speak(item.word);
  }

  // How each character is read when spelling out loud.
  // Uppercase so a lone "a" is read as the letter name, not the word.
  function letterName(ch) {
    const special = { "-": "hyphen", "'": "apostrophe", "é": "E with an accent", "ñ": "N with a tilde" };
    return special[ch.toLowerCase()] || ch.toUpperCase();
  }

  // Reads the letters one at a time, highlighting each tile as it goes.
  let spellRun = 0;
  async function spellOut() {
    stopSpeaking();
    const run = ++spellRun;
    const tiles = [...$("answerLetters").children].filter((t) => !t.classList.contains("gap"));
    for (const tile of tiles) {
      if (run !== spellRun) return;
      tiles.forEach((t) => t.classList.remove("lit"));
      tile.classList.add("lit");
      await speak(letterName(tile.textContent), { rate: settings.rate * 0.9 });
    }
    if (run !== spellRun) return;
    tiles.forEach((t) => t.classList.remove("lit"));
    await speak(queue[index].word);
  }

  // ---------- Quiz state ----------
  let queue = [];
  let index = 0;
  let missed = [];
  let revealed = false;

  function show(screen) {
    ["startScreen", "quizScreen", "doneScreen"].forEach((id) => ($(id).hidden = id !== screen));
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startQuiz(items, count = 0) {
    if (!items.length) {
      openSettings();
      return;
    }
    queue = settings.shuffle ? shuffle(items) : [...items];
    if (count > 0) queue = queue.slice(0, count);
    index = 0;
    missed = [];
    show("quizScreen");
    showWord();
  }

  function showWord() {
    revealed = false;
    spellRun++;
    const item = queue[index];
    $("progressText").textContent = `Word ${index + 1} of ${queue.length}`;
    $("progressBar").style.width = `${(index / queue.length) * 100}%`;
    $("prompt").hidden = false;
    $("answer").hidden = true;
    $("askControls").hidden = false;
    $("gradeControls").hidden = true;
    $("sentenceBtn").hidden = !item.sentence;
    sayWord();
    $("revealBtn").focus();
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    stopSpeaking();
    const item = queue[index];
    $("answerWord").textContent = item.word;
    $("answerLetters").innerHTML = "";
    [...item.word].forEach((ch) => {
      const s = document.createElement("span");
      if (ch === " ") s.className = "gap";
      else s.textContent = ch;
      $("answerLetters").appendChild(s);
    });
    $("answerAlt").textContent = item.alts.length ? `Also correct: ${item.alts.join(", ")}` : "";
    $("answerSentence").textContent = item.sentence;
    $("prompt").hidden = true;
    $("answer").hidden = false;
    $("askControls").hidden = true;
    $("gradeControls").hidden = false;
    $("gotBtn").focus();
  }

  function grade(correct) {
    if (!revealed) return;
    stopSpeaking();
    spellRun++;
    if (!correct) missed.push(queue[index]);
    index++;
    if (index < queue.length) showWord();
    else finish();
  }

  function finish() {
    $("progressBar").style.width = "100%";
    const right = queue.length - missed.length;
    $("scoreText").textContent =
      missed.length === 0 ? `Perfect! ${right} / ${queue.length} 🎉` : `${right} / ${queue.length} correct`;
    $("missedList").innerHTML = "";
    missed.forEach((m) => {
      const li = document.createElement("li");
      li.textContent = m.word;
      $("missedList").appendChild(li);
    });
    $("missedBox").hidden = missed.length === 0;
    $("retryBtn").hidden = missed.length === 0;
    show("doneScreen");
    speak(missed.length === 0 ? "Perfect score. Great job!" : `You got ${right} out of ${queue.length}.`);
  }

  // ---------- Start screen ----------
  function fillLevels() {
    const sel = $("levelSel");
    sel.innerHTML = "";
    Object.entries(LISTS).forEach(([key, l]) => sel.add(new Option(l.name, key)));
    sel.add(new Option("All levels", "all"));
    sel.add(new Option("My list", "custom"));
    if (![...sel.options].some((o) => o.value === settings.level)) settings.level = defaults.level;
    sel.value = settings.level;
    $("countSel").value = settings.count;
    $("shuffleChk").checked = settings.shuffle;
  }

  function updateWordCount() {
    const n = wordsForLevel(settings.level).length;
    $("wordCount").textContent = n
      ? `${n} word${n === 1 ? "" : "s"} in this list`
      : "“My list” is empty — add words under ⚙︎ Words.";
  }

  // ---------- Settings dialog ----------
  function openSettings() {
    stopSpeaking();
    $("wordsInput").value = settings.customText;
    $("voiceSel").value = settings.voiceURI;
    $("rateInput").value = settings.rate;
    $("rateVal").textContent = `(${settings.rate}×)`;
    $("autoSentenceChk").checked = settings.autoSentence;
    $("settings").showModal();
  }

  function readSettingsForm() {
    settings.customText = $("wordsInput").value.trim();
    settings.voiceURI = $("voiceSel").value;
    settings.rate = parseFloat($("rateInput").value);
    settings.autoSentence = $("autoSentenceChk").checked;
  }

  // ---------- Wiring ----------
  $("startBtn").onclick = () => startQuiz(wordsForLevel(settings.level), parseInt(settings.count, 10));
  $("levelSel").onchange = (e) => { settings.level = e.target.value; saveSettings(); updateWordCount(); };
  $("countSel").onchange = (e) => { settings.count = e.target.value; saveSettings(); };
  $("shuffleChk").onchange = (e) => { settings.shuffle = e.target.checked; saveSettings(); };

  $("repeatBtn").onclick = sayWord;
  $("sentenceBtn").onclick = saySentence;
  $("revealBtn").onclick = reveal;
  $("spellBtn").onclick = spellOut;
  $("gotBtn").onclick = () => grade(true);
  $("missBtn").onclick = () => grade(false);
  $("againBtn").onclick = () => { show("startScreen"); updateWordCount(); };
  $("retryBtn").onclick = () => startQuiz(missed);

  $("settingsBtn").onclick = openSettings;
  $("rateInput").oninput = (e) => ($("rateVal").textContent = `(${e.target.value}×)`);
  $("testVoiceBtn").onclick = () => {
    readSettingsForm();
    stopSpeaking();
    speak("Your word is: beautiful.");
  };
  $("saveBtn").onclick = () => {
    readSettingsForm();
    saveSettings();
    updateWordCount();
  };

  document.addEventListener("keydown", (e) => {
    if ($("quizScreen").hidden || $("settings").open) return;
    const k = e.key.toLowerCase();
    if (k === " ") { e.preventDefault(); revealed ? spellOut() : sayWord(); }
    else if (k === "enter" && !revealed) { e.preventDefault(); reveal(); }
    else if (k === "y" && revealed) grade(true);
    else if (k === "n" && revealed) grade(false);
  });

  if (synth) {
    loadVoices();
    synth.onvoiceschanged = loadVoices;
  }

  fillLevels();
  updateWordCount();
  if (!synth) $("wordCount").textContent = "This browser can't speak aloud. Try Chrome, Safari, or Edge.";
})();
