import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Dashboard from '@/components/dashboard';
export const dynamic='force-dynamic';
export default async function Page() {const session=await getSession();if(!session)redirect('/login');return <Dashboard session={session}/>;}
