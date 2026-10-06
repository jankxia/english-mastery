/* english-mastery · 应用主逻辑
 * 路由 / 渲染 / 状态 / 互动练习 / localStorage 进度
 * 对齐 math-mastery：纯前端、hash 路由、数据驱动、离线可用
 */
(function () {
  "use strict";

  var METHODS = window.METHODS || [];
  var DIMENSIONS = window.DIMENSIONS || [];
  var GRADES = window.GRADES || [];
  var READ = window.READ_SENTENCES || [];
  var WORDS = window.WORD_BANK || {};
  var COURSES = window.COURSES || {};
  var TRICKS = window.WORD_TRICKS || [];
  var CURRIC = window.CURRICULUM || { grades: [], basics: [] };

  var LS_PROGRESS = "em_progress_v1";
  var LS_STREAK = "em_streak_v1";
  var LS_READ = "em_read_v1";
  var LS_TRICKS_USER = "em_tricks_user_v1";
  var LS_TRICKS_DONE = "em_tricks_done_v1";
  var LS_UNIT_PROGRESS = "em_unit_prog_v1";

  var state = { grade: "all", dim: null, q: "", wordGrade: "primary", trickGrade: "all", trickQ: "", curricGrade: "3" };
  var quizState = null;      // 随机抽考小游戏的当前局状态
  var pendingTrickImg = "";  // 添加「我的巧记」时暂存的图片 dataURL（入库后清空）
  var quizItems = null;       // 单元巧记抽考的范围（null = 全局抽考）
  var quizHome = "#/tricks";  // 抽考结束 / 退出后返回的页面

  /* ---------- 存储 ---------- */
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(LS_PROGRESS)) || {}; }
    catch (e) { return {}; }
  }
  function saveProgress(p) { localStorage.setItem(LS_PROGRESS, JSON.stringify(p)); }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  function loadStreak() {
    try { return JSON.parse(localStorage.getItem(LS_STREAK)) || {}; }
    catch (e) { return {}; }
  }
  function bumpStreak() {
    var s = loadStreak();
    var t = todayStr();
    if (s.date === t) { s.count = (s.count || 0) + 1; }
    else {
      // 连续天数：昨天则 +1，否则重置为 1
      var y = new Date(Date.now() - 86400000);
      var yt = y.getFullYear() + "-" + (y.getMonth() + 1) + "-" + y.getDate();
      s.days = (s.date === yt) ? ((s.days || 0) + 1) : 1;
      s.count = 1; s.date = t;
    }
    localStorage.setItem(LS_STREAK, JSON.stringify(s));
    return s;
  }

  function gradeColor(g) {
    for (var i = 0; i < GRADES.length; i++) if (GRADES[i].key === g) return GRADES[i].color;
    return "#1f2733";
  }
  function gradeLabel(g) {
    for (var i = 0; i < GRADES.length; i++) if (GRADES[i].key === g) return GRADES[i].label;
    return g;
  }
  function dimLabel(k) {
    for (var i = 0; i < DIMENSIONS.length; i++) if (DIMENSIONS[i].key === k) return DIMENSIONS[i].label;
    return k;
  }

  /* ---------- 工具 ---------- */
  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- 顶部统计 + 打卡 ---------- */
  function renderTopbar() {
    var p = loadProgress();
    var total = METHODS.length;
    var done = 0; for (var k in p) if (p[k] && p[k].done) done++;
    var s = loadStreak();
    var streakDays = s.days || 0;
    var bar = document.getElementById("topbar");
    bar.innerHTML =
      '<div class="inner">' +
      '<div class="logo"><span class="fox">🦊</span>English-Mastery</div>' +
      '<span class="tagline">中小学英语学习技巧 · 不枯燥地学</span>' +
      '<span class="spacer"></span>' +
      '<span class="streak" title="连续学习天数">🔥 连续 <b>' + streakDays + '</b> 天</span>' +
      "</div>";
    var stats = document.getElementById("stats");
    if (stats) {
      stats.innerHTML =
        '<div class="stat">技巧总数 <b>' + total + '</b></div>' +
        '<div class="stat">已掌握 <b>' + done + '</b></div>' +
        '<div class="stat">完成率 <b>' + (total ? Math.round(done / total * 100) : 0) + '% </b></div>' +
        '<div class="stat">小学 <b>' + METHODS.filter(function (m) { return m.grade === "primary"; }).length + '</b></div>' +
        '<div class="stat">初中 <b>' + METHODS.filter(function (m) { return m.grade === "junior"; }).length + '</b></div>' +
        '<div class="stat">高中 <b>' + METHODS.filter(function (m) { return m.grade === "senior"; }).length + '</b></div>';
    }
  }

  /* ---------- 顶部「学习技巧 / 单词练习」切换 Tab（所有页面共用，保证能来回切） ---------- */
  function topTabsHtml(activeView) {
    function cls(v) { return "top-tab" + (activeView === v ? " active" : ""); }
    return '<div class="top-tabs">' +
      '<span class="' + cls("curriculum") + '" data-view="curriculum">📚 课程学习</span>' +
      '<span class="' + cls("methods") + '" data-view="methods">📖 学习技巧</span>' +
      '<span class="' + cls("words") + '" data-view="words">🔤 单词练习</span>' +
      '<span class="' + cls("textbook") + '" data-view="textbook">📝 课文跟读</span>' +
      '<span class="' + cls("courses") + '" data-view="courses">📺 同步课堂</span>' +
      '<span class="' + cls("tricks") + '" data-view="tricks">💡 单词巧记</span>' +
      '</div>';
  }
  function bindTopTabs() {
    var root = document.getElementById("app");
    Array.prototype.forEach.call(root.querySelectorAll(".top-tab"), function (t) {
      t.onclick = function () {
        var v = t.getAttribute("data-view");
        if (v === "words") location.hash = "#/words";
        else if (v === "textbook") location.hash = "#/textbook";
        else if (v === "courses") location.hash = "#/courses";
        else if (v === "curriculum") location.hash = "#/curriculum";
        else if (v === "tricks") location.hash = "#/tricks";
        else location.hash = "#/";
      };
    });
  }

  /* ---------- 首页 ---------- */
  function renderHome() {
    var root = document.getElementById("app");
    var p = loadProgress();

    var gradeTabs = '<div class="grade-tabs">';
    gradeTabs += tabHtml("all", "全部");
    GRADES.forEach(function (g) { gradeTabs += tabHtml(g.key, g.label); });
    gradeTabs += "</div>";

    var dimChips = '<div class="dim-chips">';
    dimChips += '<span class="chip ' + (state.dim === null ? "active" : "") + '" data-dim="">全部维度</span>';
    DIMENSIONS.forEach(function (d) {
      dimChips += '<span class="chip ' + (state.dim === d.key ? "active" : "") + '" data-dim="' + d.key + '">' + d.label + "</span>";
    });
    dimChips += "</div>";

    var filters =
      '<div class="filters">' + gradeTabs + dimChips +
      '<input class="search" id="search" placeholder="🔍 搜技巧 / 方法 / 关键词…" value="' + esc(state.q) + '">' +
      "</div>";

    var list = METHODS.filter(function (m) {
      if (state.grade !== "all" && m.grade !== state.grade) return false;
      if (state.dim && m.dim !== state.dim) return false;
      if (state.q) {
        var q = state.q.toLowerCase();
        var hay = (m.title + m.summary + m.dimLabel + m.gradeLabel + (m.steps || []).join("") + (m.tips || []).join("")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    var grid = '<div class="grid">';
    if (list.length === 0) {
      grid += '<div class="empty">没有匹配的技巧，换个关键词或维度试试 🐾</div>';
    } else {
      list.forEach(function (m) {
        var isDone = p[m.id] && p[m.id].done;
        var hasPractice = m.practice ? true : false;
        grid +=
          '<div class="card ' + (isDone ? "done" : "") + '" data-id="' + m.id + '">' +
          '<span class="done-flag">✅</span>' +
          '<div class="top"><span class="icon">' + m.icon + '</span>' +
          '<span class="badge-grade" style="background:' + gradeColor(m.grade) + '">' + m.gradeLabel + "</span></div>" +
          "<h3>" + esc(m.title) + "</h3>" +
          '<p class="summary">' + esc(m.summary) + "</p>" +
          '<div class="meta"><span class="tag">📚 ' + esc(m.dimLabel) + "</span>" +
          (hasPractice ? '<span class="tag">🎮 可练习</span>' : "") + "</div>" +
          '<div class="progress-mini"><i style="width:' + (isDone ? 100 : 0) + '%"></i></div>' +
          "</div>";
      });
    }
    grid += "</div>";

    root.innerHTML = topTabsHtml("methods") + filters + grid;

    // 事件
    Array.prototype.forEach.call(root.querySelectorAll(".grade-tab"), function (t) {
      t.onclick = function () { state.grade = t.getAttribute("data-grade"); renderHome(); window.scrollTo(0, 0); };
    });
    Array.prototype.forEach.call(root.querySelectorAll(".chip"), function (c) {
      c.onclick = function () {
        var d = c.getAttribute("data-dim");
        state.dim = d === "" ? null : d; renderHome(); window.scrollTo(0, 0);
      };
    });
    bindTopTabs();
    var search = document.getElementById("search");
    if (search) search.oninput = function () { state.q = search.value; renderHomeLight(); };

    Array.prototype.forEach.call(root.querySelectorAll(".card[data-id]"), function (c) {
      c.onclick = function () { location.hash = "#/m/" + c.getAttribute("data-id"); };
    });
  }

  function tabHtml(key, label) {
    return '<span class="grade-tab ' + (state.grade === key ? "active" : "") + '" data-grade="' + key + '">' + label + "</span>";
  }

  // 搜索时只重渲染滤网下方，避免输入框失焦
  function renderHomeLight() {
    var root = document.getElementById("app");
    var old = root.innerHTML;
    renderHome();
  }

  /* ---------- 详情 ---------- */
  function renderDetail(id) {
    var m = null;
    for (var i = 0; i < METHODS.length; i++) if (METHODS[i].id === id) m = METHODS[i];
    var root = document.getElementById("app");
    if (!m) { root.innerHTML = '<div class="empty">找不到该技巧 😢</div>'; return; }
    var p = loadProgress();
    var isDone = p[m.id] && p[m.id].done;

    var stepsHtml = (m.steps || []).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");
    var tipsHtml = (m.tips || []).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");

    var videosHtml = "";
    if (m.videos && m.videos.length) {
      videosHtml = m.videos.map(function (v) {
        return '<a class="video-item" href="' + esc(v.url) + '" target="_blank" rel="noopener">' +
          '<span class="play">▶️</span><span><span class="vt">' + esc(v.title) + '</span><br>' +
          '<span class="vu">' + esc(v.url) + "</span></span></a>";
      }).join("");
    }
    if (m.bv) {
      videosHtml += '<iframe class="video-embed" src="https://player.bilibili.com/player.html?bvid=' + esc(m.bv) +
        '&autoplay=0" allowfullscreen scrolling="no"></iframe>';
    }

    var practiceHtml = m.practice ? renderPractice(m.practice) : "";
    var readHtml = renderReadSection(m);

    root.innerHTML =
      '<div class="detail">' +
      '<button class="back" id="back">← 返回技巧列表</button>' +
      '<div class="head"><span class="icon">' + m.icon + "</span>" +
      "<div><h2>" + esc(m.title) + "</h2>" +
      '<p class="sub">' + esc(m.summary) + "</p></div></div>" +
      '<div class="meta"><span class="tag" style="background:' + gradeColor(m.grade) + ';color:#fff">🎓 ' + m.gradeLabel + "</span>" +
      '<span class="tag">📚 ' + esc(m.dimLabel) + "</span></div>" +
      '<div class="why">🐾 <b>为什么要学这个？</b> ' + esc(m.why) + "</div>" +

      '<div class="section-title"><span class="bar"></span>核心步骤</div>' +
      '<ol class="steps">' + stepsHtml + "</ol>" +

      (tipsHtml ? '<div class="section-title"><span class="bar" style="background:var(--gold)"></span>实战窍门</div><ul class="tips">' + tipsHtml + "</ul>" : "") +

      (videosHtml ? '<div class="section-title"><span class="bar" style="background:var(--senior)"></span>📺 推荐视频 / 资源</div><div class="video-list">' + videosHtml + "</div>" : "") +

      (practiceHtml ? '<div class="section-title"><span class="bar" style="background:var(--primary)"></span>🎮 互动小练习</div>' + practiceHtml : "") +

      '<button class="mark-done ' + (isDone ? "done" : "") + '" id="markDone">' +
      (isDone ? "✅ 已掌握（点击取消）" : "🏆 我学会啦，标记为已掌握") + "</button>" +

      (m.source ? '<div class="source">📎 ' + esc(m.source) + "</div>" : "") +
      "</div>";

    var back = document.getElementById("back");
    if (back) back.onclick = function () { history.back(); };

    bindPractice(m);
    bindRead(m);

    var md = document.getElementById("markDone");
    if (md) md.onclick = function () { toggleDone(m.id); };
  }

  function toggleDone(id) {
    var p = loadProgress();
    if (!p[id]) p[id] = {};
    p[id].done = !p[id].done;
    if (p[id].done) { p[id].practiced = true; bumpStreak(); if (typeof confetti === "function") confetti(); }
    saveProgress(p);
    renderTopbar();
    renderDetail(id);
  }

  /* ---------- 互动练习 ---------- */
  function renderPractice(pr) {
    if (pr.type === "flashcard") return renderFlashcard(pr);
    if (pr.type === "choice") return renderChoice(pr);
    if (pr.type === "fill") return renderFill(pr);
    if (pr.type === "checklist") return renderChecklist(pr);
    return "";
  }

  function renderFlashcard(pr) {
    var cards = pr.items.map(function (it, i) {
      return '<div class="flip" data-i="' + i + '"><div class="inner">' +
        '<div class="face front">' + esc(it.word) + '<div class="rate"><button class="no" data-r="0">不认识</button><button class="yes" data-r="1">认识</button></div></div>' +
        '<div class="face back">' + esc(it.meaning) + "</div></div></div>";
    }).join("");
    return '<div class="practice"><div class="p-type">🃏 单词闪卡：点卡片翻面，再选「认识 / 不认识」自评</div>' +
      '<div class="flashcard-deck">' + cards + "</div></div>";
  }

  function renderChoice(pr) {
    var qs = pr.items.map(function (it, i) {
      var opts = it.options.map(function (o, j) {
        return '<button class="opt" data-q="' + i + '" data-o="' + j + '" data-ans="' + esc(it.answer) + '">' + esc(o) + "</button>";
      }).join("");
      return '<div class="q" data-q="' + i + '"><div class="qt">' + (i + 1) + ". " + esc(it.q) + '</div><div class="opts">' + opts + '</div><div class="feedback"></div></div>';
    }).join("");
    return '<div class="practice"><div class="p-type">✅ 选择题：选出正确答案，立刻看反馈</div>' + qs + "</div>";
  }

  function renderFill(pr) {
    var qs = pr.items.map(function (it, i) {
      return '<div class="fill-q" data-q="' + i + '" data-ans="' + esc(it.answer) + '">' +
        '<div class="sentence">' + esc(it.sentence) + "</div>" +
        '<input placeholder="填这里"><button class="check">核对</button><span class="res"></span></div>';
    }).join("");
    return '<div class="practice"><div class="p-type">✍️ 填空：根据句意填入正确形式</div>' + qs + "</div>";
  }

  function renderChecklist(pr) {
    var items = pr.items.map(function (t) {
      return "<li><input type='checkbox'> <span>" + esc(t) + "</span></li>";
    }).join("");
    return '<div class="practice"><div class="p-type">✅ 今日打卡清单：完成一项勾一项</div><ul class="checklist">' + items + "</ul></div>";
  }

  /* ---------- 跟读练习（Web Speech API：语音合成 + 语音识别 + 录音） ---------- */
  function loadRead() {
    try { return JSON.parse(localStorage.getItem(LS_READ)) || {}; } catch (e) { return {}; }
  }
  function saveRead(o) { localStorage.setItem(LS_READ, JSON.stringify(o)); }
  function normWords(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  }
  // 词级匹配相似度 0..1：识别词中命中原文词（按频次）的比例
  function speechScore(recognized, target) {
    var t = normWords(target), r = normWords(recognized);
    if (!t.length) return 0;
    var setT = {}, setR = {};
    t.forEach(function (w) { setT[w] = (setT[w] || 0) + 1; });
    r.forEach(function (w) { setR[w] = (setR[w] || 0) + 1; });
    var hit = 0;
    Object.keys(setR).forEach(function (w) { if (setT[w]) hit += Math.min(setT[w], setR[w]); });
    return hit / t.length;
  }
  // 逐词批改：返回每个目标词是否被孩子读中（用于高亮「对 / 漏」）
  function speechScoreDetail(recognized, target) {
    var t = normWords(target), r = normWords(recognized);
    if (!t.length) return { score: 0, detail: [] };
    var rCount = {}; r.forEach(function (w) { rCount[w] = (rCount[w] || 0) + 1; });
    var used = {};
    var detail = t.map(function (w) {
      var avail = (rCount[w] || 0) - (used[w] || 0);
      if (avail > 0) { used[w] = (used[w] || 0) + 1; return { w: w, ok: true }; }
      return { w: w, ok: false };
    });
    var hit = 0; detail.forEach(function (d) { if (d.ok) hit++; });
    return { score: t.length ? hit / t.length : 0, detail: detail };
  }
  var _voiceCache = null;
  function pickVoice() {
    var synth = window.speechSynthesis;
    if (!synth || !synth.getVoices) return null;
    if (_voiceCache) return _voiceCache;
    var vs = synth.getVoices() || [];
    _voiceCache = vs.filter(function (v) { return /en[-_]US/i.test(v.lang); })[0] ||
                  vs.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
    return _voiceCache;
  }
  function speak(text, opts) {
    opts = opts || {};
    var synth = window.speechSynthesis;
    if (!synth) { alert("当前浏览器不支持语音朗读，请换 Chrome / Edge"); return; }
    synth.cancel();
    var u = new SpeechSynthesisUtterance(text);
    var v = pickVoice();
    if (v) u.voice = v;
    u.lang = (v && v.lang) || opts.lang || "en-US";
    u.rate = opts.rate || 1;
    u.pitch = (opts.pitch != null) ? opts.pitch : 1;
    synth.speak(u);
  }
  function updateReadSummary(id, total) {
    var sum = document.getElementById("readSummary");
    if (!sum) return;
    var o = loadRead();
    var done = (o[id] || []).length;
    if (total && done >= total) sum.innerHTML = "🎉 跟读通关！" + done + "/" + total + " 句都达标啦";
    else sum.textContent = "已完成 " + done + "/" + total + " 句跟读（识别匹配度 ≥ 60% 算达标）";
  }
  function markReadDone(id, i, ok) {
    if (!ok) return;
    var o = loadRead();
    if (!o[id]) o[id] = [];
    if (o[id].indexOf(i) < 0) { o[id].push(i); saveRead(o); }
    updateReadSummary(id, (READ[id] || []).length);
  }
  function renderReadSection(m) {
    var list = READ[m.id] || [];
    if (!list.length) return "";
    var rows = list.map(function (s, i) {
      return '<div class="read-row" data-i="' + i + '">' +
        '<div class="read-en">' + esc(s.en) + '</div>' +
        '<div class="read-zh">' + (s.zh ? esc(s.zh) : "") + '</div>' +
        '<div class="read-btns">' +
          '<button class="rb-play" data-i="' + i + '">▶ 听示范</button>' +
          '<button class="rb-record" data-i="' + i + '">🎤 跟我读</button>' +
          '<button class="rb-tape" data-i="' + i + '">🔴 录我的声音</button>' +
        '</div>' +
        '<div class="read-fb" data-i="' + i + '"></div>' +
      '</div>';
    }).join("");
    return '<div class="section-title"><span class="bar" style="background:var(--primary)"></span>🎤 跟读练习</div>' +
      '<div class="read-box">' +
        '<div class="read-toolbar">口音：' +
          '<select id="readAccent"><option value="en-US">美音</option><option value="en-GB">英音</option></select>' +
          '<label class="read-slow"><input type="checkbox" id="readSlow"> 慢速</label>' +
          '<span class="read-hint">跟着读，语音识别会给你打分（推荐 Chrome / Edge）</span>' +
        '</div>' + rows +
        '<div class="read-summary" id="readSummary"></div>' +
      '</div>';
  }
  function bindRead(m) {
    var list = READ[m.id] || [];
    if (!list.length) return;
    var synth = window.speechSynthesis;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var MR = (window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    var accentSel = document.getElementById("readAccent");
    var slowChk = document.getElementById("readSlow");

    Array.prototype.forEach.call(document.querySelectorAll(".rb-play"), function (b) {
      b.onclick = function () { speak(list[+b.getAttribute("data-i")].en, { lang: accentSel ? accentSel.value : "en-US", rate: (slowChk && slowChk.checked) ? 0.7 : 1 }); };
    });

    // 录音回放（MediaRecorder）
    if (!MR) {
      Array.prototype.forEach.call(document.querySelectorAll(".rb-tape"), function (b) {
        b.disabled = true; b.style.opacity = ".5"; b.title = "当前浏览器不支持录音";
      });
    } else {
      Array.prototype.forEach.call(document.querySelectorAll(".rb-tape"), function (b) {
        b.onclick = function () {
          var i = +b.getAttribute("data-i");
          var fb = document.querySelector('.read-fb[data-i="' + i + '"]');
          if (b.getAttribute("data-rec") === "1") {
            if (window._emRec && window._emRec.state === "recording") window._emRec.stop();
            b.setAttribute("data-rec", "0"); b.textContent = "🔴 录我的声音";
            return;
          }
          navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
            var chunks = [];
            var mr = new MediaRecorder(stream);
            window._emRec = mr;
            mr.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
            mr.onstop = function () {
              stream.getTracks().forEach(function (t) { t.stop(); });
              var blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
              var url = URL.createObjectURL(blob);
              fb.innerHTML = "";
              fb.appendChild(document.createTextNode("我的录音："));
              var au = document.createElement("audio"); au.controls = true; au.src = url;
              fb.appendChild(au); fb.className = "read-fb ok";
            };
            mr.start();
            b.setAttribute("data-rec", "1"); b.textContent = "⏹ 停止录制";
          }).catch(function (err) {
            fb.textContent = "麦克风打不开：" + err.message; fb.className = "read-fb low";
          });
        };
      });
    }

    // 语音识别打分
    if (!SR) {
      Array.prototype.forEach.call(document.querySelectorAll(".rb-record"), function (b) {
        b.disabled = true; b.style.opacity = ".5";
        b.title = "当前浏览器不支持语音识别，请用 Chrome / Edge，并在本机(localhost)或 https 下打开";
      });
    } else {
      Array.prototype.forEach.call(document.querySelectorAll(".rb-record"), function (b) {
        b.onclick = function () {
          var i = +b.getAttribute("data-i");
          var fb = document.querySelector('.read-fb[data-i="' + i + '"]');
          var rec = new SR();
          rec.lang = accentSel ? accentSel.value : "en-US";
          rec.interimResults = false; rec.maxAlternatives = 1;
          b.textContent = "🎙 听…"; b.disabled = true;
          rec.onresult = function (e) {
            var txt = e.results[0][0].transcript;
            var sc = speechScore(txt, list[i].en);
            var stars = Math.max(1, Math.round(sc * 5));
            var starStr = ""; for (var k = 0; k < 5; k++) starStr += (k < stars ? "⭐" : "☆");
            fb.innerHTML = "你说：<b>" + esc(txt) + "</b><br>匹配度 " + Math.round(sc * 100) + "%　" + starStr;
            fb.className = "read-fb " + (sc >= 0.6 ? "ok" : "low");
            markReadDone(m.id, i, sc >= 0.6);
          };
          rec.onerror = function (e) { fb.textContent = "识别失败：" + e.error; fb.className = "read-fb low"; };
          rec.onend = function () { b.textContent = "🎤 跟我读"; b.disabled = false; };
          try { rec.start(); } catch (err) { fb.textContent = "无法启动麦克风：" + err.message; b.textContent = "🎤 跟我读"; b.disabled = false; }
        };
      });
    }
    updateReadSummary(m.id, list.length);
  }

  function bindPractice(m) {
    var root = document.getElementById("app");
    // flashcard
    Array.prototype.forEach.call(root.querySelectorAll(".flip"), function (f) {
      f.onclick = function (e) {
        if (e.target.tagName === "BUTTON") return;
        f.classList.toggle("flipped");
      };
      Array.prototype.forEach.call(f.querySelectorAll(".rate button"), function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          f.style.opacity = b.getAttribute("data-r") === "1" ? ".55" : "1";
          f.classList.add("flipped");
        };
      });
    });
    // choice
    Array.prototype.forEach.call(root.querySelectorAll(".q .opt"), function (o) {
      o.onclick = function () {
        var q = o.parentNode.parentNode;
        if (q.querySelector(".feedback").textContent) return;
        var ans = o.getAttribute("data-ans");
        var picked = o.textContent;
        Array.prototype.forEach.call(q.querySelectorAll(".opt"), function (x) {
          if (x.textContent === ans) x.classList.add("right");
          else x.classList.add("wrong");
        });
        var fb = q.querySelector(".feedback");
        fb.textContent = (picked === ans) ? "🎉 答对了！" : "💡 正确答案：" + ans;
        fb.style.color = (picked === ans) ? "#1c7a4d" : "#b23b3b";
      };
    });
    // fill
    Array.prototype.forEach.call(root.querySelectorAll(".fill-q .check"), function (b) {
      b.onclick = function () {
        var q = b.parentNode;
        var inp = q.querySelector("input");
        var ans = q.getAttribute("data-ans").trim().toLowerCase();
        var val = inp.value.trim().toLowerCase();
        var res = q.querySelector(".res");
        if (val === ans) { res.textContent = "✅ 正确"; res.style.color = "#1c7a4d"; }
        else { res.textContent = "✏️ 应为 " + ans; res.style.color = "#b23b3b"; }
      };
    });
  }

  /* ---------- 撒花 ---------- */
  function confetti() {
    var c = el('<div class="confetti"></div>');
    var colors = ["#2bb673", "#2f80ed", "#eb5757", "#f2b705", "#9b51e0", "#00bcd4"];
    for (var i = 0; i < 60; i++) {
      var p = el("<i></i>");
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.4) + "s";
      p.style.transform = "rotate(" + (Math.random() * 360) + "deg)";
      c.appendChild(p);
    }
    document.body.appendChild(c);
    setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 2200);
  }

  /* ---------- 单词词库 ---------- */
  function gradeTabsHtml(cur) {
    var html = '<div class="grade-tabs">';
    html += '<span class="grade-tab ' + (cur === "primary" ? "active" : "") + '" data-grade="primary">小学</span>';
    html += '<span class="grade-tab ' + (cur === "junior" ? "active" : "") + '" data-grade="junior">初中</span>';
    html += '<span class="grade-tab ' + (cur === "senior" ? "active" : "") + '" data-grade="senior">高中</span>';
    html += "</div>";
    return html;
  }
  function renderWordsHome(grade) {
    var root = document.getElementById("app");
    var g = WORDS[grade] || WORDS.primary;
    var cards = (g.units || []).map(function (u) {
      return '<div class="card unit-card" data-grade="' + grade + '" data-unit="' + u.id + '">' +
        '<div class="top"><span class="icon">📘</span>' +
        '<span class="badge-grade" style="background:' + gradeColor(grade) + '">' + g.label + "</span></div>" +
        "<h3>" + esc(u.title) + "</h3>" +
        '<p class="summary">共 ' + u.words.length + " 个词</p>" +
        (g.note ? '<div class="meta"><span class="tag">📎 ' + esc(g.note) + "</span></div>" : "") +
        "</div>";
    }).join("");
    root.innerHTML =
      topTabsHtml("words") +
      gradeTabsHtml(grade) +
      '<div class="words-intro">选一个单元开始练：闪卡记词义、拼写自测、跟读练发音。</div>' +
      '<div class="grid">' + (cards || '<div class="empty">该年级暂无词库</div>') + "</div>";
    bindTopTabs();
    Array.prototype.forEach.call(root.querySelectorAll(".grade-tab"), function (t) {
      t.onclick = function () { state.wordGrade = t.getAttribute("data-grade"); location.hash = "#/words/" + state.wordGrade; };
    });
    Array.prototype.forEach.call(root.querySelectorAll(".unit-card"), function (c) {
      c.onclick = function () { location.hash = "#/words/" + c.getAttribute("data-grade") + "/" + c.getAttribute("data-unit"); };
    });
  }
  function renderWordUnit(grade, unitId, startMode) {
    var root = document.getElementById("app");
    var g = WORDS[grade] || WORDS.primary;
    var unit = null;
    (g.units || []).forEach(function (u) { if (u.id === unitId) unit = u; });
    if (!unit) { root.innerHTML = '<div class="empty">找不到该单元 😢</div>'; return; }
    var words = unit.words || [];

    // ① 巧记按教材单元自动关联：本单元哪些词有巧记，就列出来
    var ut = tricksForWords(words.map(function (w) { return w.en; }));
    var unitTricksHtml = ut.length ? (
      '<div class="mode-pane" id="pane-tricks" data-mode="tricks" style="display:none">' +
        '<div class="section-title"><span class="bar" style="background:var(--gold)"></span>💡 本单元易错巧记（' + ut.length + ' 条 · 点卡片翻面看巧记）</div>' +
        '<div class="grid trick-grid">' + trickCardsHtml(ut) + '</div>' +
      '</div>'
    ) : '';

    var flash = words.map(function (w, i) {
      var tr = trickFor(w.en);
      var trickHtml = tr ? '<div class="flash-trick">💡 ' + esc(tr.trick) + '</div>' : '';
      return '<div class="flip" data-i="' + i + '"><div class="inner">' +
        '<div class="face front">' + esc(w.en) + '<div class="rate"><button class="show-zh" data-i="' + i + '">看中文</button></div></div>' +
        '<div class="face back">' + esc(w.zh) + trickHtml +
          '<div class="rate w-rate"><button class="w-known" data-en="' + esc(w.en) + '">✓ 我会了</button><button class="w-unknown" data-en="' + esc(w.en) + '">✗ 还不会</button></div>' +
        "</div></div></div>";
    }).join("");

    root.innerHTML =
      topTabsHtml("words") +
      '<div class="detail words-detail">' +
      '<button class="back" id="back">← 返回单元列表</button>' +
      '<div class="head"><span class="icon">📘</span><div><h2>' + esc(unit.title) + '</h2>' +
      '<p class="sub">' + g.label + " · 共 " + words.length + " 个词</p></div></div>" +
      (g.note ? '<div class="why">📎 ' + esc(g.note) + "</div>" : "") +

      '<div class="read-toolbar">口音：' +
        '<select id="wordAccent"><option value="en-US">美音</option><option value="en-GB">英音</option></select>' +
        '<label class="read-slow"><input type="checkbox" id="wordSlow"> 慢速</label>' +
        '<span class="read-hint">听+跟读可练发音（推荐 Chrome / Edge，localhost 或 https 下可用）</span>' +
      "</div>" +

      '<div class="mode-tabs">' +
        '<span class="mode-tab active" data-mode="flash">🃏 闪卡</span>' +
        '<span class="mode-tab" data-mode="spell">✍️ 拼写自测</span>' +
        '<span class="mode-tab" data-mode="read">🎤 跟读</span>' +
        '<span class="mode-tab" data-mode="phonics">🔤 拼读拆解</span>' +
        (unitTricksHtml ? '<span class="mode-tab" data-mode="tricks">💡 本单元巧记</span>' : '') +
      '</div>' +

      '<div class="mode-pane" id="pane-flash" data-mode="flash">' +
        '<div class="section-title"><span class="bar"></span>🃏 闪卡：点卡片翻面看中文</div>' +
        '<div class="flashcard-deck">' + flash + "</div>" +
      '</div>' +

      '<div class="mode-pane" id="pane-spell" data-mode="spell" style="display:none">' +
        '<div class="section-title"><span class="bar" style="background:var(--gold)"></span>✍️ 拼写自测：看中文写英文</div>' +
        '<div class="run-box" id="spellRun"></div>' +
      '</div>' +

      '<div class="mode-pane" id="pane-read" data-mode="read" style="display:none">' +
        '<div class="section-title"><span class="bar" style="background:var(--primary)"></span>🎤 跟读：听示范后跟读打分</div>' +
        '<div class="run-box" id="readRun"></div>' +
      '</div>' +

      '<div class="mode-pane" id="pane-phonics" data-mode="phonics" style="display:none">' +
        '<div class="section-title"><span class="bar" style="background:var(--senior)"></span>🔤 拼读拆解：学 → 读 → 选 → 拆分 → 拼读 → 拼写</div>' +
        '<div class="run-box" id="phonicsRun"></div>' +
      '</div>' +
      unitTricksHtml +
      "</div>";

    var back = document.getElementById("back");
    if (back) back.onclick = function () { location.hash = "#/words/" + grade; };

    bindTopTabs();
    bindWordUnit(grade, unit);
    bindTrickCards(root);
    if (startMode) {
      var sm = document.querySelector('.mode-tab[data-mode="' + startMode + '"]');
      if (sm) sm.click();
    }
  }
  function bindWordUnit(grade, unit) {
    var words = unit.words || [];
    var accentSel = document.getElementById("wordAccent");
    var slowChk = document.getElementById("wordSlow");
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    function opt() { return { lang: accentSel ? accentSel.value : "en-US", rate: (slowChk && slowChk.checked) ? 0.7 : 1 }; }

    // 模式（闪卡 / 拼写 / 跟读）切换：一次只显示一个，页面不再被长列表撑爆
    Array.prototype.forEach.call(document.querySelectorAll(".mode-tab"), function (t) {
      t.onclick = function () {
        var mode = t.getAttribute("data-mode");
        Array.prototype.forEach.call(document.querySelectorAll(".mode-tab"), function (x) { x.classList.toggle("active", x === t); });
        Array.prototype.forEach.call(document.querySelectorAll(".mode-pane"), function (p) {
          p.style.display = (p.getAttribute("data-mode") === mode) ? "" : "none";
        });
        if (mode === "spell") renderSpellGroup(0);
        if (mode === "read") renderReadGroup(0);
        if (mode === "phonics") renderPhonics(0);
      };
    });

    // 闪卡翻面
    Array.prototype.forEach.call(document.querySelectorAll(".flip"), function (f) {
      f.onclick = function (e) {
        if (e.target.tagName === "BUTTON") return;
        f.classList.toggle("flipped");
      };
      Array.prototype.forEach.call(f.querySelectorAll(".show-zh"), function (b) {
        b.onclick = function (e) { e.stopPropagation(); f.classList.add("flipped"); };
      });
      Array.prototype.forEach.call(f.querySelectorAll(".w-known"), function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          recordUnitWord(unit.id, b.getAttribute("data-en"), true);
          f.classList.add("flipped");
          b.classList.add("on");
          var ub = f.querySelector(".w-unknown"); if (ub) ub.classList.remove("on");
        };
      });
      Array.prototype.forEach.call(f.querySelectorAll(".w-unknown"), function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          recordUnitWord(unit.id, b.getAttribute("data-en"), false);
          f.classList.add("flipped");
          b.classList.add("on");
          var kb = f.querySelector(".w-known"); if (kb) kb.classList.remove("on");
        };
      });
    });

    // 拼写自测：一组一组（每页 GROUP 个），可逐题核对或一键核对本组
    var spellRun = document.getElementById("spellRun");
    var GROUP = 5;
    var spellPage = 0;
    function renderSpellGroup(page) {
      if (!spellRun || !words.length) return;
      var total = Math.ceil(words.length / GROUP);
      spellPage = Math.max(0, Math.min(total - 1, page));
      var start = spellPage * GROUP;
      var slice = words.slice(start, start + GROUP);
      var rows = slice.map(function (w, k) {
        var gi = start + k;
        return '<div class="spell-row" data-ans="' + esc(w.en) + '">' +
          '<span class="sp-no">' + (gi + 1) + '</span>' +
          '<span class="sp-zh">' + esc(w.zh) + "</span>" +
          '<input class="sp-in" placeholder="拼写出英文" autocomplete="off">' +
          '<button class="check sp-check">核对</button>' +
          '<span class="res sp-res"></span>' +
        "</div>";
      }).join("");
      spellRun.innerHTML =
        '<div class="run-head">第 <span class="run-idx">' + (spellPage + 1) + "</span> / " + total + " 组 · 本组 " + slice.length + " 个</div>" +
        '<div class="spell-group">' + rows + "</div>" +
        '<div class="run-nav">' +
        '<button class="ghost" id="spellPrev"' + (spellPage === 0 ? " disabled" : "") + ">← 上一组</button>" +
        '<button class="check-all" id="spellAll">核对本组</button>' +
        '<button class="ghost" id="spellNext"' + (spellPage >= total - 1 ? " disabled" : "") + ">下一组 →</button>" +
        "</div>";
      Array.prototype.forEach.call(spellRun.querySelectorAll(".spell-row"), function (row) {
        var btn = row.querySelector(".sp-check");
        var inp = row.querySelector(".sp-in");
        var res = row.querySelector(".sp-res");
        if (inp) inp.onkeydown = function (e) { if (e.key === "Enter") btn.click(); };
        if (btn) btn.onclick = function () {
          var ans = row.getAttribute("data-ans").trim().toLowerCase();
          var val = inp.value.trim().toLowerCase();
          if (val === ans) { res.textContent = "✅ 正确"; res.style.color = "#1c7a4d"; }
          else { res.textContent = "✏️ 应为 " + row.getAttribute("data-ans"); res.style.color = "#b23b3b"; }
        };
      });
      var all = document.getElementById("spellAll");
      if (all) all.onclick = function () {
        Array.prototype.forEach.call(spellRun.querySelectorAll(".spell-row"), function (row) {
          var b = row.querySelector(".sp-check"); if (b) b.click();
        });
      };
      var prev = document.getElementById("spellPrev");
      var next = document.getElementById("spellNext");
      if (prev && spellPage > 0) prev.onclick = function () { renderSpellGroup(spellPage - 1); };
      if (next && spellPage < total - 1) next.onclick = function () { renderSpellGroup(spellPage + 1); };
    }

    // 跟读：一组一组（每页 GROUP 个），每行独立听示范 + 跟读打分
    var readRun = document.getElementById("readRun");
    var readPage = 0;
    function renderReadGroup(page) {
      if (!readRun || !words.length) return;
      var total = Math.ceil(words.length / GROUP);
      readPage = Math.max(0, Math.min(total - 1, page));
      var start = readPage * GROUP;
      var slice = words.slice(start, start + GROUP);
      var rows = slice.map(function (w, k) {
        var gi = start + k;
        return '<div class="read-row-word" data-i="' + gi + '">' +
          '<span class="rw-no">' + (gi + 1) + '</span>' +
          '<div class="rw-text"><span class="rw-en">' + esc(w.en) + '</span> <span class="rw-zh">(' + esc(w.zh) + ")</span></div>" +
          '<div class="rw-btns">' +
            '<button class="rb-play" data-i="' + gi + '">🔊 听</button>' +
            '<button class="rb-record" data-i="' + gi + '">🎤 跟读</button>' +
          "</div>" +
          '<div class="read-fb" data-i="' + gi + '"></div>' +
        "</div>";
      }).join("");
      readRun.innerHTML =
        '<div class="run-head">第 <span class="run-idx">' + (readPage + 1) + "</span> / " + total + " 组 · 本组 " + slice.length + " 个</div>" +
        '<div class="read-group">' + rows + "</div>" +
        '<div class="run-nav">' +
        '<button class="ghost" id="readPrev"' + (readPage === 0 ? " disabled" : "") + ">← 上一组</button>" +
        '<button class="ghost" id="readNext"' + (readPage >= total - 1 ? " disabled" : "") + ">下一组 →</button>" +
        "</div>";
      Array.prototype.forEach.call(readRun.querySelectorAll(".rb-play"), function (b) {
        b.onclick = function () { speak(words[+b.getAttribute("data-i")].en, opt()); };
      });
      Array.prototype.forEach.call(readRun.querySelectorAll(".rb-record"), function (b) {
        var i = +b.getAttribute("data-i");
        var fb = readRun.querySelector('.read-fb[data-i="' + i + '"]');
        if (!SR) { b.disabled = true; b.style.opacity = ".5"; b.title = "当前浏览器不支持语音识别，请用 Chrome / Edge，并在本机(localhost)或 https 下打开"; }
        else {
          b.onclick = function () {
            var rec = new SR();
            rec.lang = accentSel ? accentSel.value : "en-US";
            rec.interimResults = false; rec.maxAlternatives = 1;
            b.textContent = "🎙 听…"; b.disabled = true;
            rec.onresult = function (e) {
              var txt = e.results[0][0].transcript;
              var sc = speechScore(txt, words[i].en);
              var stars = Math.max(1, Math.round(sc * 5));
              var starStr = ""; for (var k = 0; k < 5; k++) starStr += (k < stars ? "⭐" : "☆");
              fb.innerHTML = "你说：<b>" + esc(txt) + "</b><br>匹配度 " + Math.round(sc * 100) + "%　" + starStr;
              fb.className = "read-fb " + (sc >= 0.6 ? "ok" : "low");
            };
            rec.onerror = function (e) { fb.textContent = "识别失败：" + e.error; fb.className = "read-fb low"; };
            rec.onend = function () { b.textContent = "🎤 跟读"; b.disabled = false; };
            try { rec.start(); } catch (err) { fb.textContent = "无法启动麦克风：" + err.message; b.textContent = "🎤 跟读"; b.disabled = false; }
          };
        }
      });
      var prev = document.getElementById("readPrev");
      var next = document.getElementById("readNext");
      if (prev && readPage > 0) prev.onclick = function () { renderReadGroup(readPage - 1); };
      if (next && readPage < total - 1) next.onclick = function () { renderReadGroup(readPage + 1); };
    }
    /* ---------- 拼读拆解（6 步：学 / 读 / 选 / 拆分 / 拼读 / 拼写） ---------- */
    var phRun = document.getElementById("phonicsRun");
    var STEP_LABELS = ["学", "读", "选", "拆分", "拼读", "拼写"];
    var phList = words.filter(function (w) { return window.phonicsFor && window.phonicsFor(w.en); });
    var phIdx = 0;
    var phStep = 0;

    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function playSeq(list, opts) {
      opts = opts || {};
      var syn = window.speechSynthesis;
      if (!syn) { alert("当前浏览器不支持语音朗读，请换 Chrome / Edge"); return; }
      var seq = list.filter(Boolean);
      var k = 0;
      (function next() {
        if (k >= seq.length) return;
        syn.cancel();
        var u = new SpeechSynthesisUtterance(seq[k]);
        var v = pickVoice(); if (v) u.voice = v;
        u.lang = (v && v.lang) || opt().lang || "en-US";
        u.rate = (opts.rate || opt().rate || 1) * 0.85;
        u.onend = function () { k++; setTimeout(next, opts.gap == null ? 220 : opts.gap); };
        syn.speak(u);
      })();
    }
    // 逐音拼读：把整词按音素序列依次读出（替代旧版「按音节字母碎片读」，后者 TTS 会把 py 读成 pee-eye）
    function speakPhonemes(info, slow) {
      var syn = window.speechSynthesis;
      if (!syn) { alert("当前浏览器不支持语音朗读，请换 Chrome / Edge"); return; }
      var toks = (info.ph || []).map(function (ph) {
        return window.PHONICS_BLEND[ph] || window.PHONICS_SPEAK[ph] || "";
      }).filter(Boolean);
      if (!toks.length) { speak(info.word || "", opt()); return; }
      var k = 0;
      (function next() {
        if (k >= toks.length) return;
        syn.cancel();
        var u = new SpeechSynthesisUtterance(toks[k]);
        var v = pickVoice(); if (v) u.voice = v;
        u.lang = (v && v.lang) || opt().lang;
        u.rate = slow ? 0.55 : 0.82;
        u.onend = function () { k++; setTimeout(next, 170); };
        syn.speak(u);
      })();
    }
    function allSplits(word) {
      var n = word.length, res = [], maxMask = (n > 12) ? 0 : (1 << (n - 1));
      if (maxMask) {
        for (var mask = 0; mask < maxMask; mask++) {
          var s = "";
          for (var i = 0; i < n; i++) { s += word[i]; if (i < n - 1 && ((mask >> i) & 1)) s += "·"; }
          res.push(s);
        }
      } else {
        for (var t = 0; t < 300; t++) {
          var m = 0; for (var b = 0; b < n - 1; b++) if (Math.random() < 0.3) m |= (1 << b);
          var ss = ""; for (var i2 = 0; i2 < n; i2++) { ss += word[i2]; if (i2 < n - 1 && ((m >> i2) & 1)) ss += "·"; }
          res.push(ss);
        }
      }
      return res;
    }
    var IPA_POOL = ["/æ/","/e/","/ɪ/","/ɒ/","/ʌ/","/ɑː/","/ɔː/","/eɪ/","/aɪ/","/aʊ/","/əʊ/","/iː/","/uː/","/ʊ/","/ɜː/","/ə/","/ʃ/","/tʃ/","/θ/","/ð/","/ŋ/","/s/","/z/"];
    function genWrongIpa(info) {
      var ph = (info.ph || []).slice();
      if (!ph.length) return info.ipa;
      var i = Math.floor(Math.random() * ph.length);
      ph[i] = IPA_POOL[Math.floor(Math.random() * IPA_POOL.length)];
      var body2 = ph.map(function (p) { return String(p).replace(/\//g, ""); }).join("");
      return "/" + body2 + "/";
    }

    function renderPhonics(start) {
      if (typeof start === "number") phIdx = start;
      if (!phRun) return;
      if (!phList.length) {
        phRun.innerHTML = '<div class="empty">本单元暂无可用于「拼读拆解」的单词（含空格、连字符或全大写缩写的词已自动跳过）。</div>';
        return;
      }
      var w = phList[phIdx];
      var info = window.phonicsFor(w.en);
      var wordTotal = phList.length;

      var stepBar = STEP_LABELS.map(function (lab, i) {
        return '<span class="ph-step ' + (i === phStep ? "active" : (i < phStep ? "done" : "")) + '" data-step="' + i + '">' + (i + 1) + ". " + lab + "</span>";
      }).join("");

      phRun.innerHTML =
        '<div class="ph-head">' +
          (phStep === 5
            ? '<div class="ph-word ph-word-quiz"><span class="ph-lock">🔒 听音拼写</span> <span class="ph-zh">(' + esc(w.zh) + ')</span></div>'
            : '<div class="ph-word">' + esc(w.en) + ' <span class="ph-zh">(' + esc(w.zh) + ')</span></div>'
          ) +
          '<div class="ph-badge ' + (info.src === "curated" ? "ok" : "rule") + '">' + (info.src === "curated" ? "✓ 已校对" : "≈ 规则推导") + '</div>' +
        '</div>' +
        '<div class="ph-stepbar">' + stepBar + '</div>' +
        '<div class="ph-body" id="phBody"></div>' +
        '<div class="run-nav">' +
          '<button class="ghost" id="phStepPrev"' + (phStep === 0 ? " disabled" : "") + '>← 上一步</button>' +
          '<button class="ghost" id="phWordPrev"' + (phIdx === 0 ? " disabled" : "") + '>← 上一个词</button>' +
          '<span class="ph-counter">第 ' + (phIdx + 1) + " / " + wordTotal + ' 词</span>' +
          '<button class="ghost" id="phWordNext"' + (phIdx >= wordTotal - 1 ? " disabled" : "") + '>下一个词 →</button>' +
          '<button class="ghost" id="phStepNext"' + (phStep >= 5 ? " disabled" : "") + '>下一步 →</button>' +
        '</div>';

      Array.prototype.forEach.call(phRun.querySelectorAll(".ph-step"), function (s) {
        s.onclick = function () { phStep = +s.getAttribute("data-step"); renderPhonics(); };
      });
      var sp = document.getElementById("phStepPrev"); if (sp && phStep > 0) sp.onclick = function () { phStep--; renderPhonics(); };
      var sn = document.getElementById("phStepNext"); if (sn && phStep < 5) sn.onclick = function () { phStep++; renderPhonics(); };
      var wp = document.getElementById("phWordPrev"); if (wp && phIdx > 0) wp.onclick = function () { phIdx--; phStep = 0; renderPhonics(); };
      var wn = document.getElementById("phWordNext"); if (wn && phIdx < wordTotal - 1) wn.onclick = function () { phIdx++; phStep = 0; renderPhonics(); };

      bindStep(phStep, info, w);
    }

    function bindStep(step, info, w) {
      var body = document.getElementById("phBody");
      if (!body) return;

      if (step === 0) {
        var mapRows = info.seg.map(function (p) {
          var ipa = p[1];
          var snd = ipa ? (window.PHONICS_BLEND[ipa] || "") : "";
          var ex = ipa ? (window.PHONICS_SPEAK[ipa] || "") : "";
          var sCls = ipa ? "" : " silent";
          return '<div class="ph-grapheme' + sCls + '" data-sound="' + esc(snd) + '" data-word="' + esc(ex) + '">' +
            '<span class="ph-g">' + esc(p[0]) + '</span>' +
            '<span class="ph-s">' + (ipa ? esc(ipa) : "∅") + '</span>' +
            (ipa
              ? '<span class="ph-a"><i class="ph-lbl">例词</i>' + esc(ex || "—") + '</span>'
              : '<span class="ph-a">不发音</span>') +
          '</div>';
        }).join("");
        body.innerHTML =
          '<div class="ph-learn-word">' + esc(w.en) + '</div>' +
          '<div class="ph-syl">' + info.syl.map(function (s) { return esc(s); }).join('<span class="dot">·</span>') + '</div>' +
          '<div class="ph-ipa">' + esc(info.ipa) + '</div>' +
          '<button class="ph-play" id="phWhole">🔊 听整词</button>' +
          '<div class="section-title"><span class="bar"></span>字母组合 → 发音（点格子：先听该音，再听例词）</div>' +
          '<div class="ph-map" id="phMap">' + mapRows + '</div>' +
          '<div class="ph-note">点格子会先读该音的近似读法（如 f → 「fuh」），再读一个例词帮记忆；整词的标准发音请点「听整词」。灰色「∅ / 不发音」表示该字母组合不发音（如 write 的 w、have 的 e）。规则推导词仅供参考，音标以词典 / 教材为准。</div>';
        var whole = document.getElementById("phWhole"); if (whole) whole.onclick = function () { speak(w.en, opt()); };
        Array.prototype.forEach.call(body.querySelectorAll(".ph-grapheme"), function (t) {
          t.onclick = function () {
            var snd = t.getAttribute("data-sound");
            var ex = t.getAttribute("data-word");
            var seq = (snd && ex && snd !== ex) ? [snd, ex] : [ex || snd];
            if (!seq[0]) return;
            playSeq(seq, { gap: 280 });
          };
        });

      } else if (step === 1) {
        body.innerHTML =
          '<div class="ph-big">' + esc(w.en) + '</div>' +
          '<div class="ph-syl">' + info.syl.map(function (s) { return esc(s); }).join('<span class="dot">·</span>') + '</div>' +
          '<div class="ph-read-btns">' +
            '<button class="ph-play" id="phWhole2">🔊 听示范</button>' +
            '<button class="ph-play" id="phSyl">🔊 音素拼读</button>' +
            '<button class="ph-rec" id="phRec">🎤 跟我读</button>' +
          '</div>' +
          '<div class="read-fb" id="phReadFb"></div>' +
          '<div class="ph-note">「跟我读」需要麦克风权限，且仅在 localhost 或 https 下、用 Chrome / Edge 可用。</div>';
        var whole2 = document.getElementById("phWhole2"); if (whole2) whole2.onclick = function () { speak(w.en, opt()); };
        var sylB = document.getElementById("phSyl"); if (sylB) sylB.onclick = function () { speakPhonemes(info, false); };
        var rec2 = document.getElementById("phRec");
        var fb2 = document.getElementById("phReadFb");
        if (!SR) { if (rec2) { rec2.disabled = true; rec2.style.opacity = ".5"; rec2.title = "当前浏览器不支持语音识别，请用 Chrome / Edge，并在本机(localhost)或 https 下打开"; } }
        else if (rec2) {
          rec2.onclick = function () {
            var rec = new SR();
            rec.lang = accentSel ? accentSel.value : "en-US";
            rec.interimResults = false; rec.maxAlternatives = 1;
            rec2.textContent = "🎙 听…"; rec2.disabled = true;
            rec.onresult = function (e) {
              var txt = e.results[0][0].transcript;
              var sc = speechScore(txt, w.en);
              var stars = Math.max(1, Math.round(sc * 5));
              var starStr = ""; for (var kk = 0; kk < 5; kk++) starStr += (kk < stars ? "⭐" : "☆");
              fb2.innerHTML = "你说：<b>" + esc(txt) + "</b><br>匹配度 " + Math.round(sc * 100) + "%　" + starStr;
              fb2.className = "read-fb " + (sc >= 0.6 ? "ok" : "low");
            };
            rec.onerror = function (e) { fb2.textContent = "识别失败：" + e.error; fb2.className = "read-fb low"; };
            rec.onend = function () { rec2.textContent = "🎤 跟我读"; rec2.disabled = false; };
            try { rec.start(); } catch (err) { fb2.textContent = "无法启动麦克风：" + err.message; rec2.textContent = "🎤 跟我读"; rec2.disabled = false; }
          };
        }

      } else if (step === 2) {
        var choices, correctStr, qtext;
        if (info.syl.length > 1) {
          correctStr = info.syl.join("·");
          qtext = "这个词怎么分音节？选出正确的一项";
          var pool = allSplits(w.en).filter(function (s) { return s !== correctStr; });
          shuffle(pool);
          choices = [correctStr];
          if (pool[0]) choices.push(pool[0]);
          if (pool[1]) choices.push(pool[1]);
          while (choices.length < 3) { var alt = correctStr.split("").reverse().join(""); if (choices.indexOf(alt) < 0) choices.push(alt); else break; }
        } else {
          correctStr = info.ipa;
          qtext = "这个单词的正确音标是？选出正确的一项";
          var wp2 = [genWrongIpa(info), genWrongIpa(info)];
          choices = [correctStr];
          if (wp2[0]) choices.push(wp2[0]);
          if (wp2[1] && wp2[1] !== correctStr) choices.push(wp2[1]);
          if (choices.length < 3 && wp2[1]) choices.push(wp2[1]);
        }
        shuffle(choices);
        body.innerHTML =
          '<div class="ph-big">' + esc(w.en) + '</div>' +
          '<div class="ph-q">' + qtext + '</div>' +
          '<div class="ph-choices" id="phChoices" data-ans="' + esc(correctStr) + '">' +
            choices.map(function (c) { return '<button class="ph-choice" data-c="' + esc(c) + '">' + esc(c) + '</button>'; }).join("") +
          '</div>' +
          '<div class="read-fb" id="phSelFb"></div>';
        Array.prototype.forEach.call(body.querySelectorAll(".ph-choice"), function (b) {
          b.onclick = function () {
            var ans = body.querySelector("#phChoices").getAttribute("data-ans");
            var pick = b.getAttribute("data-c");
            if (pick === ans) {
              b.classList.add("right");
              var f = document.getElementById("phSelFb");
              f.textContent = "✅ 正确！" + (info.syl.length > 1 ? ("音节切分：" + info.syl.join("·")) : ("音标：" + info.ipa));
              f.className = "read-fb ok";
            } else {
              b.classList.add("wrong");
              var f2 = document.getElementById("phSelFb");
              f2.textContent = "💡 正确答案：" + ans;
              f2.className = "read-fb low";
            }
            Array.prototype.forEach.call(body.querySelectorAll(".ph-choice"), function (x) { x.disabled = true; });
          };
        });

      } else if (step === 3) {
        var sylCuts = []; var cum = 0;
        for (var si = 0; si < info.syl.length - 1; si++) { cum += info.syl[si].length; sylCuts.push(cum); }
        var gStart = 0; var correctBreaks = {};
        for (var gi = 0; gi < info.seg.length; gi++) {
          var glen = info.seg[gi][0].length;
          var gEnd = gStart + glen;
          if (gi < info.seg.length - 1 && sylCuts.indexOf(gEnd) >= 0) correctBreaks[gi] = true;
          gStart = gEnd;
        }
        var q3 = "点击字母之间的「·」标出音节断点，再点「核对」。" + (info.syl.length === 1 ? "（这个单词只有一个音节，不用点断点）" : "");
        var tiles = "";
        for (var t = 0; t < info.seg.length; t++) {
          tiles += '<span class="ph-tile" data-gi="' + t + '">' + esc(info.seg[t][0]) + '</span>';
          if (t < info.seg.length - 1) tiles += '<span class="ph-gap" data-gap="' + t + '">·</span>';
        }
        body.innerHTML =
          '<div class="ph-big">' + esc(w.en) + '</div>' +
          '<div class="ph-q">' + q3 + '</div>' +
          '<div class="ph-split" id="phSplit">' + tiles + '</div>' +
          '<div class="ph-split-preview" id="phSplitPrev"></div>' +
          '<div class="ph-read-btns">' +
            '<button class="check-all" id="phSplitCheck">核对</button>' +
            '<button class="ghost" id="phSplitAns">显示答案</button>' +
          '</div>' +
          '<div class="read-fb" id="phSplitFb"></div>';
        var active = {};
        function buildSplit() {
          var parts = []; var cur = "";
          for (var t2 = 0; t2 < info.seg.length; t2++) { cur += info.seg[t2][0]; if (active[t2]) { parts.push(cur); cur = ""; } }
          parts.push(cur);
          return parts;
        }
        Array.prototype.forEach.call(body.querySelectorAll(".ph-gap"), function (g) {
          g.onclick = function () {
            var idx = +g.getAttribute("data-gap");
            if (active[idx]) { delete active[idx]; g.classList.remove("on"); } else { active[idx] = true; g.classList.add("on"); }
            var pv = document.getElementById("phSplitPrev");
            if (pv) pv.textContent = "你的切分：" + buildSplit().join(" · ");
          };
        });
        var checkB = document.getElementById("phSplitCheck");
        if (checkB) checkB.onclick = function () {
          var fb = document.getElementById("phSplitFb");
          if (buildSplit().join("·") === info.syl.join("·")) { fb.textContent = "✅ 切分正确：" + info.syl.join("·"); fb.className = "read-fb ok"; }
          else { fb.textContent = "💡 还不对，正确切分是：" + info.syl.join(" · "); fb.className = "read-fb low"; }
        };
        var ansB = document.getElementById("phSplitAns");
        if (ansB) ansB.onclick = function () {
          var fb = document.getElementById("phSplitFb");
          fb.textContent = "正确切分：" + info.syl.join(" · ");
          fb.className = "read-fb ok";
        };

      } else if (step === 4) {
        body.innerHTML =
          '<div class="ph-big">' + esc(w.en) + '</div>' +
          '<div class="ph-syl-blocks" id="phSylBlocks">' +
            info.syl.map(function (s, i) { return '<span class="ph-syl-block" data-i="' + i + '">' + esc(s) + '</span>'; }).join('<span class="ph-arrow">→</span>') +
          '</div>' +
          '<div class="ph-read-btns">' +
            '<button class="ph-play" id="phBlendEach">🔊 音素慢读</button>' +
            '<button class="ph-play" id="phBlendAll">🔊 连起来拼读</button>' +
          '</div>' +
          '<div class="ph-note">先逐音拼读，再跟着连起来读（听整词）。会了就点「✅ 我会拼读了」。</div>' +
          '<button class="check-all" id="phBlendOk">✅ 我会拼读了</button>';
        var eachB = document.getElementById("phBlendEach"); if (eachB) eachB.onclick = function () { speakPhonemes(info, true); };
        var allB = document.getElementById("phBlendAll"); if (allB) allB.onclick = function () { speak(w.en, opt()); };
        var okB = document.getElementById("phBlendOk"); if (okB) okB.onclick = function () { okB.textContent = "🎉 太棒了！"; okB.classList.add("done"); };

      } else if (step === 5) {
        body.innerHTML =
          '<div class="ph-q">听发音，写出这个单词的拼写：<span class="ph-zh">（' + esc(w.zh) + '）</span></div>' +
          '<div class="ph-spell-row">' +
            '<button class="ph-play" id="phSpellPlay">🔊 听</button>' +
            '<input class="ph-spell-in" id="phSpellIn" placeholder="拼写出英文" autocomplete="off" />' +
            '<button class="check" id="phSpellCheck">核对</button>' +
            '<span class="res" id="phSpellRes"></span>' +
          '</div>' +
          '<div class="ph-note">听录音写单词（本题不显示单词，只给词义）；卡住了可点「音节提示」。' +
            '<button class="ghost ph-hint-btn" id="phSpellHint">🔍 音节提示（共 ' + info.syl.length + ' 个音节）</button>' +
            '<span class="ph-hint-txt" id="phSpellHintTxt"></span>' +
          '</div>';
        var playB = document.getElementById("phSpellPlay"); if (playB) playB.onclick = function () { speak(w.en, opt()); };
        var hintB = document.getElementById("phSpellHint");
        var hintTxt = document.getElementById("phSpellHintTxt");
        if (hintB) hintB.onclick = function () {
          if (hintTxt) hintTxt.textContent = " 音节 = " + info.syl.join(" · ") + (info.src === "rule" ? "（音标为规则推导，仅供参考）" : "");
          hintB.style.display = "none";
        };
        var inp = document.getElementById("phSpellIn");
        var resEl = document.getElementById("phSpellRes");
        function doCheck() {
          if (!inp || !resEl) return;
          var ans = w.en.trim().toLowerCase();
          var val = inp.value.trim().toLowerCase();
          if (val === ans) { resEl.textContent = "✅ 正确"; resEl.style.color = "#1c7a4d"; }
          else { resEl.textContent = "✏️ 应为 " + w.en; resEl.style.color = "#b23b3b"; }
        }
        if (inp) { inp.onkeydown = function (e) { if (e.key === "Enter") doCheck(); }; inp.focus(); }
        var chk = document.getElementById("phSpellCheck"); if (chk) chk.onclick = doCheck;
      }
    }

  }

  /* ---------- 课文跟读（人教版 PEP 句库 + 听示范 + 语音识别逐词批改） ---------- */
  function renderTextbook(hashStr) {
    var root = document.getElementById("app");
    var TB = window.TEXTBOOK || [];
    var h = hashStr || "#/textbook";
    var parts = h.replace(/^#\/textbook\/?/, "").split("/").filter(Boolean);
    var gradeKey = parts[0], unitId = parts[1];
    var grade = null;
    if (gradeKey) { for (var i = 0; i < TB.length; i++) if (TB[i].key === gradeKey) grade = TB[i]; }
    if (!grade && TB.length) grade = TB[0];

    if (unitId && grade) { renderTextbookUnit(grade, unitId); return; }

    var tabs = '<div class="grade-tabs">';
    TB.forEach(function (g) {
      tabs += '<span class="grade-tab ' + (grade && g.key === grade.key ? "active" : "") + '" data-grade="' + g.key + '">' + esc(g.label) + '</span>';
    });
    tabs += '</div>';
    var cards = (grade.units || []).map(function (u) {
      return '<div class="card unit-card" data-grade="' + grade.key + '" data-unit="' + u.id + '">' +
        '<div class="top"><span class="icon">📖</span>' +
        '<span class="badge-grade" style="background:' + gradeColor("primary") + '">' + esc(grade.label) + '</span></div>' +
        '<h3>' + esc(u.title) + '</h3>' +
        '<p class="summary">共 ' + (u.sentences ? u.sentences.length : 0) + ' 句</p>' +
        '</div>';
    }).join("");
    root.innerHTML = topTabsHtml("textbook") + tabs +
      '<div class="words-intro">选一个单元，点句子听示范、再「跟我读」，系统会自动逐词批改对不对（推荐 Chrome / Edge，localhost 或 https 下可用）。</div>' +
      '<div class="grid">' + (cards || '<div class="empty">该年级暂无课文</div>') + '</div>';
    bindTopTabs();
    Array.prototype.forEach.call(root.querySelectorAll(".grade-tab"), function (t) {
      t.onclick = function () { location.hash = "#/textbook/" + t.getAttribute("data-grade"); };
    });
    Array.prototype.forEach.call(root.querySelectorAll(".unit-card"), function (c) {
      c.onclick = function () { location.hash = "#/textbook/" + c.getAttribute("data-grade") + "/" + c.getAttribute("data-unit"); };
    });
  }
  function renderTextbookUnit(grade, unitId) {
    var root = document.getElementById("app");
    var unit = null;
    (grade.units || []).forEach(function (u) { if (u.id === unitId) unit = u; });
    if (!unit) { root.innerHTML = '<div class="empty">找不到该单元 😢</div>'; return; }
    var list = unit.sentences || [];
    var rows = list.map(function (s, i) {
      return '<div class="read-row tb-row" data-i="' + i + '">' +
        '<div class="read-en">' + esc(s.en) + '</div>' +
        '<div class="read-zh">' + (s.zh ? esc(s.zh) : "") + '</div>' +
        '<div class="read-btns">' +
          '<button class="rb-play" data-i="' + i + '">▶ 听示范</button>' +
          '<button class="rb-record" data-i="' + i + '">🎤 跟我读</button>' +
        '</div>' +
        '<div class="read-fb" data-i="' + i + '"></div>' +
      '</div>';
    }).join("");
    root.innerHTML = topTabsHtml("textbook") +
      '<div class="detail words-detail">' +
      '<button class="back" id="back">← 返回单元列表</button>' +
      '<div class="head"><span class="icon">📖</span><div><h2>' + esc(unit.title) + '</h2>' +
      '<p class="sub">' + esc(grade.label) + ' · ' + esc(grade.edition) + ' · 共 ' + list.length + ' 句</p></div></div>' +
      '<div class="read-toolbar">口音：' +
        '<select id="tbAccent"><option value="en-US">美音</option><option value="en-GB">英音</option></select>' +
        '<label class="read-slow"><input type="checkbox" id="tbSlow"> 慢速</label>' +
        '<span class="read-hint">听示范后跟读，语音识别逐词批改</span>' +
      '</div>' +
      '<div class="read-box">' + rows +
        '<div class="read-summary" id="readSummary"></div>' +
      '</div>' +
      '</div>';
    var back = document.getElementById("back");
    if (back) back.onclick = function () { location.hash = "#/textbook/" + grade.key; };
    bindTopTabs();
    bindTextbook(grade, unit, list);
  }
  function bindTextbook(grade, unit, list) {
    if (!list.length) return;
    var accentSel = document.getElementById("tbAccent");
    var slowChk = document.getElementById("tbSlow");
    var key = "tb:" + grade.key + ":" + unit.id;
    Array.prototype.forEach.call(document.querySelectorAll(".rb-play"), function (b) {
      b.onclick = function () { speak(list[+b.getAttribute("data-i")].en, { lang: accentSel ? accentSel.value : "en-US", rate: (slowChk && slowChk.checked) ? 0.7 : 1 }); };
    });
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      Array.prototype.forEach.call(document.querySelectorAll(".rb-record"), function (b) {
        b.disabled = true; b.style.opacity = ".5";
        b.title = "当前浏览器不支持语音识别，请用 Chrome / Edge，并在 localhost 或 https 下打开";
      });
    } else {
      Array.prototype.forEach.call(document.querySelectorAll(".rb-record"), function (b) {
        b.onclick = function () {
          var i = +b.getAttribute("data-i");
          var fb = document.querySelector('.read-fb[data-i="' + i + '"]');
          var rec = new SR();
          rec.lang = accentSel ? accentSel.value : "en-US";
          rec.interimResults = false; rec.maxAlternatives = 1;
          b.textContent = "🎙 听…"; b.disabled = true;
          rec.onresult = function (e) {
            var txt = e.results[0][0].transcript;
            var r = speechScoreDetail(txt, list[i].en);
            var stars = Math.max(1, Math.round(r.score * 5));
            var starStr = ""; for (var k = 0; k < 5; k++) starStr += (k < stars ? "⭐" : "☆");
            var wordsHtml = r.detail.map(function (d) { return '<span class="w ' + (d.ok ? "ok" : "miss") + '">' + esc(d.w) + '</span>'; }).join(" ");
            fb.innerHTML = "你说：<b>" + esc(txt) + "</b><br>" +
              '<span class="tb-target">标准逐词：' + wordsHtml + '</span><br>' +
              "匹配度 " + Math.round(r.score * 100) + "%　" + starStr;
            fb.className = "read-fb " + (r.score >= 0.6 ? "ok" : "low");
            markTextbookDone(key, i, r.score >= 0.6, list.length);
          };
          rec.onerror = function (e) { fb.textContent = "识别失败：" + e.error; fb.className = "read-fb low"; };
          rec.onend = function () { b.textContent = "🎤 跟我读"; b.disabled = false; };
          try { rec.start(); } catch (err) { fb.textContent = "无法启动麦克风：" + err.message; b.textContent = "🎤 跟我读"; b.disabled = false; }
        };
      });
    }
    updateTextbookSummary(key, list.length);
  }
  function markTextbookDone(key, i, ok, total) {
    if (!ok) return;
    var o = loadRead();
    if (!o[key]) o[key] = [];
    if (o[key].indexOf(i) < 0) { o[key].push(i); saveRead(o); }
    updateTextbookSummary(key, total);
  }
  function updateTextbookSummary(key, total) {
    var sum = document.getElementById("readSummary");
    if (!sum) return;
    var o = loadRead();
    var done = (o[key] || []).length;
    if (total && done >= total) sum.innerHTML = "🎉 本单元跟读通关！" + done + "/" + total + " 句都达标啦";
    else sum.textContent = "已完成 " + done + "/" + total + " 句跟读（逐词匹配度 ≥ 60% 算达标）";
  }

  /* ---------- 同步课堂（国家平台课程视频） ---------- */
  function renderCourses(hashStr) {
    var root = document.getElementById("app");
    var C = window.COURSES || {};
    if (!C.grades || !C.grades.length) {
      root.innerHTML = topTabsHtml("courses") + '<div class="empty">暂未配置课程。运行 tools/fetch_courses.js 拉取国家平台课程。</div>';
      bindTopTabs();
      return;
    }
    var h = hashStr || "#/courses";
    var parts = h.replace(/^#\/courses\/?/, "").split("/").filter(Boolean);
    var gradeKey = parts[0], volKey = parts[1], unitIdx = parts[2] !== undefined ? parseInt(parts[2], 10) : -1;
    var grade = null;
    for (var i = 0; i < C.grades.length; i++) if (C.grades[i].key === gradeKey) grade = C.grades[i];
    if (!grade) grade = C.grades[0];
    var vol = null;
    for (var j = 0; j < (grade.volumes || []).length; j++) if (grade.volumes[j].key === volKey) vol = grade.volumes[j];
    if (!vol && grade.volumes && grade.volumes.length) vol = grade.volumes[0];

    if (vol && unitIdx >= 0 && vol.units && vol.units[unitIdx] !== undefined) { renderCoursesUnit(grade, vol, unitIdx, C); return; }

    var gtabs = '<div class="grade-tabs">';
    C.grades.forEach(function (g) {
      gtabs += '<span class="grade-tab ' + (g.key === grade.key ? "active" : "") + '" data-grade="' + g.key + '">' + esc(g.label) + '</span>';
    });
    gtabs += '</div>';
    var vtabs = '<div class="vol-tabs">';
    (grade.volumes || []).forEach(function (v) {
      vtabs += '<span class="vol-tab ' + (v.key === vol.key ? "active" : "") + '" data-vol="' + v.key + '">' + esc(v.label) + '</span>';
    });
    vtabs += '</div>';
    var cards = (vol.units || []).map(function (u, idx) {
      var n = (u.lessons || []).length;
      var dl = (u.lessons || []).filter(function (l) { return l.local; }).length;
      return '<div class="card unit-card" data-grade="' + grade.key + '" data-vol="' + vol.key + '" data-unit="' + idx + '">' +
        '<div class="top"><span class="icon">📺</span>' +
        '<span class="badge-grade" style="background:' + gradeColor("primary") + '">' + esc(grade.label) + ' · ' + esc(vol.label) + '</span></div>' +
        '<h3>' + esc(u.title) + '</h3>' +
        '<p class="summary">' + n + ' 课时' + (dl ? ' · 已下 ' + dl : '') + '</p>' +
        '</div>';
    }).join("");
    var note = C.note ? '<div class="courses-note">' + esc(C.note) + '</div>' : '';
    root.innerHTML = topTabsHtml("courses") + gtabs + vtabs + note +
      '<div class="words-intro">选单元看国家平台同步课。绿标「已下」= 已下到本地可离线播放；没下的点「在平台看」跳转（需登录）。</div>' +
      '<div class="grid">' + (cards || '<div class="empty">该册暂无单元</div>') + '</div>';
    bindTopTabs();
    Array.prototype.forEach.call(root.querySelectorAll(".grade-tab"), function (t) {
      t.onclick = function () { location.hash = "#/courses/" + t.getAttribute("data-grade"); };
    });
    Array.prototype.forEach.call(root.querySelectorAll(".vol-tab"), function (t) {
      t.onclick = function () { location.hash = "#/courses/" + grade.key + "/" + t.getAttribute("data-vol"); };
    });
    Array.prototype.forEach.call(root.querySelectorAll(".unit-card"), function (c) {
      c.onclick = function () { location.hash = "#/courses/" + c.getAttribute("data-grade") + "/" + c.getAttribute("data-vol") + "/" + c.getAttribute("data-unit"); };
    });
  }
  function renderCoursesUnit(grade, vol, unitIdx, C) {
    var root = document.getElementById("app");
    var unit = vol.units[unitIdx];
    var list = unit.lessons || [];
    var rows = list.map(function (l, i) {
      var media;
      if (l.local) {
        media = '<video class="lesson-video" data-src="' + esc(l.local) + '" controls preload="metadata"></video>' +
          '<div class="lesson-dlstate ok">✅ 已下载 · 离线可看</div>';
      } else {
        media = '<div class="lesson-dlstate">⬇ 未下载到本地（点右侧「在平台看」可在线观看；或跑 download_courses.js 下到本地）</div>';
      }
      return '<div class="lesson-row" data-i="' + i + '">' +
        '<div class="lesson-title">▶ ' + esc(l.title) + '</div>' +
        '<div class="lesson-media">' + media + '</div>' +
        '<div class="lesson-actions">' +
        (l.platform ? '<a class="lesson-link" href="' + esc(l.platform) + '" target="_blank" rel="noopener">▶ 在平台看</a>' : '') +
        '</div>' +
        '</div>';
    }).join("");
    root.innerHTML = topTabsHtml("courses") +
      '<div class="detail words-detail">' +
      '<button class="back" id="back">← 返回单元列表</button>' +
      '<div class="head"><span class="icon">📺</span><div><h2>' + esc(unit.title) + '</h2>' +
      '<p class="sub">' + esc(grade.label) + ' · ' + esc(vol.label) + ' · ' + esc(C.edition || '') + ' · ' + list.length + ' 课时</p></div></div>' +
      '<div class="lesson-box">' + rows + '</div>' +
      '</div>';
    var back = document.getElementById("back");
    if (back) back.onclick = function () { location.hash = "#/courses/" + grade.key + "/" + vol.key; };
    bindTopTabs();
    bindCoursesMedia();
  }
  function bindCoursesMedia() {
    Array.prototype.forEach.call(document.querySelectorAll(".lesson-video"), function (v) {
      var src = v.getAttribute("data-src");
      if (!src) return;
      if (/\.m3u8($|\?)/i.test(src)) {
        ensureHls(function () {
          if (window.Hls && window.Hls.isSupported && window.Hls.isSupported()) {
            var hls = new window.Hls();
            hls.loadSource(src); hls.attachMedia(v);
            v._hls = hls;
          } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
            v.src = src;
          } else {
            showMediaFallback(v);
          }
        });
      } else {
        v.src = src;
      }
      v.addEventListener("error", function () { showMediaFallback(v); });
    });
  }
  function showMediaFallback(v) {
    var box = v.parentNode;
    if (!box) return;
    var p = document.createElement("div");
    p.className = "lesson-dlstate";
    p.textContent = "本地视频文件缺失（运行 download_courses.js 下载后可见；或点「在平台看」在线观看）";
    v.style.display = "none";
    box.appendChild(p);
  }
  function ensureHls(cb) {
    if (window.Hls) return cb();
    var s = document.createElement("script");
    s.src = "js/lib/hls.min.js";
    s.onload = function () { cb(); };
    s.onerror = function () { cb(); };
    document.head.appendChild(s);
  }

  /* ---------- 单词巧记（WORD_TRICKS 种子 + 用户自增 + 进度记忆） ---------- */
  function loadUserTricks() {
    try { return JSON.parse(localStorage.getItem(LS_TRICKS_USER)) || []; } catch (e) { return []; }
  }
  function saveUserTricks(arr) { localStorage.setItem(LS_TRICKS_USER, JSON.stringify(arr)); }
  function loadTrickDone() {
    try { return JSON.parse(localStorage.getItem(LS_TRICKS_DONE)) || {}; } catch (e) { return {}; }
  }
  function saveTrickDone(o) { localStorage.setItem(LS_TRICKS_DONE, JSON.stringify(o)); }
  // 在任意单词练习（闪卡背面）里查该词的巧记
  function trickFor(word) {
    if (!word) return null;
    var w = String(word).trim().toLowerCase();
    for (var i = 0; i < TRICKS.length; i++) if (TRICKS[i].word === w) return TRICKS[i];
    var u = loadUserTricks();
    for (var j = 0; j < u.length; j++) if (u[j].word === w) return u[j];
    return null;
  }
  function trickGradeLabel(g) {
    if (g === "primary") return "小学";
    if (g === "junior") return "初中";
    if (g === "senior") return "高中";
    return "通用";
  }
  function trickListFiltered() {
    var seed = TRICKS || [];
    var user = loadUserTricks();
    var all = seed.concat(user.map(function (t) {
      return { word: t.word, zh: t.zh, trick: t.trick, method: t.method || "自创", grade: t.grade || "all", mine: true };
    }));
    return all.filter(function (t) {
      if (state.trickGrade !== "all" && t.grade !== "all" && t.grade !== state.trickGrade) return false;
      if (state.trickQ) {
        var q = state.trickQ.toLowerCase();
        var hay = (t.word + " " + t.zh + " " + t.trick + " " + (t.method || "")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }
  // 给定一组单词（单元词表），返回与之匹配的巧记（种子 + 用户自增）
  function tricksForWords(wordArr) {
    var set = {};
    (wordArr || []).forEach(function (w) { set[String(w).trim().toLowerCase()] = true; });
    var out = [];
    (TRICKS || []).forEach(function (t) { if (set[t.word]) out.push(t); });
    loadUserTricks().forEach(function (t) {
      if (set[t.word]) out.push({ word: t.word, zh: t.zh, trick: t.trick, method: t.method || "自创", grade: t.grade || "all", mine: true, img: t.img });
    });
    return out;
  }
  // 把用户上传的图片压成缩略图 dataURL（最大边 480，JPEG 0.7），避免撑爆 localStorage 配额
  function fileToThumb(file, cb) {
    if (!file) { cb(""); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 480, w = img.width, hgt = img.height;
        if (w > max || hgt > max) { if (w >= hgt) { hgt = Math.round(hgt * max / w); w = max; } else { w = Math.round(w * max / hgt); hgt = max; } }
        try {
          var c = document.createElement("canvas"); c.width = w; c.height = hgt;
          c.getContext("2d").drawImage(img, 0, 0, w, hgt);
          cb(c.toDataURL("image/jpeg", 0.7));
        } catch (e) { cb(reader.result); }
      };
      img.onerror = function () { cb(reader.result); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  function trickMethodCls(m) {
    if (m === "谐音") return "m-xie";
    if (m === "拆分") return "m-chai";
    if (m === "对比") return "m-dbi";
    if (m === "联想") return "m-lian";
    if (m === "故事") return "m-story";
    return "m-zi";
  }
  function trickCardsHtml(list) {
    var done = loadTrickDone();
    if (!list.length) return '<div class="empty">没有匹配的巧记，换个关键词试试 🐾</div>';
    return list.map(function (t) {
      var isDone = done[t.word] ? true : false;
      return '<div class="trick-card ' + (isDone ? "done" : "") + (t.mine ? " mine" : "") + '" data-word="' + esc(t.word) + '">' +
        '<span class="trick-method ' + trickMethodCls(t.method) + '">' + esc(t.method || "巧记") + '</span>' +
        (t.mine ? '<span class="trick-mine">我的</span>' : '') +
        '<div class="trick-head"><span class="trick-word">' + esc(t.word) + '</span>' +
        '<span class="trick-zh">' + esc(t.zh) + '</span>' +
        '<span class="trick-grade">' + trickGradeLabel(t.grade) + '</span></div>' +
        (t.img ? '<img class="trick-img" src="' + esc(t.img) + '" alt="巧记图">' : '') +
        '<p class="trick-text">' + esc(t.trick) + '</p>' +
        '<div class="trick-foot">' +
          '<button class="trick-remember ' + (isDone ? "on" : "") + '" data-word="' + esc(t.word) + '">' + (isDone ? "✅ 已记住" : "📌 我记住了") + '</button>' +
          (t.mine ? '<button class="trick-del" data-word="' + esc(t.word) + '">🗑 删除</button>' : '') +
        '</div>' +
        '</div>';
    }).join("");
  }
  function bindTrickCards(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll(".trick-remember"), function (b) {
      b.onclick = function () {
        var w = b.getAttribute("data-word");
        var d = loadTrickDone();
        var card = b.closest(".trick-card");
        if (d[w]) { delete d[w]; b.textContent = "📌 我记住了"; b.classList.remove("on"); if (card) card.classList.remove("done"); }
        else { d[w] = 1; b.textContent = "✅ 已记住"; b.classList.add("on"); if (card) card.classList.add("done"); }
        saveTrickDone(d);
      };
    });
    Array.prototype.forEach.call(scope.querySelectorAll(".trick-del"), function (b) {
      b.onclick = function () {
        var w = b.getAttribute("data-word");
        var u = loadUserTricks();
        u = u.filter(function (t) { return t.word !== w; });
        saveUserTricks(u);
        renderWordTricks();
      };
    });
  }
  function renderWordTricks(hashStr) {
    var root = document.getElementById("app");
    var h = hashStr || "#/tricks";
    var parts = h.replace(/^#\/tricks\/?/, "").split("/").filter(Boolean);
    if (parts[0] === "quiz") { renderTrickQuiz(); return; }
    if (parts[0]) state.trickGrade = parts[0];

    var gtabs = '<div class="grade-tabs">' +
      '<span class="grade-tab ' + (state.trickGrade === "all" ? "active" : "") + '" data-tgrade="all">全部</span>' +
      '<span class="grade-tab ' + (state.trickGrade === "primary" ? "active" : "") + '" data-tgrade="primary">小学</span>' +
      '<span class="grade-tab ' + (state.trickGrade === "junior" ? "active" : "") + '" data-tgrade="junior">初中</span>' +
      '<span class="grade-tab ' + (state.trickGrade === "senior" ? "active" : "") + '" data-tgrade="senior">高中</span>' +
      '</div>';

    var list = trickListFiltered();
    var gridHtml = trickCardsHtml(list);

    root.innerHTML =
      topTabsHtml("tricks") +
      '<div class="words-intro">难词、易混词，用 <b>联想 / 谐音 / 拆分 / 对比 / 故事</b> 记，比死背快多了。点「📌 我记住了」记录进度；也能在下方「➕ 添加我的巧记」存自己的口诀（离线可用，永不丢失）。</div>' +
      '<div class="trick-quiz-bar"><button class="check-all" id="trickQuizBtn">🎲 随机抽考（' + trickListFiltered().length + ' 张）</button>' +
        '<span class="trick-quiz-tip">打乱顺序抽一张，翻面看巧记，记没记住自己打分</span></div>' +
      gtabs +
      '<div class="filters"><input class="search" id="trickSearch" placeholder="🔍 搜单词 / 中文 / 巧记法…" value="' + esc(state.trickQ) + '"></div>' +
      '<div class="grid trick-grid">' + gridHtml + '</div>' +
      '<div class="trick-add">' +
        '<div class="section-title"><span class="bar" style="background:var(--gold)"></span>➕ 添加我的巧记</div>' +
        '<div class="trick-add-row">' +
          '<input id="taWord" class="ta-in" placeholder="单词（英文）" autocomplete="off">' +
          '<input id="taZh" class="ta-in" placeholder="中文释义" autocomplete="off">' +
        '</div>' +
        '<textarea id="taTrick" class="ta-ta" placeholder="写下你的巧记法（口语化、孩子能看懂最好）"></textarea>' +
        '<div class="trick-add-row">' +
          '<input type="file" id="taImg" class="ta-in ta-file" accept="image/*">' +
          '<span class="ta-img-prev" id="taImgPrev"></span>' +
        '</div>' +
        '<div class="trick-add-row">' +
          '<select id="taMethod" class="ta-in">' +
            '<option value="自创">自创</option><option value="谐音">谐音</option><option value="拆分">拆分</option><option value="对比">对比</option><option value="联想">联想</option><option value="故事">故事</option>' +
          '</select>' +
          '<button class="check-all" id="taAdd">保存巧记</button>' +
        '</div>' +
        '<div class="read-fb" id="taFb"></div>' +
      '</div>';

    bindTopTabs();

    var qb = document.getElementById("trickQuizBtn");
    if (qb) qb.onclick = function () { quizItems = null; quizHome = "#/tricks"; location.hash = "#/tricks/quiz"; };

    var imgInput = document.getElementById("taImg");
    var imgPrev = document.getElementById("taImgPrev");
    if (imgInput) imgInput.onchange = function () {
      var f = imgInput.files && imgInput.files[0];
      fileToThumb(f, function (d) {
        pendingTrickImg = d || "";
        if (imgPrev) imgPrev.innerHTML = pendingTrickImg ? '<img class="trick-img" src="' + esc(pendingTrickImg) + '">' : "";
      });
    };

    Array.prototype.forEach.call(root.querySelectorAll(".grade-tab[data-tgrade]"), function (t) {
      t.onclick = function () { state.trickGrade = t.getAttribute("data-tgrade"); location.hash = "#/tricks/" + state.trickGrade; };
    });

    var grid = root.querySelector(".trick-grid");
    if (grid) bindTrickCards(grid);

    var search = document.getElementById("trickSearch");
    if (search) search.oninput = function () {
      state.trickQ = search.value;
      var g = root.querySelector(".trick-grid");
      if (g) { g.innerHTML = trickCardsHtml(trickListFiltered()); bindTrickCards(g); }
    };

    var addBtn = document.getElementById("taAdd");
    if (addBtn) addBtn.onclick = function () {
      var wEl = document.getElementById("taWord"), zEl = document.getElementById("taZh"),
          tEl = document.getElementById("taTrick"), mEl = document.getElementById("taMethod"),
          fb = document.getElementById("taFb");
      var w = (wEl.value || "").trim().toLowerCase();
      var zh = (zEl.value || "").trim();
      var tr = (tEl.value || "").trim();
      if (!w || !tr) { if (fb) { fb.textContent = "⚠️ 单词和巧记法都要填"; fb.className = "read-fb low"; } return; }
      var u = loadUserTricks();
      var found = false;
      for (var i = 0; i < u.length; i++) { if (u[i].word === w) { u[i].zh = zh; u[i].trick = tr; u[i].method = mEl.value; found = true; break; } }
      if (!found) u.push({ word: w, zh: zh, trick: tr, method: mEl.value, grade: "all", img: pendingTrickImg });
      if (found && pendingTrickImg) u[i].img = pendingTrickImg;
      saveUserTricks(u);
      pendingTrickImg = "";
      if (imgInput) imgInput.value = "";
      if (imgPrev) imgPrev.innerHTML = "";
      if (fb) { fb.textContent = "✅ 已保存，可在上方列表中看到（带「我的」标记）"; fb.className = "read-fb ok"; }
      renderWordTricks();
    };
  }

  /* ---------- 随机抽考小游戏 ---------- */
  function renderTrickQuiz() {
    var root = document.getElementById("app");
    // 进局：没局 或 上一局已答完 → 用当前筛选重建一副打乱的牌
    if (!quizState || quizState.idx >= quizState.items.length) {
      var deck = quizItems ? quizItems.slice() : trickListFiltered();
      if (!deck.length) {
        root.innerHTML = topTabsHtml("tricks") + '<div class="empty">没有可抽考的巧记，换个筛选条件或先添加巧记 🐾</div>';
        bindTopTabs();
        return;
      }
      deck = deck.slice();
      for (var i = deck.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
      quizState = { items: deck, idx: 0, known: 0 };
    }
    var q = quizState;
    var it = q.items[q.idx];
    var total = q.items.length;
    function flipHtml(flipped) {
      return '<div class="flip quiz-flip ' + (flipped ? "flipped" : "") + '" id="quizCard"><div class="inner">' +
        '<div class="face front"><div class="quiz-word">' + esc(it.word) + '</div><div class="quiz-zh">' + esc(it.zh) + '</div><div class="quiz-hint">👆 点卡片翻面看巧记</div></div>' +
        '<div class="face back"><span class="trick-method ' + trickMethodCls(it.method) + '">' + esc(it.method || "巧记") + '</span>' +
          (it.img ? '<img class="trick-img" src="' + esc(it.img) + '">' : '') +
          '<p class="trick-text">' + esc(it.trick) + '</p></div>' +
        '</div></div>';
    }
    root.innerHTML = topTabsHtml("tricks") +
      '<div class="trick-quiz">' +
        '<div class="quiz-bar"><span>第 <b>' + (q.idx + 1) + '</b> / ' + total + ' 张</span><span>已记住 <b class="ok">' + q.known + '</b></span>' +
          '<button class="back" id="quizExit">← 退出</button></div>' +
        flipHtml(false) +
        '<div class="quiz-actions">' +
          '<button class="check-all" id="quizFlip">🔄 翻面看巧记</button>' +
          '<button class="trick-remember" id="quizKnown">✅ 记住了</button>' +
          '<button class="trick-del" id="quizSkip">🔁 没记住</button>' +
        '</div>' +
      '</div>';
    bindTopTabs();
    var card = document.getElementById("quizCard");
    if (card) card.onclick = function () { card.classList.toggle("flipped"); };
    var flipBtn = document.getElementById("quizFlip");
    if (flipBtn) flipBtn.onclick = function () { if (card) card.classList.add("flipped"); };
    var knownBtn = document.getElementById("quizKnown");
    if (knownBtn) knownBtn.onclick = function () { q.known++; q.idx++; advanceQuiz(); };
    var skipBtn = document.getElementById("quizSkip");
    if (skipBtn) skipBtn.onclick = function () { q.idx++; advanceQuiz(); };
    var exit = document.getElementById("quizExit");
    if (exit) exit.onclick = function () { quizState = null; location.hash = quizHome; };
  }
  function advanceQuiz() {
    var q = quizState;
    if (!q) return;
    if (q.idx >= q.items.length) {
      var root = document.getElementById("app");
      root.innerHTML = topTabsHtml("tricks") +
        '<div class="trick-quiz quiz-done">' +
          '<div class="quiz-done-emoji">🎉</div>' +
          '<h2>抽考完成！</h2>' +
          '<p>共 ' + q.items.length + ' 张，你记住了 <b class="ok">' + q.known + '</b> 张（正确率 ' + Math.round(q.known / q.items.length * 100) + '%）。</p>' +
          '<div class="quiz-actions"><button class="check-all" id="quizAgain">🔁 再来一局</button>' +
          '<button class="back" id="quizBack">返回学习中心</button></div>' +
        '</div>';
      bindTopTabs();
      var again = document.getElementById("quizAgain");
      if (again) again.onclick = function () { quizState = null; location.hash = "#/tricks/quiz"; };
      var back = document.getElementById("quizBack");
      if (back) back.onclick = function () { quizState = null; location.hash = quizHome; };
    } else {
      renderTrickQuiz();
    }
  }

  /* ---------- 课程主线：以人教版为线，串起所有学习方法 + 进度巩固 ---------- */
  function parseUnitId(id) {
    var m = /^p-sh(\d)([ab])-u(\d+)$/.exec(id || "");
    return m ? { g: m[1], v: m[2], n: parseInt(m[3], 10) } : null;
  }
  function unitWords(unitId) {
    var g = WORDS.primary || {};
    var u = null;
    (g.units || []).forEach(function (x) { if (x.id === unitId) u = x; });
    return u ? (u.words || []) : [];
  }
  function unitWordCount(unitId) { return unitWords(unitId).length; }
  function findTextbookUnit(g, v, n) {
    var TB = window.TEXTBOOK || [];
    var gk = "pep" + g + v;
    for (var i = 0; i < TB.length; i++) {
      if (TB[i].key !== gk) continue;
      var uid = "pep" + g + v + "-u" + n;
      var unit = null;
      (TB[i].units || []).forEach(function (u) { if (u.id === uid) unit = u; });
      if (unit) return { gradeKey: gk, unitId: uid, unit: unit };
    }
    return null;
  }
  function courseGradeExists(g) {
    var C = window.COURSES || {};
    if (!C.grades) return false;
    for (var i = 0; i < C.grades.length; i++) if (C.grades[i].key === "g" + g) return true;
    return false;
  }
  // 同步课堂改为「直链国家平台」：优先取 COURSES 里该单元课时的 platform 深链，
  // 退而求其次用 materialId 拼 classActivity 页，最后兜底到平台首页。
  function coursePlatformFor(grade, vol, unitId) {
    var C = window.COURSES || {};
    if (C.grades && C.grades.length) {
      var g = null;
      for (var i = 0; i < C.grades.length; i++) if (C.grades[i].key === "g" + grade) g = C.grades[i];
      if (g) {
        var v = null;
        for (var j = 0; j < (g.volumes || []).length; j++) if (g.volumes[j].key === vol) v = g.volumes[j];
        if (v) {
          var idx = -1;
          if (CURRIC && CURRIC.grades) {
            CURRIC.grades.forEach(function (gg) {
              if (gg.grade !== grade) return;
              var vv = gg.volumes[vol]; if (!vv) return;
              vv.units.forEach(function (u, k) { if (u.unitId === unitId) idx = k; });
            });
          }
          var u = (idx >= 0 && v.units[idx]) ? v.units[idx] : v.units[0];
          if (u && u.lessons && u.lessons[0] && u.lessons[0].platform) return u.lessons[0].platform;
          if (v.materialId) return "https://basic.smartedu.cn/syncClassroom/classActivity?activityId=" + v.materialId;
        }
      }
    }
    return "https://basic.smartedu.cn/syncClassroom";
  }
  function loadUnitProgress() {
    try { return JSON.parse(localStorage.getItem(LS_UNIT_PROGRESS)) || {}; } catch (e) { return {}; }
  }
  function saveUnitProgress(o) { localStorage.setItem(LS_UNIT_PROGRESS, JSON.stringify(o)); }
  function getUnitProg(unitId) {
    var all = loadUnitProgress();
    if (!all[unitId]) all[unitId] = { visited: {}, wordsKnown: [] };
    return all[unitId];
  }
  function markUnitMethod(unitId, key) {
    var all = loadUnitProgress();
    if (!all[unitId]) all[unitId] = { visited: {}, wordsKnown: [] };
    if (!all[unitId].visited) all[unitId].visited = {};
    all[unitId].visited[key] = 1;
    saveUnitProgress(all);
  }
  function recordUnitWord(unitId, en, known) {
    var all = loadUnitProgress();
    if (!all[unitId]) all[unitId] = { visited: {}, wordsKnown: [] };
    var wk = all[unitId].wordsKnown || [];
    var low = String(en).trim().toLowerCase();
    var idx = wk.indexOf(low);
    if (known) { if (idx < 0) wk.push(low); }
    else { if (idx >= 0) wk.splice(idx, 1); }
    all[unitId].wordsKnown = wk;
    saveUnitProgress(all);
  }
  function unitProgress(unitId, words) {
    var prog = getUnitProg(unitId);
    var wordsTotal = words.length;
    var wordsKnown = (prog.wordsKnown || []).length;
    var ut = tricksForWords(words.map(function (w) { return w.en; }));
    var tricksTotal = ut.length;
    var done = loadTrickDone();
    var tricksKnown = 0;
    ut.forEach(function (t) { if (done[t.word]) tricksKnown++; });
    var p = parseUnitId(unitId);
    var tbTotal = 0, tbDone = 0;
    if (p) {
      var tb = findTextbookUnit(p.g, p.v, p.n);
      if (tb) {
        tbTotal = tb.unit.sentences ? tb.unit.sentences.length : 0;
        var rd = loadRead();
        tbDone = (rd["tb:" + tb.gradeKey + ":" + tb.unitId] || []).length;
      }
    }
    var methodsVisited = 0;
    ["flash", "spell", "read", "phonics", "tricks", "textbook", "courses"].forEach(function (k) { if (prog.visited && prog.visited[k]) methodsVisited++; });
    var wordPart = wordsTotal ? wordsKnown / wordsTotal : 1;
    var trickPart = tricksTotal ? tricksKnown / tricksTotal : 1;
    var tbPart = tbTotal ? Math.min(1, tbDone / tbTotal) : 1;
    var methodPart = methodsVisited / 7;
    var overall = Math.round((wordPart * 0.4 + trickPart * 0.3 + tbPart * 0.1 + methodPart * 0.2) * 100);
    return { overall: overall, wordsTotal: wordsTotal, wordsKnown: wordsKnown, tricksTotal: tricksTotal, tricksKnown: tricksKnown, tbTotal: tbTotal, tbDone: tbDone, methodsVisited: methodsVisited, visited: prog.visited || {} };
  }
  function renderCurriculum(hashStr) {
    var root = document.getElementById("app");
    var h = hashStr || "#/curriculum";
    var parts = h.replace(/^#\/curriculum\/?/, "").split("/").filter(Boolean);
    if (parts[2]) { renderCourseUnit(parts[0], parts[1], parts[2]); return; }
    if (parts[0]) state.curricGrade = parts[0];

    var chips = '<div class="grade-tabs">';
    CURRIC.grades.forEach(function (g) {
      chips += '<span class="grade-tab ' + (state.curricGrade === g.grade ? "active" : "") + '" data-grade="' + g.grade + '">' + esc(g.label) + '</span>';
    });
    chips += '<span class="grade-tab ' + (state.curricGrade === "basics" ? "active" : "") + '" data-grade="basics">基础与主题</span>';
    chips += "</div>";

    var body = "";
    if (state.curricGrade === "basics") {
      var bcards = CURRIC.basics.map(function (u) {
        return '<div class="card unit-card" data-grade="primary" data-unit="' + u.unitId + '">' +
          '<div class="top"><span class="icon">⭐</span></div><h3>' + esc(u.title) + '</h3>' +
          '<p class="summary">基础词 · 点开练</p></div>';
      }).join("");
      body = '<div class="grid">' + bcards + '</div>';
    } else {
      var gradeObj = null;
      CURRIC.grades.forEach(function (g) { if (g.grade === state.curricGrade) gradeObj = g; });
      if (gradeObj) {
        body = ["a", "b"].map(function (v) {
          var vol = gradeObj.volumes[v];
          if (!vol || !vol.units.length) return "";
          var cards = vol.units.map(function (u) {
            var wcount = unitWordCount(u.unitId);
            var tcount = tricksForWords(unitWords(u.unitId).map(function (w) { return w.en; })).length;
            return '<div class="card unit-card" data-grade="' + gradeObj.grade + '" data-vol="' + v + '" data-unit="' + u.unitId + '">' +
              '<div class="top"><span class="icon">📘</span>' +
              '<span class="badge-grade" style="background:' + gradeColor("primary") + '">' + vol.label + '</span></div>' +
              "<h3>" + esc(u.title) + "</h3>" +
              '<p class="summary">' + wcount + " 词" + (tcount ? " · 💡" + tcount + " 巧记" : "") + '</p>' +
              "</div>";
          }).join("");
          return '<div class="vol-section"><div class="vol-title">' + vol.label + '</div><div class="grid">' + cards + '</div></div>';
        }).join("");
      }
    }

    root.innerHTML = topTabsHtml("curriculum") + chips +
      '<div class="words-intro">按 <b>人教版 PEP（三年级起点）</b> 课程主线：选年级 → 分册 → 单元。每个单元是一张「学习中心」，把 <b>单词练习 / 拼读拆解 / 课文跟读 / 单词巧记 / 同步课堂</b> 串起来，边学边巩固进度。</div>' +
      body;
    bindTopTabs();
    Array.prototype.forEach.call(root.querySelectorAll(".grade-tab"), function (t) {
      t.onclick = function () { state.curricGrade = t.getAttribute("data-grade"); location.hash = "#/curriculum/" + state.curricGrade; };
    });
    Array.prototype.forEach.call(root.querySelectorAll(".unit-card"), function (c) {
      c.onclick = function () {
        var g = c.getAttribute("data-grade"), v = c.getAttribute("data-vol"), u = c.getAttribute("data-unit");
        if (g === "basics" || !v) location.hash = "#/words/primary/" + u;
        else location.hash = "#/curriculum/" + g + "/" + v + "/" + u;
      };
    });
  }
  function renderCourseUnit(grade, vol, unitId) {
    var root = document.getElementById("app");
    var words = unitWords(unitId);
    if (!words.length) { root.innerHTML = topTabsHtml("curriculum") + '<div class="empty">找不到该单元 😢</div>'; bindTopTabs(); return; }
    var unitMeta = null;
    CURRIC.grades.forEach(function (g) {
      if (g.grade !== grade) return;
      var vv = g.volumes[vol];
      if (!vv) return;
      vv.units.forEach(function (u) { if (u.unitId === unitId) unitMeta = u; });
    });
    var title = (unitMeta && unitMeta.title) || unitId;
    var p = parseUnitId(unitId);
    var tb = p ? findTextbookUnit(p.g, p.v, p.n) : null;
    var prog = unitProgress(unitId, words);
    var volLabel = (vol === "a") ? "上册" : "下册";

    var methods = [
      { key: "flash", icon: "🃏", label: "单词闪卡", desc: "点卡翻面看中文", hash: "#/words/primary/" + unitId + "/flash" },
      { key: "spell", icon: "✍️", label: "拼写自测", desc: "看中文写英文", hash: "#/words/primary/" + unitId + "/spell" },
      { key: "read", icon: "🎤", label: "单词跟读", desc: "听+跟读打分", hash: "#/words/primary/" + unitId + "/read" },
      { key: "phonics", icon: "🔤", label: "拼读拆解", desc: "音节·音标·拼写", hash: "#/words/primary/" + unitId + "/phonics" },
      { key: "tricks", icon: "💡", label: "本单元巧记", desc: "易错词巧记法", hash: "#/words/primary/" + unitId + "/tricks" },
      { key: "textbook", icon: "📖", label: "课文跟读", desc: tb ? "听示范+跟我读" : "暂未配套", hash: tb ? ("#/textbook/" + tb.gradeKey + "/" + tb.unitId) : "#/textbook", disabled: !tb },
      { key: "courses", icon: "📺", label: "同步课堂", desc: "去国家平台看课（新标签页）→", href: coursePlatformFor(grade, vol, unitId), target: "_blank" }
    ];
    var mhtml = methods.map(function (m) {
      var done = prog.visited[m.key] ? "done" : "";
      var dis = m.disabled ? " disabled" : "";
      var href = m.href || m.hash || "#";
      var ext = m.target ? (' target="' + m.target + '" rel="noopener"') : '';
      return '<a class="method-card ' + done + dis + '" data-key="' + m.key + '" href="' + esc(href) + '"' + ext + '>' +
        '<span class="m-ico">' + m.icon + '</span>' +
        '<span class="m-label">' + m.label + (prog.visited[m.key] ? ' <span class="m-check">✓</span>' : '') + '</span>' +
        '<span class="m-desc">' + m.desc + '</span>' +
        '</a>';
    }).join("");

    var ut = tricksForWords(words.map(function (w) { return w.en; }));
    var tricksHtml = ut.length
      ? ('<div class="section-title"><span class="bar" style="background:var(--gold)"></span>💡 本单元巧记（' + ut.length + ' 条 · 点「📌 我记住了」记进度）</div>' +
         '<div class="grid trick-grid">' + trickCardsHtml(ut) + '</div>')
      : '<div class="empty">本单元暂无种子巧记（可在「💡 单词巧记」里自己加，按本单元词填写即可）</div>';

    root.innerHTML = topTabsHtml("curriculum") +
      '<div class="detail words-detail">' +
      '<button class="back" id="back">← 返回单元列表</button>' +
      '<div class="head"><span class="icon">📘</span><div><h2>' + esc(title) + '</h2>' +
      '<p class="sub">' + grade + '年级 · ' + volLabel + ' · 共 ' + words.length + ' 词</p></div></div>' +

      '<div class="progress-hero">' +
        '<div class="ph-ring" style="--p:' + prog.overall + '"><span>' + prog.overall + '%</span></div>' +
        '<div class="ph-stats">' +
          '<div class="ph-stat"><b>' + prog.wordsKnown + '/' + prog.wordsTotal + '</b><span>词汇掌握</span></div>' +
          '<div class="ph-stat"><b>' + prog.tricksKnown + '/' + prog.tricksTotal + '</b><span>巧记记住</span></div>' +
          '<div class="ph-stat"><b>' + prog.tbDone + '/' + prog.tbTotal + '</b><span>课文跟读</span></div>' +
          '<div class="ph-stat"><b>' + prog.methodsVisited + '/7</b><span>方法用过</span></div>' +
        '</div>' +
      '</div>' +

      '<div class="section-title"><span class="bar"></span>🧭 本单元学习方法（点开即用，进度自动记录）</div>' +
      '<div class="method-grid">' + mhtml + '</div>' +

      '<div class="section-title"><span class="bar" style="background:var(--gold)"></span>💡 本单元巧记</div>' +
      tricksHtml +

      '<div class="trick-quiz-bar"><button class="check-all" id="unitQuizBtn">🎲 本单元巧记抽考（' + ut.length + ' 张）</button>' +
        '<span class="trick-quiz-tip">只抽本单元有巧记的词，翻面看巧记打分</span></div>' +
      '</div>';

    var back = document.getElementById("back");
    if (back) back.onclick = function () { location.hash = "#/curriculum/" + grade + "/" + vol; };
    bindTopTabs();
    Array.prototype.forEach.call(root.querySelectorAll(".method-card"), function (c) {
      c.onclick = function () { markUnitMethod(unitId, c.getAttribute("data-key")); };
    });
    var tg = root.querySelector(".trick-grid");
    if (tg) bindTrickCards(tg);
    var uq = document.getElementById("unitQuizBtn");
    if (uq) uq.onclick = function () {
      var items = tricksForWords(words.map(function (w) { return w.en; }));
      if (!items.length) { if (window.alert) alert("本单元还没有巧记可抽考"); return; }
      quizItems = items;
      quizHome = "#/curriculum/" + grade + "/" + vol + "/" + unitId;
      location.hash = "#/tricks/quiz";
    };
  }

  /* ---------- 路由 ---------- */
  function route() {
    var h = location.hash || "#/";
    if (h.indexOf("#/m/") === 0) {
      renderDetail(h.slice(4));
    } else if (h.indexOf("#/words") === 0) {
      renderWords(h);
    } else if (h.indexOf("#/textbook") === 0) {
      renderTextbook(h);
    } else if (h.indexOf("#/courses") === 0) {
      renderCourses(h);
    } else if (h.indexOf("#/curriculum") === 0) {
      renderCurriculum(h);
    } else if (h.indexOf("#/tricks") === 0) {
      renderWordTricks(h);
    } else {
      renderHome();
    }
    renderTopbar();
  }
  function renderWords(hashStr) {
    var h = hashStr || "#/words";
    var parts = h.replace(/^#\/words\/?/, "").split("/").filter(Boolean);
    var grade = parts[0] || state.wordGrade || "primary";
    state.wordGrade = grade;
    if (parts[1]) renderWordUnit(grade, parts[1], parts[2]);
    else renderWordsHome(grade);
  }

  window.addEventListener("hashchange", route);
  document.addEventListener("DOMContentLoaded", function () {
    // 预热语音列表，确保首次朗读就能选到英文嗓音
    try { if (window.speechSynthesis) { speechSynthesis.getVoices(); pickVoice(); } } catch (e) {}
    // 注入顶栏与统计容器
    var top = el('<div class="topbar" id="topbar"></div>');
    document.body.insertBefore(top, document.body.firstChild);
    var wrap = el('<div class="wrap"><div class="hero"><h1>🦊 中小学英语学习技巧归档</h1>' +
      '<p>把全网各平台的学习方法技巧，按 小学 / 初中 / 高中 + 能力维度 归档分类，配视频、配互动练习，让孩子学英语不那么枯燥。</p>' +
      '<div class="stat-row" id="stats"></div></div><div id="app"></div>' +
      '<div class="foot">English-Mastery · 数据驱动 · 纯前端离线可用 · 参考 math-mastery 架构 · MIT</div></div>');
    document.body.appendChild(wrap);
    route();
  });
})();
