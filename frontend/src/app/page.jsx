import { redirect } from 'next/navigation';

// Single domain: the bare root sends people to the vendor portal. Staff use
// the /vendoradmin path directly.
export default function Root() {
  redirect('/vendor');
}
