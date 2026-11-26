const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time = (value) => {
  if (!value || Number.isNaN(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}).format(new Date(value));
};
$('#today').textContent = new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', month:'long', day:'numeric', weekday:'short'}).format(new Date());
let activeCategory = 'local';
try {
  const savedCategory = localStorage.getItem('dailynews-category');
  if (['local', 'society', 'world', 'weibo'].includes(savedCategory)) activeCategory = savedCategory;
} catch {}
function selectCategory(category) {
  activeCategory = category;
  document.querySelectorAll('nav [data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
  document.querySelectorAll('#news .news-section').forEach(section => { section.hidden = section.id !== category; });
}
document.querySelectorAll('nav [data-category]').forEach(button => button.addEventListener('click', () => {
  selectCategory(button.dataset.category);
  try { localStorage.setItem('dailynews-category', activeCategory); } catch {}
  const news = $('#news');
  const nav = document.querySelector('nav');
  const top = window.scrollY + news.getBoundingClientRect().top - nav.offsetHeight;
  window.scrollTo({top: Math.max(0, top), behavior:'auto'});
}));
selectCategory(activeCategory);
const backToTop = $('#back-to-top');
const updateBackToTop = () => { backToTop.hidden = window.scrollY < 500; };
window.addEventListener('scroll', updateBackToTop, {passive:true});
backToTop.addEventListener('click', () => window.scrollTo({top:0, behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}));
updateBackToTop();

async function loadNews() {
  try {
    const response = await fetch('data/news.json', {cache:'no-store'});
    if (!response.ok) throw Error('资讯尚未生成');
    const data = await response.json();
    $('#updated').textContent = `最近尝试更新 ${time(data.attempted)}`;
    const categories = [['local', data.city ? `${data.city} · 本地` : '本地'], ['society','社会热点'], ['world','国际视野']];
    $('#news').innerHTML = categories.map(([key, title]) => {
      const sources = Object.values(data.sources || {}).filter(source => source.category === key);
      const status = sources.map(source => `${source.name}：${source.error ? '更新失败' : '更新成功'}${source.updated ? ' · ' + time(source.updated) : ''}`).join('；');
      const items = sources.flatMap(source => source.items || []);
      const unique = items.filter((item, i) => items.findIndex(other => other.url === item.url || other.title === item.title) === i);
      let index = 0;
      const list = unique.map(item => {
        let url;
        try { url = new URL(item.original_url || item.url); } catch { return ''; }
        if (!['http:', 'https:'].includes(url.protocol)) return '';
        const messages = {article_unavailable:'无法获取新闻原文，暂无法生成摘要。', insufficient:'原文内容不足，暂无法生成摘要。', unconfigured:'摘要服务尚未配置。', pending:'摘要等待下次更新。', failed:'摘要生成失败，将在下次更新时重试。'};
        const summary = item.summary ? `<p class="summary">${escapeHtml(item.summary)}</p><span class="summary-label">AI 摘要 · 请以原文为准</span>` : `<p class="summary-status">${escapeHtml(messages[item.summary_status] || '暂无摘要。')}</p>`;
        return `<article class="article"><a class="article-title article-title-link" href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer"><span class="article-rank">${++index}.</span>${escapeHtml(item.title)}</a>${summary}<div class="meta">${escapeHtml(item.source)}${time(item.published) ? ' · ' + escapeHtml(time(item.published)) : ''} · <a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">查看来源 ↗</a></div></article>`;
      }).join('');
      const empty = key === 'local' && !data.city ? '请在仓库 config.json 中设置城市后重新部署。' : '暂无可用资讯，请稍后再试。';
      return `<section class="news-section" id="${key}"><h3>${escapeHtml(title)}</h3><p class="hint">${escapeHtml(status)}</p>${list || `<p class="hint">${empty}</p>`}</section>`;
    }).join('');
    selectCategory(activeCategory);
  } catch (error) { $('#news').innerHTML = '<p class="hint">资讯加载失败，请检查网络或稍后重试。</p>'; }
  await loadHotSearch();
  selectCategory(activeCategory);
}

async function loadHotSearch() {
  let content = '<p class="hint">热搜暂不可用，请稍后再试。</p>';
  try {
    const response = await fetch('data/hotsearch.json', {cache:'no-store'});
    if (!response.ok) throw Error('热搜尚未生成');
    const data = await response.json();
    const status = data.error ? '更新失败' + (data.updated ? '，显示上次榜单' : '') : (data.time_is_fetch ? '获取时间' : '榜单时间');
    const list = (data.items || []).map((item, index) => {
      let url;
      try { url = new URL(item.url); } catch { return ''; }
      if (url.protocol !== 'https:' || url.hostname !== 's.weibo.com') return '';
      return `<a class="article hot-item" href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer"><span class="hot-rank">${index + 1}</span><span class="article-title">${escapeHtml(item.title)}</span><span aria-hidden="true">↗</span></a>`;
    }).join('');
    content = `<p class="hint">${escapeHtml(status)}${data.updated ? ' · ' + escapeHtml(time(data.updated)) : ' · 时间未知'} · 数据：${escapeHtml(data.source || '第三方聚合')}</p><p class="hint">热搜话题不等于新闻事实，排名及内容可能变化。</p>${list || '<p class="hint">暂无热搜数据。</p>'}`;
  } catch {}
  $('#news').insertAdjacentHTML('beforeend', `<section class="news-section" id="weibo"><h3>🔥 微博热搜</h3>${content}</section>`);
}

const form = $('#city-form');
$('#change-city').addEventListener('click', () => { form.hidden = !form.hidden; });
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#city-results').textContent = '正在搜索…';
  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({name:$('#city').value.trim(), count:'8', language:'zh', format:'json'});
    const response = await fetch(url);
    if (!response.ok) throw Error('搜索失败');
    const data = await response.json();
    $('#city-results').replaceChildren();
    if (!data.results?.length) { $('#city-results').textContent = '未找到城市，请试试拼音或英文。'; return; }
    data.results.forEach(place => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'city-option';
      button.textContent = [place.name, place.admin1, place.country].filter(Boolean).join('，');
      button.onclick = () => {
        const selected = {name:button.textContent, latitude:place.latitude, longitude:place.longitude};
        try { localStorage.setItem('dailynews-city-v2', JSON.stringify(selected)); } catch {}
        $('#city-results').replaceChildren(); form.hidden = true; loadWeather(selected);
      };
      $('#city-results').append(button);
    });
  } catch { $('#city-results').textContent = '城市搜索失败，请检查网络后重试。'; }
});

async function loadWeather(place) {
  $('#weather-status').textContent = `正在获取 ${place.name} 的天气…`;
  $('#weather-content').replaceChildren();
  try {
    let data, updated = '刚刚获取';
    if (place.latitude === 30.29365 && place.longitude === 120.16142) {
      try {
        const response = await fetch('data/weather.json', {cache:'no-store'});
        if (!response.ok) throw Error('天气快照不可用');
        const snapshot = await response.json();
        if (!snapshot.daily?.time?.length) throw Error('天气快照为空');
        data = snapshot;
        updated = `${snapshot.error ? '更新失败，上次获取' : '更新于'} ${time(snapshot.updated)}`;
      } catch { /* Try the live API below. */ }
    }
    if (!data) {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({latitude:place.latitude, longitude:place.longitude, daily:'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code', timezone:'auto', forecast_days:'7'});
      const response = await fetch(url);
      if (!response.ok) throw Error('天气请求失败');
      data = await response.json();
    }
    const d = data.daily;
    const description = code => code == null ? '未知' : code === 0 ? '晴' : code <= 3 ? '多云' : code <= 48 ? '雾' : code <= 67 ? '雨' : code <= 77 ? '雪' : code <= 82 ? '阵雨' : code <= 86 ? '阵雪' : '雷雨';
    const weatherIcon = code => code == null ? '🌡️' : code === 0 ? '☀️' : code <= 3 ? '⛅' : code <= 48 ? '🌫️' : code <= 67 ? '🌧️' : code <= 77 ? '🌨️' : code <= 82 ? '🌦️' : code <= 86 ? '🌨️' : '⛈️';
    const number = value => Number.isFinite(value) ? Math.round(value) : '—';
    const weekday = day => ['周日','周一','周二','周三','周四','周五','周六'][new Date(`${day}T00:00:00Z`).getUTCDay()] || '';
    const days = d.time.map((day, i) => `<div class="day">${escapeHtml(day.slice(5))}<br>${weekday(day)}<span class="weather-icon" aria-hidden="true">${weatherIcon(d.weather_code[i])}</span>${description(d.weather_code[i])}<strong>${number(d.temperature_2m_max[i])}° / ${number(d.temperature_2m_min[i])}°</strong>降雨 ${number(d.precipitation_probability_max[i])}%</div>`).join('');
    const alerts = [];
    if (d.precipitation_probability_max.slice(0, 2).some(n => n != null && n >= 70)) alerts.push('今明两天有较高降雨概率，出门可带伞。');
    if (d.temperature_2m_max[0] != null && d.temperature_2m_max[1] != null && d.temperature_2m_max[0] - d.temperature_2m_max[1] >= 6) alerts.push('明日最高温较今天预计下降至少 6°C。');
    $('#weather-status').textContent = `${place.name} · ${updated} · 数据：Open-Meteo`;
    $('#weather-content').innerHTML = `${alerts.map(a => `<div class="alert">${a}</div>`).join('')}<div class="forecast">${days}</div><p class="hint">降雨概率为全天最高值；预报可能变化。</p>`;
  } catch { $('#weather-status').textContent = '天气获取失败，请检查网络或稍后重试。'; }
}
let place = {name:'杭州，浙江，中国', latitude:30.29365, longitude:120.16142};
try { place = JSON.parse(localStorage.getItem('dailynews-city-v2')) || place; } catch {}
form.hidden = true;
loadWeather(place);
loadNews();
