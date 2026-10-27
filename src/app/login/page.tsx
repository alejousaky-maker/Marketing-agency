import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Login from '@/components/login';
export const dynamic='force-dynamic';
export default async function Page(){if(await getSession())redirect('/');return <Login demoAvailable={process.env.DEMO_MODE==='true'&&['localhost','127.0.0.1'].includes(new URL(process.env.APP_URL??'https://invalid').hostname)}/>;}
