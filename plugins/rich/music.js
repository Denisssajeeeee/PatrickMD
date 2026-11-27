import { AIRich } from '../../lib/messagebuilder.js';
import { sendFakeQuoted } from '../../lib/fakequoted.js';

const htmlPayload = String.raw`
<style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; font-family: Arial, sans-serif; }
  html, body { margin: 0; padding: 0; width: 100%; overflow: hidden; background: transparent; }
  .spWrap { width: 100%; padding: 8px; border-radius: 18px; background: #121212; border: 2px solid #1db954; box-shadow: 0 4px 15px rgba(0,0,0,.4); color: #fff; }
  .spHeader { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .spLogo { font: bold 18px Arial; letter-spacing: 1px; }
  .spLogo span { color: #1db954; }
  .spBadge { font-size: 9px; background: #1db954; padding: 3px 7px; border-radius: 20px; font-weight: bold; color: #000; }
  .spSearch { display: flex; gap: 6px; margin-bottom: 8px; }
  .spSearch input { flex: 1; padding: 9px 12px; border-radius: 20px; border: none; background: #2a2a2a; color: #fff; font-size: 12px; outline: none; }
  .spSearch button { padding: 9px 14px; border-radius: 20px; border: none; background: #1db954; font-weight: bold; font-size: 12px; }
  .spQuick { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 8px; }
  .spQuick button { padding: 5px 10px; border-radius: 20px; border: 1px solid #333; background: #222; color: #ddd; font-size: 10px; }
  .spList { max-height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
  .spItem { display: flex; gap: 8px; align-items: center; background: #1e1e1e; padding: 7px; border-radius: 12px; cursor: pointer; }
  .spItem.active { background: #1db954; }
  .spItem.active .spTitle, .spItem.active .spArtist { color: #000; }
  .spItem img { width: 46px; height: 46px; border-radius: 8px; object-fit: cover; }
  .spInfo { flex: 1; min-width: 0; }
  .spTitle { font-size: 12px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .spArtist { font-size: 10px; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .spPlay { font-size: 20px; }
  .spPlayer { margin-top: 8px; background: #1e1e1e; border-radius: 12px; padding: 10px; display: none; }
  .spPlayer.show { display: block; }
  .spNow { display: flex; gap: 8px; align-items: center; }
  .spNow img { width: 52px; height: 52px; border-radius: 8px; }
  .spControls { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 8px; }
  .spControls button { width: 38px; height: 38px; border-radius: 50%; border: none; background: #fff; font-size: 16px; }
  .spControls button.main { width: 48px; height: 48px; background: #1db954; font-size: 20px; }
  .spProgress { height: 4px; background: #333; border-radius: 4px; margin-top: 8px; overflow: hidden; }
  .spBar { height: 100%; background: #1db954; width: 0%; }
  .spTime { display: flex; justify-content: space-between; font-size: 9px; color: #aaa; margin-top: 3px; }
  .spEmpty { text-align: center; color: #888; font-size: 11px; padding: 20px 0; }
  .spFooter { text-align: center; font-size: 9px; color: #666; margin-top: 6px; }
</style>

<div class="spWrap">
  <div class="spHeader">
    <div class="spLogo">🎧 DENN<span>MUSIC</span></div>
    <div class="spBadge">PREVIEW 30s</div>
  </div>

  <div class="spSearch">
    <input id="spInput" placeholder="Cari lagu / artis..." value="Hindia" />
    <button id="spBtn">🔍</button>
  </div>

  <div class="spQuick">
    <button data-q="Hindia">Hindia</button>
    <button data-q="Bernadya">Bernadya</button>
    <button data-q="Nadin Amizah">Nadin</button>
    <button data-q="Juicy Luicy">Juicy Luicy</button>
    <button data-q="Taylor Swift">Taylor</button>
  </div>

  <div class="spList" id="spList"><div class="spEmpty">Mencari lagu...</div></div>

  <div class="spPlayer" id="spPlayer">
    <div class="spNow">
      <img id="spCover" src="" />
      <div class="spInfo">
        <div class="spTitle" id="spNowTitle">-</div>
        <div class="spArtist" id="spNowArtist">-</div>
      </div>
      <div>🎵</div>
    </div>
    <audio id="spAudio" preload="none"></audio>
    <div class="spProgress"><div class="spBar" id="spBar"></div></div>
    <div class="spTime"><span id="spCur">0:00</span><span>0:30</span></div>
    <div class="spControls">
      <button id="spPrev">⏮️</button>
      <button class="main" id="spPlayBtn">▶️</button>
      <button id="spNext">⏭️</button>
    </div>
  </div>
  <div class="spFooter">Preview dari iTunes • Support artisnya di Spotify asli ya 💚</div>
</div>

<script>
(function(){
  const input = document.getElementById('spInput');
  const btn = document.getElementById('spBtn');
  const list = document.getElementById('spList');
  const audio = document.getElementById('spAudio');
  const player = document.getElementById('spPlayer');
  const cover = document.getElementById('spCover');
  const nowTitle = document.getElementById('spNowTitle');
  const nowArtist = document.getElementById('spNowArtist');
  const playBtn = document.getElementById('spPlayBtn');
  const bar = document.getElementById('spBar');
  const cur = document.getElementById('spCur');

  let tracks = [];
  let current = -1;

  function fmt(s){ const m=Math.floor(s/60), d=Math.floor(s%60); return m+':'+String(d).padStart(2,'0'); }

  async function search(q){
    if(!q) return;
    list.innerHTML = '<div class="spEmpty">🔍 Mencari "'+q+'"... </div>';
    try{
      const res = await fetch('https://itunes.apple.com/search?term='+encodeURIComponent(q)+'&media=music&limit=12&country=ID&lang=id_id');
      const data = await res.json();
      tracks = data.results || [];
      if(!tracks.length){ list.innerHTML='<div class="spEmpty">Lagu tidak ditemukan 😢</div>'; return; }
      list.innerHTML = '';
      tracks.forEach((t,i)=>{
        const div = document.createElement('div');
        div.className='spItem'; div.dataset.i=i;
        div.innerHTML = '<img src="'+t.artworkUrl100.replace('100x100bb','200x200bb')+'"/><div class="spInfo"><div class="spTitle">'+t.trackName+'</div><div class="spArtist">'+t.artistName+' • '+t.collectionName+'</div></div><div class="spPlay">▶️</div>';
        div.addEventListener('click', ()=>play(i));
        list.appendChild(div);
      });
    }catch(e){
      list.innerHTML='<div class="spEmpty">Gagal load. Cek internet / coba lagi.</div>';
    }
  }

  function play(i){
    current=i;
    const t=tracks[i];
    document.querySelectorAll('.spItem').forEach((el,idx)=>el.classList.toggle('active', idx===i));
    cover.src=t.artworkUrl100.replace('100x100bb','300x300bb');
    nowTitle.textContent=t.trackName;
    nowArtist.textContent=t.artistName;
    player.classList.add('show');
    audio.src=t.previewUrl;
    audio.play();
    playBtn.textContent='⏸️';
  }

  playBtn.addEventListener('click', ()=>{
    if(!audio.src) return;
    if(audio.paused){ audio.play(); playBtn.textContent='⏸️'; }
    else { audio.pause(); playBtn.textContent='▶️'; }
  });
  document.getElementById('spNext').addEventListener('click', ()=>{ if(current<tracks.length-1) play(current+1); });
  document.getElementById('spPrev').addEventListener('click', ()=>{ if(current>0) play(current-1); });

  audio.addEventListener('timeupdate', ()=>{
    const p = (audio.currentTime/30)*100;
    bar.style.width = p+'%';
    cur.textContent = fmt(audio.currentTime);
  });
  audio.addEventListener('ended', ()=>{
    playBtn.textContent='▶️';
    if(current<tracks.length-1) play(current+1);
  });

  btn.addEventListener('click', ()=>search(input.value.trim()));
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') search(input.value.trim()); });
  document.querySelectorAll('.spQuick button').forEach(b=>{
    b.addEventListener('click', ()=>{ input.value=b.dataset.q; search(b.dataset.q); });
  });

  search('Hindia');
})();
</script>
`;

export default {
    command: ['music'],
    category: 'rich',
    execute: async (denn, m) => {
        try {
            const rich = new AIRich(denn, {
                dynamic: true,
                unsupportedTypeAlert: false
            });
            rich.addSection({
                view_model: {
                    primitive: {
                        __typename: 'GenAIaeacdsnwHtmlPrimitive',
                        payload: htmlPayload,
                        trusted_sources: []
                    },
                    __typename: 'GenAISingleLayoutViewModel'
                }
            });
            await rich.send(m.chat, {
                quoted: m,
                includesUnifiedResponse: true,
                includesSubmessages: false,
                forwarded: true,
                notification: false
            });
        } catch (err) {
            console.error('[Spotify Rich Error]', err);
            sendFakeQuoted(denn, m, `❌ *Gagal memuat DennMusic:*\n${err.message}`, { title: 'Music Gagal', body: 'Fitur HTML Rich tidak didukung' });
        }
    }
};