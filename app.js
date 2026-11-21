const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time = (value) => {
  if (!value || Number.isNaN(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}).format(new Date(value));
};
$('#today').textContent = new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', month:'long', day:'numeric', weekday:'short'}).format(new Date());

async function loadNews() {
  try {
    const response = await fetch('data/news.json', {cache:'no-store'});
    if (!response.ok) throw Error('资讯尚未生成');
    const data = await response.json();
    $('#updated').textContent = `最近尝试更新 ${time(data.attempted)}`;
    const categories = [['local', data.city ? `${data.city} · 本地` : '本地'], ['society','社会热点'], ['world','国际视野'], ['discovery','新奇发现']];
    $('#news').innerHTML = categories.map(([key, title]) => {
      const sources = Object.values(data.sources || {}).filter(source => source.category === key);
      const status = sources.map(source => `${source.name}：${source.error ? '更新失败' : '更新成功'}${source.updated ? ' · ' + time(source.updated) : ''}`).join('；');
      const items = sources.flatMap(source => source.items || []);
      const unique = items.filter((item, i) => items.findIndex(other => other.url === item.url || other.title === item.title) === i);
      const list = unique.map(item => {
        let url;
        try { url = new URL(item.url); } catch { return ''; }
        if (!['http:', 'https:'].includes(url.protocol)) return '';
        return `<a class="article" href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer"><div class="article-title">${escapeHtml(item.title)}</div><div class="meta">${escapeHtml(item.source)}${time(item.published) ? ' · ' + escapeHtml(time(item.published)) : ''} ↗</div></a>`;
      }).join('');
      const empty = key === 'local' && !data.city ? '请在仓库 config.json 中设置城市后重新部署。' : '暂无可用资讯，请稍后再试。';
      return `<section class="news-section" id="${key}"><h3>${escapeHtml(title)}</h3><p class="hint">${escapeHtml(status)}</p>${list || `<p class="hint">${empty}</p>`}</section>`;
    }).join('');
  } catch (error) { $('#news').innerHTML = '<p class="hint">资讯加载失败，请检查网络或稍后重试。</p>'; }
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
        try { localStorage.setItem('dailynews-city', JSON.stringify(selected)); } catch {}
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
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({latitude:place.latitude, longitude:place.longitude, daily:'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code', timezone:'auto', forecast_days:'7'});
    const response = await fetch(url);
    if (!response.ok) throw Error('天气请求失败');
    const data = await response.json(), d = data.daily;
    const description = code => code === 0 ? '晴' : code <= 3 ? '多云' : code <= 48 ? '雾' : code <= 67 ? '雨' : code <= 77 ? '雪' : code <= 82 ? '阵雨' : code <= 86 ? '阵雪' : '雷雨';
    const number = value => Number.isFinite(value) ? Math.round(value) : '—';
    const days = d.time.map((day, i) => `<div class="day">${escapeHtml(day.slice(5))}<br>${description(d.weather_code[i])}<strong>${number(d.temperature_2m_max[i])}° / ${number(d.temperature_2m_min[i])}°</strong>降雨 ${number(d.precipitation_probability_max[i])}%</div>`).join('');
    const alerts = [];
    if (d.precipitation_probability_max.slice(0, 2).some(n => n != null && n >= 70)) alerts.push('今明两天有较高降雨概率，出门可带伞。');
    if (d.temperature_2m_max[0] != null && d.temperature_2m_max[1] != null && d.temperature_2m_max[0] - d.temperature_2m_max[1] >= 6) alerts.push('明日最高温较今天预计下降至少 6°C。');
    $('#weather-status').textContent = `${place.name} · 刚刚获取 · 数据：Open-Meteo`;
    $('#weather-content').innerHTML = `${alerts.map(a => `<div class="alert">${a}</div>`).join('')}<div class="forecast">${days}</div><p class="hint">降雨概率为全天最高值；预报可能变化。</p>`;
  } catch { $('#weather-status').textContent = '天气获取失败，请检查网络或稍后重试。'; }
}
try { const place = JSON.parse(localStorage.getItem('dailynews-city')); if (place) { form.hidden = true; loadWeather(place); } } catch {}
loadNews();
