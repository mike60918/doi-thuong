import { GROUPS, SCENARIOS } from './data/scenarios.js';

// ---------- 狀態（存在使用者自己的瀏覽器裡） ----------
const KEY = 'doithuong.v1';
const DAY = 86400000;
const INTERVALS = [0, 1, 2, 4, 7, 15, 30]; // 每一級距離下次複習的天數

const defaults = { done: {}, words: {}, showPy: true, showVi: true };
let state = load();

function load() {
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY)) || {}) };
  } catch {
    return { ...defaults };
  }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 無痕模式等情況：照常運作，只是不保存 */ }
}

// ---------- 小工具 ----------
const app = document.getElementById('app');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = (id) => SCENARIOS.find((s) => s.id === id);
const allVocab = () => SCENARIOS.flatMap((s) => s.vocab.map((v) => ({ ...v, sid: s.id })));
const findWord = (zh) => allVocab().find((v) => v.zh === zh);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[「」⋯・]/g, ' '));
  u.lang = 'zh-TW';
  u.rate = 0.85;
  const voice = synth.getVoices().find((v) => /zh[-_]TW/i.test(v.lang));
  if (voice) u.voice = voice;
  synth.speak(u);
}

function dueWords() {
  const now = Date.now();
  return Object.entries(state.words)
    .filter(([zh, w]) => w.due <= now && findWord(zh))
    .map(([zh]) => zh);
}

function updateChrome(tab) {
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  const badge = document.getElementById('due-badge');
  const n = dueWords().length;
  badge.hidden = n === 0;
  badge.textContent = n;
}

// ---------- 畫面：首頁 ----------
function viewHome() {
  const total = SCENARIOS.length;
  const done = SCENARIOS.filter((s) => state.done[s.id]).length;
  const groups = GROUPS.map((g) => {
    const items = SCENARIOS.filter((s) => s.group === g.id);
    if (!items.length) return '';
    return `
      <h2 class="group-title">${g.icon} ${esc(g.vi)} <span class="zh">${esc(g.zh)}</span></h2>
      ${items.map((s) => `
        <a class="lesson" href="#/s/${s.id}">
          <div class="body">
            <div class="t">${esc(s.vi)}</div>
            <div class="zh">${esc(s.zh)}</div>
            <div class="small" style="margin-top:6px">
              <span class="pill">${esc(s.level)}</span>${s.reviewed ? '' : '<span class="pill gray">chưa duyệt</span>'}
            </div>
          </div>
          <div class="state" aria-label="${state.done[s.id] ? 'Đã hoàn thành' : 'Chưa học'}">${state.done[s.id] ? '✅' : '›'}</div>
        </a>`).join('')}`;
  }).join('');

  app.innerHTML = `
    <header class="hero">
      <div class="zh">台灣日常中文</div>
      <h1>Tiếng Trung đời thường ở Đài Loan</h1>
      <p class="muted">Học qua những tình huống bạn gặp mỗi ngày.</p>
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${(done / total) * 100}%"></i></div>
      <div class="small muted">Đã hoàn thành ${done}/${total} tình huống</div>
    </header>
    ${groups}`;
}

// ---------- 畫面：課程 ----------
function viewScenario(id) {
  const s = byId(id);
  if (!s) return viewHome();
  app.innerHTML = `
    <a class="back" href="#/">‹ Tất cả bài học</a>
    <div><span class="pill">${esc(s.level)}</span>${s.reviewed ? '' : '<span class="pill gray">bản dịch chưa duyệt</span>'}</div>
    <h1>${esc(s.vi)}</h1>
    <div class="zh muted">${esc(s.zh)}</div>
    <p style="margin-top:12px">${esc(s.intro)}</p>

    <h2>Hội thoại</h2>
    <div class="toolbar">
      <button class="chip" data-act="play-all">▶ Nghe cả bài</button>
      <button class="chip" data-act="toggle-py" aria-pressed="${state.showPy}">Pinyin</button>
      <button class="chip" data-act="toggle-vi" aria-pressed="${state.showVi}">Tiếng Việt</button>
    </div>
    <p class="small muted">Chạm vào từng câu để nghe.</p>
    <div id="dialog" class="${state.showPy ? '' : 'hide-py'} ${state.showVi ? '' : 'hide-vi'}">
      ${s.lines.map((l, i) => `
        <div class="line ${l.me ? 'me' : ''}">
          <button class="bubble" data-act="say" data-text="${esc(l.zh)}" data-i="${i}">
            <span class="who">${esc(l.who)}</span>
            <span class="zh" lang="zh-Hant">${esc(l.zh)}</span>
            <span class="py">${esc(l.py)}</span>
            <span class="vi">${esc(l.vi)}</span>
          </button>
        </div>`).join('')}
    </div>

    <h2>Từ vựng</h2>
    ${s.vocab.map((v) => `
      <button class="word" data-act="say" data-text="${esc(v.zh)}">
        <span class="zh" lang="zh-Hant">${esc(v.zh)}</span>
        <span class="meta">
          <div class="py">${esc(v.py)}</div>
          <div>${esc(v.vi)}</div>
          ${v.hv ? `<div class="hv">Hán Việt: ${esc(v.hv)}</div>` : ''}
        </span>
        <span aria-hidden="true">🔊</span>
      </button>`).join('')}

    <h2>Người Đài nói thế nào</h2>
    ${s.notes.map((n) => `
      <div class="note">
        <div class="zh" lang="zh-Hant">${esc(n.zh)}</div>
        <div class="py">${esc(n.py)}</div>
        <div style="margin-top:4px">${esc(n.vi)}</div>
      </div>`).join('')}

    <a class="btn" href="#/q/${s.id}">Làm bài luyện tập</a>`;
}

// ---------- 畫面：測驗 ----------
let quiz = null;

function buildQuiz(s) {
  const written = s.quiz.map((q) => {
    const correct = q.options[q.answer];
    return { q: q.q, options: shuffle(q.options), correct, explain: q.explain };
  });
  const pool = allVocab();
  const generated = shuffle(s.vocab).slice(0, 3).map((v) => {
    const wrong = shuffle(pool.filter((p) => p.vi !== v.vi)).slice(0, 3).map((p) => p.vi);
    return { q: `「${v.zh}」 nghĩa là gì?`, say: v.zh, options: shuffle([v.vi, ...wrong]), correct: v.vi, explain: `${v.zh} (${v.py}) = ${v.vi}.` };
  });
  return { sid: s.id, items: shuffle([...written, ...generated]), i: 0, score: 0, picked: null };
}

function viewQuiz(id) {
  const s = byId(id);
  if (!s) return viewHome();
  if (!quiz || quiz.sid !== id) quiz = buildQuiz(s);
  if (quiz.i >= quiz.items.length) return viewQuizResult(s);

  const it = quiz.items[quiz.i];
  const answered = quiz.picked !== null;
  app.innerHTML = `
    <a class="back" href="#/s/${s.id}">‹ ${esc(s.vi)}</a>
    <div class="progress"><i style="width:${(quiz.i / quiz.items.length) * 100}%"></i></div>
    <div class="small muted">Câu ${quiz.i + 1}/${quiz.items.length}</div>
    <div class="q">${esc(it.q)} ${it.say ? `<button class="chip" data-act="say" data-text="${esc(it.say)}" aria-label="Nghe">🔊</button>` : ''}</div>
    ${it.options.map((o) => {
      let cls = '';
      if (answered && o === it.correct) cls = 'right';
      else if (answered && o === quiz.picked) cls = 'wrong';
      return `<button class="opt ${cls}" data-act="pick" data-opt="${esc(o)}" ${answered ? 'disabled' : ''}>${esc(o)}</button>`;
    }).join('')}
    ${answered ? `
      <div class="feedback ${quiz.picked === it.correct ? 'right' : 'wrong'}">
        <b>${quiz.picked === it.correct ? 'Chính xác!' : 'Chưa đúng.'}</b> ${esc(it.explain)}
      </div>
      <button class="btn" data-act="next">${quiz.i + 1 < quiz.items.length ? 'Câu tiếp theo' : 'Xem kết quả'}</button>` : ''}`;
}

function viewQuizResult(s) {
  const n = quiz.items.length;
  const passed = quiz.score / n >= 0.7;
  if (passed && !quiz.saved) {
    state.done[s.id] = Date.now();
    s.vocab.forEach((v) => {
      if (!state.words[v.zh]) state.words[v.zh] = { box: 1, due: Date.now() + DAY };
    });
    save();
    quiz.saved = true;
  }
  app.innerHTML = `
    <div class="center">
      <div class="big">${passed ? '🎉' : '💪'}</div>
      <h1>${quiz.score}/${n} câu đúng</h1>
      <p class="muted">${passed
        ? `Đã thêm ${s.vocab.length} từ vào phần Ôn tập. Ngày mai quay lại ôn nhé!`
        : 'Cần đúng ít nhất 70% để hoàn thành. Xem lại hội thoại rồi thử lần nữa.'}</p>
    </div>
    ${passed ? '<a class="btn" href="#/">Về trang bài học</a>' : `<a class="btn" href="#/s/${s.id}">Xem lại hội thoại</a>`}
    <button class="btn ghost" data-act="retry" data-sid="${s.id}">Làm lại</button>`;
}

// ---------- 畫面：複習 ----------
let review = null;

function viewReview() {
  if (!review) review = { queue: shuffle(dueWords()), shown: false, count: 0 };
  const known = Object.keys(state.words).length;

  if (!review.queue.length) {
    const next = Object.values(state.words).map((w) => w.due).sort((a, b) => a - b)[0];
    const days = next ? Math.max(1, Math.ceil((next - Date.now()) / DAY)) : 0;
    app.innerHTML = `
      <h1>Ôn tập</h1>
      <div class="center">
        <div class="big">${known ? '✨' : '📭'}</div>
        <p>${known
          ? (review.count ? `Bạn vừa ôn ${review.count} từ. ` : '') + `Hôm nay không còn từ nào cần ôn.`
          : 'Chưa có từ nào. Hoàn thành một bài luyện tập để thêm từ vào đây.'}</p>
        ${known ? `<p class="muted small">Đang nhớ ${known} từ · lần ôn tiếp theo sau khoảng ${days} ngày.</p>` : ''}
      </div>
      <a class="btn" href="#/">Về trang bài học</a>`;
    return;
  }

  const w = findWord(review.queue[0]);
  app.innerHTML = `
    <h1>Ôn tập</h1>
    <div class="small muted">Còn ${review.queue.length} từ</div>
    <div class="flash">
      <div class="zh" lang="zh-Hant">${esc(w.zh)}</div>
      ${review.shown ? `
        <div class="py">${esc(w.py)}</div>
        <div class="vi">${esc(w.vi)}</div>
        ${w.hv ? `<div class="small muted">Hán Việt: ${esc(w.hv)}</div>` : ''}` : '<div class="muted small">Bạn còn nhớ nghĩa không?</div>'}
      <div><button class="chip" data-act="say" data-text="${esc(w.zh)}">🔊 Nghe</button></div>
    </div>
    ${review.shown ? `
      <div class="two">
        <button class="btn ghost" data-act="grade" data-ok="0">Quên rồi</button>
        <button class="btn" data-act="grade" data-ok="1">Nhớ</button>
      </div>` : '<button class="btn" data-act="reveal">Xem đáp án</button>'}`;
}

function grade(ok) {
  const zh = review.queue.shift();
  const w = state.words[zh];
  if (ok) {
    w.box = Math.min(w.box + 1, INTERVALS.length - 1);
    w.due = Date.now() + INTERVALS[w.box] * DAY;
  } else {
    w.box = 1;
    w.due = Date.now() + DAY;
    review.queue.push(zh); // 這一輪結束前再出現一次
  }
  review.count++;
  review.shown = false;
  save();
}

// ---------- 畫面：設定 ----------
function viewSettings() {
  const hasVoice = 'speechSynthesis' in window;
  app.innerHTML = `
    <h1>Cài đặt</h1>
    <div class="card">
      <b>Tiến độ của bạn</b>
      <p class="muted small" style="margin-top:6px">Tiến độ được lưu ngay trên máy này. Hãy sao lưu trước khi đổi điện thoại hoặc xóa dữ liệu trình duyệt.</p>
      <button class="btn ghost" data-act="export">Sao lưu tiến độ (tải file)</button>
      <label class="btn ghost" style="cursor:pointer">Khôi phục từ file<input type="file" accept="application/json" id="import" hidden></label>
      <button class="btn danger" data-act="reset">Xóa toàn bộ tiến độ</button>
    </div>
    <div class="card">
      <b>Giọng đọc</b>
      <p class="muted small" style="margin-top:6px">${hasVoice
        ? 'Ứng dụng dùng giọng đọc tiếng Trung (Đài Loan) có sẵn trên máy bạn. Nếu không nghe được, hãy cài thêm giọng “中文（台灣）” trong phần cài đặt ngôn ngữ của máy.'
        : 'Trình duyệt này không hỗ trợ giọng đọc.'}</p>
      ${hasVoice ? '<button class="btn ghost" data-act="say" data-text="你好，歡迎來台灣。">🔊 Nghe thử</button>' : ''}
    </div>
    <p class="small muted center">Đời Thường · bản thử nghiệm 0.1</p>`;
}

// ---------- 路由與事件 ----------
function route() {
  const [, name, arg] = location.hash.replace(/^#/, '').split('/');
  window.speechSynthesis?.cancel();
  if (name !== 'q') quiz = null;
  if (name !== 'review') review = null;
  if (name === 's') { viewScenario(arg); updateChrome('home'); }
  else if (name === 'q') { viewQuiz(arg); updateChrome('home'); }
  else if (name === 'review') { viewReview(); updateChrome('review'); }
  else if (name === 'settings') { viewSettings(); updateChrome('settings'); }
  else { viewHome(); updateChrome('home'); }
  window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;

  if (act === 'say') speak(el.dataset.text);
  else if (act === 'play-all') {
    const s = byId(location.hash.split('/')[2]);
    if (s) speak(s.lines.map((l) => l.zh).join(' '));
  } else if (act === 'toggle-py' || act === 'toggle-vi') {
    const key = act === 'toggle-py' ? 'showPy' : 'showVi';
    state[key] = !state[key];
    save();
    el.setAttribute('aria-pressed', state[key]);
    document.getElementById('dialog').classList.toggle(act === 'toggle-py' ? 'hide-py' : 'hide-vi', !state[key]);
  } else if (act === 'pick') {
    const it = quiz.items[quiz.i];
    quiz.picked = el.dataset.opt;
    if (quiz.picked === it.correct) quiz.score++;
    viewQuiz(quiz.sid);
  } else if (act === 'next') {
    quiz.i++;
    quiz.picked = null;
    viewQuiz(quiz.sid);
    window.scrollTo(0, 0);
  } else if (act === 'retry') {
    quiz = null;
    viewQuiz(el.dataset.sid);
  } else if (act === 'reveal') {
    review.shown = true;
    viewReview();
  } else if (act === 'grade') {
    grade(el.dataset.ok === '1');
    viewReview();
    updateChrome('review');
  } else if (act === 'export') {
    const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'doi-thuong-sao-luu.json';
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (act === 'reset') {
    if (confirm('Xóa toàn bộ tiến độ? Không thể hoàn tác.')) {
      state = { ...defaults, done: {}, words: {} };
      save();
      route();
    }
  }
});

document.addEventListener('change', async (e) => {
  if (e.target.id !== 'import' || !e.target.files[0]) return;
  try {
    const data = JSON.parse(await e.target.files[0].text());
    if (typeof data !== 'object' || !data || typeof data.done !== 'object' || typeof data.words !== 'object') throw new Error('bad file');
    state = { ...defaults, ...data };
    save();
    alert('Đã khôi phục tiến độ.');
    route();
  } catch {
    alert('File không hợp lệ.');
  }
});

window.addEventListener('hashchange', route);
window.speechSynthesis?.getVoices(); // 有些瀏覽器要先叫一次才會載入語音清單
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
