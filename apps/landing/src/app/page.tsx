import PresenceInspector from './presence-inspector';

export default function WebPresenceExample() {
  return (
    <main>
      <h1>Web presence example</h1>
      <p>
        An optional, untrusted rendezvous cache for sovereign apps. Presence is not proof of
        reachability, pairing, identity, or authorization.
      </p>
      <PresenceInspector />
      <p>Local QR, mDNS, and direct Iroh connections work without this service.</p>
    </main>
  );
}
