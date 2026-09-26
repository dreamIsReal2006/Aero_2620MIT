export function Icon({ name, className = 'h-5 w-5' }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    home: <><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z" /><path d="M9 21v-7h6v7" /></>,
    video: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m8 5 2-3m4 3 2-3m-8 9 4 2.5L8 14v-5Z" /></>,
    chat: <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.5-.7L4 20l1.7-3.6A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" />,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
    bookmark: <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3-6 3V4.5Z" />,
    history: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    settings: <><path d="M12 2.75 14.1 4.2l2.5-.35.95 2.35 2.25 1.15-.35 2.5L20.9 12l-1.45 2.1.35 2.5-.95 2.35-2.5-.35L12 21.25l-2.1-1.5-.95 2.35-2.25-1.15.35-2.5L3.1 12l1.45-2.15-.35-2.5 2.25-1.15.95-2.35 2.5.35L12 2.75Z" /><circle cx="12" cy="12" r="3" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 4.5-4 3.5 3 2.5-2 5.5 5" /></>,
    gif: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M8 9H6v6h2v-2H7m4-4v6m3-6v6m0-6h2a2 2 0 0 1 0 4h-2" /></>,
    smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" /></>,
    poll: <><path d="M4 19V5m0 14h17" /><path d="M8 15v-3m5 3V8m5 7V5" /></>,
    quote: <><path d="M10 11H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-6a5 5 0 0 0-5-5m15 5h-5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-6a5 5 0 0 0-5-5" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    audio: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
    draft: <><path d="M7 3h7l5 5v13H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z" /><path d="M14 3v6h5M8 13h8m-8 4h8" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    check: <path d="m5 12 4 4L19 6" />,
    options: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" fill="white" /><circle cx="15" cy="12" r="2" fill="white" /><circle cx="10" cy="18" r="2" fill="white" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    logout: <><path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10" /><path d="m14 8 4 4-4 4M8 12h10" /></>,
    sparkle: <path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>;
}

export function Avatar({ user = {}, className = 'h-10 w-10' }) {
  const avatar = user.avatar_url || user.avatar || '';
  const url = avatar && !String(avatar).startsWith('letter:') ? (String(avatar).startsWith('http') ? avatar : `${process.env.NEXT_PUBLIC_API_ORIGIN || ''}${avatar}`) : '';
  const letter = avatar.startsWith('letter:') ? avatar.slice(7, 8).toUpperCase() : (user.display_name || user.username || 'U').slice(0, 1).toUpperCase();
  return <span className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#0A84FF] to-[#39c6ff] font-bold text-white ${className}`}>{url ? <img src={url} alt="" className="h-full w-full object-cover" /> : letter}</span>;
}

export function Glass({ children, className = '' }) { return <div className={`border border-white/60 bg-white/65 shadow-glass backdrop-blur-2xl ${className}`}>{children}</div>; }
