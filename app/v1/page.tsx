import Sidebar from '@/components/Sidebar/Sidebar';
import FeedV1 from '@/components/Feed/FeedV1';
import RightPanel from '@/components/RightPanel/RightPanel';
import VersionSwitcher from '@/components/VersionSwitcher';

/** Frozen v1 — Nina / Fitzroy morning briefing (FeedV1) + shared right panel. */
export default function V1Page() {
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: 'var(--color-bg-surface)',
        fontFamily: 'var(--font-primary)',
      }}
    >
      <Sidebar />
      <FeedV1 />
      <RightPanel />
      <VersionSwitcher />
    </div>
  );
}
