const hero = document.querySelector('#hero-video');
const portraitHero = matchMedia('(max-width: 620px) and (orientation: portrait)');
const heroFile = () => 'assets/media/hero' + (portraitHero.matches ? '-mobile' : '');
hero.poster = heroFile() + '.webp';
const filmToggle = document.querySelector('.film-toggle');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motionEnabled = !reducedMotion.matches;
let heroVisible = true;
function updateFilmButton(){
  const paused = hero.paused;
  filmToggle.setAttribute('aria-label', paused ? 'Play background video' : 'Pause background video');
  filmToggle.title = filmToggle.getAttribute('aria-label');
  filmToggle.querySelector('path').setAttribute('d', paused ? 'm8 5 11 7-11 7z' : 'M8 5v14M16 5v14');
}
async function syncHero(){
  if (!motionEnabled || !heroVisible || document.hidden || document.querySelector('dialog[open]')) {
    hero.pause(); updateFilmButton(); return;
  }
  if (!hero.getAttribute('src')) hero.src = heroFile() + '.mp4';
  try { await hero.play(); } catch { updateFilmButton(); }
}
hero.addEventListener('pause',updateFilmButton);
hero.addEventListener('play',updateFilmButton);
filmToggle.addEventListener('click',()=>{ motionEnabled = hero.paused; syncHero(); });
reducedMotion.addEventListener('change',()=>{motionEnabled=!reducedMotion.matches;syncHero();});
portraitHero.addEventListener('change',()=>{
  hero.poster=heroFile()+'.webp';
  if(hero.getAttribute('src'))hero.src=heroFile()+'.mp4';
  syncHero();
});
document.addEventListener('visibilitychange',syncHero);

const cover = document.getElementById('top');
let transitionFrame = 0;

function updateCoverTransition() {
  transitionFrame = 0;
  const bounds = cover.getBoundingClientRect();
  const scrolled = Math.max(0, Math.min(-bounds.top, bounds.height));
  hero.style.setProperty('--film-offset', (scrolled * .72).toFixed(1) + 'px');
}

function queueCoverTransition() {
  if (!transitionFrame && !reducedMotion.matches) {
    transitionFrame = requestAnimationFrame(updateCoverTransition);
  }
}

new IntersectionObserver(([entry]) => {
  heroVisible = entry.isIntersecting;
  if (heroVisible) window.addEventListener('scroll', queueCoverTransition, {passive: true});
  else window.removeEventListener('scroll', queueCoverTransition);
  queueCoverTransition();
  syncHero();
}).observe(cover);
window.addEventListener('resize', queueCoverTransition);
reducedMotion.addEventListener('change', queueCoverTransition);
queueCoverTransition();
updateFilmButton();

const pendingResources = document.querySelectorAll('.pending-resource');
function showResourceTip(active = null) {
  for (const resource of pendingResources) {
    resource.querySelector('[role="tooltip"]').hidden = resource !== active;
  }
}
for (const resource of pendingResources) {
  resource.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'touch') showResourceTip(resource);
  });
  resource.addEventListener('pointerleave', () => {
    if (!resource.matches(':focus-visible')) showResourceTip();
  });
  resource.addEventListener('focus', () => showResourceTip(resource));
  resource.addEventListener('blur', () => showResourceTip());
  resource.addEventListener('click', () => showResourceTip(resource));
}
document.addEventListener('pointerdown', event => {
  if (!event.target.closest('.pending-resource')) showResourceTip();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') showResourceTip();
});

const menu=document.querySelector('.menu'),nav=document.querySelector('#nav-links');
function closeNav(){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation');}
menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');});
nav.addEventListener('click',closeNav);document.addEventListener('keydown',e=>{if(e.key==='Escape' && nav.classList.contains('open')){closeNav();menu.focus();}});

const dialog=document.querySelector('.media-dialog'), content=dialog.querySelector('.dialog-content');
for(const link of document.querySelectorAll('[data-film],[data-image]')){
 link.addEventListener('click',event=>{
   if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   if(typeof dialog.showModal!=='function')return;
   event.preventDefault();
   const isVideo=link.hasAttribute('data-film');
   const item=document.createElement(isVideo?'video':'img');
   if(isVideo){item.controls=true;item.playsInline=true;}
   else item.alt=link.querySelector('img')?.alt || link.dataset.caption;
   dialog.querySelector('#dialog-title').textContent=isVideo?'RISE · Fast forward':link.dataset.caption;
   item.src=link.href;content.replaceChildren(item);dialog.showModal();hero.pause();
   if(isVideo)item.play().catch(()=>{});
 });
}
dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('close',()=>{content.querySelector('video')?.pause();content.replaceChildren();syncHero();});

const roomPicker = document.querySelector('.room-picker');
const roomButtons = [...roomPicker.querySelectorAll('button[data-room]')];
const roomSelect = document.querySelector('#room-select');
const roomStrip = document.getElementById('room-strip');
const previousRooms = roomPicker.querySelector('.previous');
const nextRooms = roomPicker.querySelector('.next');
const resultMode = document.getElementById('result-mode');
const roomViewers = document.querySelector('#room-viewers');
const roomInput = document.querySelector('#room-input');
const clipButton = document.querySelector('#room-clip-toggle');
const roomClip = document.querySelector('#room-clip');
const savedViews = new Map();
let selectedRoom = roomButtons[0];

function showModel() {
  roomClip.pause();
  roomClip.hidden = true;
  roomViewers.hidden = false;
  clipButton.textContent = 'Play scene video';
  resultMode.textContent = 'Interactive reconstruction';
}

function chooseRoom(button) {
  if (button === selectedRoom) return;
  const room = button.dataset.room;
  const title = button.textContent;
  const previous = roomViewers.querySelector('rise-viewer');
  if (previous?.captureState) savedViews.set(previous.dataset.room, previous.captureState());

  selectedRoom.setAttribute('aria-pressed', 'false');
  selectedRoom = button;
  button.setAttribute('aria-pressed', 'true');
  roomSelect.value = room;
  if (roomStrip.clientWidth) revealRoom(button);

  showModel();
  if (roomClip.hasAttribute('src')) {
    roomClip.removeAttribute('src');
    roomClip.load();
  }
  clipButton.hidden = !button.dataset.clip;
  const fromPaper = room.startsWith('figure6-');
  roomInput.src = 'assets/media/' + room + '-input.' + (fromPaper ? 'jpg' : 'webp');
  roomInput.alt = title + ' input image';

  const panel = document.createElement('rise-viewer');
  panel.dataset.room = room;
  panel.dataset.title = title;
  panel.initialState = savedViews.get(room);
  roomViewers.replaceChildren(panel);
}

for (const button of roomButtons) {
  roomSelect.add(new Option(button.textContent, button.dataset.room));
  const thumbnail = new Image(280, 130);
  thumbnail.alt = '';
  thumbnail.loading = 'lazy';
  thumbnail.src = 'assets/media/room-thumbs/' + button.dataset.room + '.webp';
  button.prepend(thumbnail);
  button.addEventListener('click', () => chooseRoom(button));
}
roomSelect.addEventListener('change', () => chooseRoom(roomButtons[roomSelect.selectedIndex]));
roomPicker.classList.add('ready');
function revealRoom(button) {
  const frame = roomStrip.getBoundingClientRect();
  const tile = button.getBoundingClientRect();
  if (tile.left < frame.left) roomStrip.scrollLeft += tile.left - frame.left;
  else if (tile.right > frame.right) roomStrip.scrollLeft += tile.right - frame.right;
}
function updateGalleryButtons() {
  previousRooms.disabled = roomStrip.scrollLeft <= 2;
  nextRooms.disabled = roomStrip.scrollLeft + roomStrip.clientWidth >= roomStrip.scrollWidth - 2;
}
for (const [button, direction] of [[previousRooms, -1], [nextRooms, 1]]) {
  button.addEventListener('click', () => roomStrip.scrollBy({
    left: direction * roomStrip.clientWidth * .84,
    behavior: reducedMotion.matches ? 'instant' : 'smooth'
  }));
}
roomStrip.addEventListener('scroll', updateGalleryButtons, {passive: true});
new ResizeObserver(() => {
  if (roomStrip.clientWidth) revealRoom(selectedRoom);
  updateGalleryButtons();
}).observe(roomStrip);
if (location.hash === '#real-world-results') {
  chooseRoom(roomButtons.find(button => button.dataset.room === 'figure6-1'));
}

clipButton.addEventListener('click', () => {
  if (!roomClip.hidden) {
    showModel();
    return;
  }
  const clip = selectedRoom.dataset.clip;
  if (!clip) return;
  roomClip.poster = 'assets/media/' + clip + '.webp';
  if (!roomClip.hasAttribute('src')) roomClip.src = 'assets/media/' + clip + '.mp4';
  roomClip.setAttribute('aria-label', selectedRoom.textContent + ' reconstruction video');
  roomViewers.hidden = true;
  roomClip.hidden = false;
  clipButton.textContent = 'Back to 3D';
  resultMode.textContent = 'Scene video';
  roomClip.play().catch(() => {});
});
new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) roomClip.pause();
}).observe(roomClip);

const viewerObserver = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return;
  viewerObserver.disconnect();
  import('./viewer.js?v=24').catch(() => {
    roomViewers.textContent = 'The 3D viewer could not load. Reload the page to try again.';
  });
}, { rootMargin: '350px' });
viewerObserver.observe(roomPicker);

const copyButton=document.querySelector('.copy-button');
const copyLabel=copyButton.querySelector('span').textContent;
let resetLabel;
copyButton.addEventListener('click',async()=>{
 const code=document.querySelector('#bibtex');
 try{
   if(!navigator.clipboard)throw Error();
   await navigator.clipboard.writeText(code.textContent);
   copyButton.querySelector('span').textContent='Copied';
 }catch{
   document.querySelector('#citation-source').open=true;
   const range=document.createRange();range.selectNodeContents(code);
   const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
   copyButton.querySelector('span').textContent='Citation selected';
 }
 clearTimeout(resetLabel);resetLabel=setTimeout(()=>{copyButton.querySelector('span').textContent=copyLabel;},2300);
});
