import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'AgencyOS — Creative intelligence, grounded in profit',description:'Your operating system for creative intelligence and contribution profit.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>;}
