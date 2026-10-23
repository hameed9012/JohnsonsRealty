import ClientEdit from '../[id]/edit/page';

export { metadata } from '../[id]/edit/page';

export default function NewClient() {
  return <ClientEdit params={Promise.resolve({ id: 'new' })} />;
}
