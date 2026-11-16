import Workspace from './workspace';
export default async function Home({searchParams}:{searchParams:Promise<{section?:string}>}){const query=await searchParams;return <Workspace initialView={query?.section==='treks'?'treks':'sessions'}/>;}
