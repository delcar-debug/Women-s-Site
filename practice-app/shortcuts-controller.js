/* One keyboard controller for Coach Mode. */
(()=>{
  'use strict';
  const byId=id=>document.getElementById(id);
  const isCoachOpen=()=>byId('timerPanel')?.classList.contains('active');
  function typingTarget(target){
    if(!target)return false;
    if(target.isContentEditable)return true;
    const tag=target.tagName;
    if(tag==='TEXTAREA')return true;
    if(tag==='INPUT'){
      const type=(target.type||'text').toLowerCase();
      return ['text','search','email','url','password'].includes(type);
    }
    return false;
  }
  function click(id){const b=byId(id);if(b&&!b.disabled){b.click();return true}return false}
  function intervalToggle(){
    if(state.interval?.running){click('intervalPauseBtn');return}
    click('intervalStartBtn');
  }
  window.addEventListener('keydown',event=>{
    if(!isCoachOpen()||event.repeat||typingTarget(event.target))return;
    const code=event.code,key=event.key;
    if(code==='F8'||code==='Space'){event.preventDefault();window.SpotifyController?.toggle();return}
    if(key==='w'||key==='W'){event.preventDefault();click('intervalTestBtn');return}
    if(key==='t'||key==='T'){event.preventDefault();intervalToggle();return}
    if(key==='m'||key==='M'){event.preventDefault();
      if(window.SpotifyController?.mute)window.SpotifyController.mute();
      else state.spotify.player?.getVolume().then(v=>state.spotify.player.setVolume(v>0?0:.7));
      return;
    }
    if(['ArrowUp','ArrowLeft'].includes(key)){event.preventDefault();click('previousBtn');return}
    if(['ArrowDown','ArrowRight','Enter'].includes(key)){event.preventDefault();click('nextBtn');return}
  },true);
})();
