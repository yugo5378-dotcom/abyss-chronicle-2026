'use strict';

const episodeRoot = document.getElementById('app');
const returnToEpisodes = () => {
  const header = episodeRoot.querySelector('.top');
  if (!header || header.querySelector('[data-episode-nav]')) return;
  const link = document.createElement('a');
  link.dataset.episodeNav = '1';
  link.href = './';
  link.textContent = '話数選択';
  link.style.cssText = 'display:inline-block;color:#e2c992;padding:6px 8px;text-decoration:underline;font-size:12px';
  header.append(link);
};
new MutationObserver(returnToEpisodes).observe(episodeRoot,{childList:true,subtree:true});
returnToEpisodes();
