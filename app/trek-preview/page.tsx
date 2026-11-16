import {redirect} from 'next/navigation';
// Retire the standalone preview; old bookmarks now use the authenticated app shell.
export default function TrekPreview(){redirect('/?section=treks');}
