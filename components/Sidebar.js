'use client';

import { Icon, Glass } from './ui';

const leftItems = [['home', 'Home'], ['video', 'Shorts'], ['chat', 'Chat']];
const rightItems = [['bell', 'Notifications'], ['bookmark', 'Bookmarks'], ['history', 'View history'], ['settings', 'Settings']];
const materialSymbols = { home: 'home', chat: 'sms', bell: 'notifications', bookmark: 'bookmark', history: 'archive' };

function SidebarIcon({ name }) {
  const symbol = materialSymbols[name];
  return symbol ? <span className="material-symbols-outlined nav-icon">{symbol}</span> : <Icon name={name} />;
}

function Dock({ side, items, active, onNavigate }) {
  return <Glass className={`fixed top-[120px] z-30 hidden min-h-[204px] w-[68px] flex-col items-center gap-3 rounded-full p-3 md:flex ${side === 'left' ? 'left-8' : 'right-8 right-dock'}`}><div className="dock-scroll-wrapper flex flex-col gap-3 overflow-visible p-1" onWheel={(event) => { const list = event.currentTarget; if (list.scrollHeight <= list.clientHeight || event.deltaY === 0) return; event.preventDefault(); list.scrollTop += event.deltaY; }}>{items.map(([icon, label]) => <button key={label} onClick={() => onNavigate?.(label)} className={`dock-item relative grid h-11 w-11 place-items-center rounded-full transition duration-200 hover:scale-[1.08] hover:bg-[#0A84FF]/10 active:scale-95 ${active === label ? 'active z-[1] bg-black/[.06] text-[#0A84FF] shadow-[0_0_0_5px_rgba(10,132,255,.1)]' : ''}`} aria-label={label} title={label}><SidebarIcon name={icon} /></button>)}</div></Glass>;
}

export default function Sidebar({ active, onNavigate }) {
  return <><Dock side="left" items={leftItems} active={active} onNavigate={onNavigate} /><Dock side="right" items={rightItems} active={active} onNavigate={onNavigate} /><nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-white/50 bg-white/70 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_28px_rgba(17,24,39,.1)] backdrop-blur-2xl md:hidden">{[['home','Home'],['video','Shorts'],['plus','Post'],['chat','Messages'],['user','Profile']].map(([icon, label]) => <button key={label} onClick={() => onNavigate?.(label)} className={`grid min-h-12 flex-1 place-items-center gap-0.5 rounded-xl text-[.65rem] ${active === label || (active === 'Home' && label === 'Home') ? 'font-bold text-[#0A84FF]' : 'text-[#65676b]'}`} aria-label={label}>{icon === 'user' ? <span className="grid h-[21px] w-[21px] place-items-center rounded-full border-2 border-current text-[11px]">U</span> : icon === 'plus' ? <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#0A84FF] text-2xl font-light text-white shadow-[0_5px_14px_rgba(10,132,255,.28)]">+</span> : <SidebarIcon name={icon} /> }<span>{label}</span></button>)}</nav></>;
}
