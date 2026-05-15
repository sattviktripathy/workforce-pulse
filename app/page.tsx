import { getDataset } from "../lib/data";
import { toSnapshot } from "../lib/snapshot";
import Dashboard from "../components/Dashboard";

// Load + normalize the two files once on the server, ship a plain snapshot.
// All cross-filter recompute happens on the client from this snapshot, so
// filtering is instant and the deploy stays static.
export default async function Home() {
  const ds = await getDataset();
  return <Dashboard snapshot={toSnapshot(ds)} />;
}
