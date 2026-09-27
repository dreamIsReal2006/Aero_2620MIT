import './globals.css';

export const metadata = { title: 'Aero - Liquid Social Platform', description: 'Aero social platform' };

export default function RootLayout({ children }) {
  return <html lang="en"><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=home,sms,notifications,bookmark,archive,settings,web_stories" /></head><body>{children}</body></html>;
}
