'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowUpRight,
  ChartColumn,
  Dna,
  MessageSquare,
  Search,
  Send,
  Settings,
  Star,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  BOT_ANSWERS,
  VIEW_GROUPS,
  type BotAnswer,
  type Tile,
  type TileGroup,
  type ViewId,
} from './data';
import styles from './joshua.module.css';

type NavEntry = { id: ViewId; label: string; icon: LucideIcon | 'edify' };

const NAV: NavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: ChartColumn },
  { id: 'people', label: 'People Reporting', icon: Users },
  { id: 'feedback', label: 'Customer Feedback', icon: Star },
  { id: 'operations', label: 'Operations', icon: Store },
  { id: 'edify', label: 'Edify', icon: 'edify' },
  { id: 'bot', label: 'Bot', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const VIEW_IDS = new Set<string>(NAV.map((n) => n.id));

function EdifyMark({ size = 14, color = '#FF315D' }: { size?: number; color?: string }) {
  return (
    <svg width={size * 0.58} height={size} viewBox="0 0 96 165" aria-hidden="true">
      <path
        d="M94.4445 0.5H0.5V72.493C0.5 148.585 63.8333 165.506 95.5 164.455V129.247C59.6111 129.247 52.0463 98.7678 52.75 83.5284H94.4445V0.5Z"
        fill={color}
      />
    </svg>
  );
}

function PoweredByEdify() {
  return (
    <span className={styles.poweredBy}>
      <EdifyMark size={12} />
      Powered by Edify
    </span>
  );
}

function TileCard({ tile }: { tile: Tile }) {
  const Icon = tile.icon;
  const body = (
    <>
      <span className={`${styles.tileIcon} ${styles[`tone_${tile.tone}`]}`} aria-hidden="true">
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <ArrowUpRight className={styles.tileArrow} size={18} aria-hidden="true" />
      <span className={styles.tileTitle}>{tile.title}</span>
      <span className={styles.tileDescription}>{tile.description}</span>
    </>
  );

  if (tile.href) {
    return (
      <Link href={tile.href} className={`${styles.tile} ${styles.tileLink}`}>
        {body}
      </Link>
    );
  }
  return <div className={styles.tile}>{body}</div>;
}

function GroupSection({ group, onGo }: { group: TileGroup; onGo: (id: ViewId) => void }) {
  const single = group.tiles.length === 1;
  return (
    <section className={styles.group} aria-labelledby={`group-${group.heading}`}>
      <div className={styles.groupHeader}>
        <h2 id={`group-${group.heading}`} className={styles.groupHeading}>
          {group.heading}
        </h2>
        {group.edify && <PoweredByEdify />}
        {group.more && (
          <button type="button" className={styles.groupMore} onClick={() => onGo(group.more!.view)}>
            {group.more.label}
          </button>
        )}
      </div>
      {group.intro && <p className={styles.intro}>{group.intro}</p>}
      <div className={`${styles.groupCard} ${single ? styles.groupCardSingle : ''}`}>
        {group.tiles.map((tile) => (
          <TileCard key={tile.title} tile={tile} />
        ))}
      </div>
    </section>
  );
}

function TileView({
  groups,
  query,
  onGo,
}: {
  groups: TileGroup[];
  query: string;
  onGo: (id: ViewId) => void;
}) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? groups
        .map((g) => ({
          ...g,
          tiles: g.tiles.filter((t) => `${t.title} ${t.description}`.toLowerCase().includes(q)),
        }))
        .filter((g) => g.tiles.length > 0)
    : groups;

  if (filtered.length === 0) {
    return <p className={styles.empty}>No reports match &ldquo;{query}&rdquo;.</p>;
  }
  return (
    <>
      {filtered.map((g) => (
        <GroupSection key={g.heading} group={g} onGo={onGo} />
      ))}
    </>
  );
}

type ChatMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'bot'; text: string; answer?: BotAnswer };

const GREETING: ChatMessage = {
  id: 'greeting',
  role: 'bot',
  text: 'Ask me about sales, people and guest feedback. I can now answer kitchen, stock and GP questions too, using live data from Edify.',
};

function matchAnswer(text: string): BotAnswer | undefined {
  const lower = text.toLowerCase();
  return BOT_ANSWERS.find((a) => a.question.toLowerCase() === lower) ??
    BOT_ANSWERS.find((a) => a.keywords.some((k) => lower.includes(k)));
}

function BotView() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, thinking]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const asked = new Set(
    messages.flatMap((m) => (m.role === 'bot' && m.answer ? [m.answer.id] : [])),
  );
  const suggestions = BOT_ANSWERS.filter((a) => !asked.has(a.id));

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    nextId.current += 1;
    const stamp = nextId.current;
    setMessages((prev) => [...prev, { id: `u-${stamp}`, role: 'user', text: trimmed }]);
    setDraft('');
    setThinking(true);
    timer.current = setTimeout(() => {
      const answer = matchAnswer(trimmed);
      setMessages((prev) => [
        ...prev,
        answer
          ? { id: `b-${stamp}`, role: 'bot', text: answer.answer, answer }
          : {
              id: `b-${stamp}`,
              role: 'bot',
              text: 'I can\'t answer that one in this demo. Try one of the questions below.',
            },
      ]);
      setThinking(false);
    }, 700);
  }

  return (
    <section className={styles.bot} aria-label="Bot">
      <div className={styles.groupHeader}>
        <h2 className={styles.groupHeading}>Bot</h2>
        <PoweredByEdify />
      </div>

      <div className={styles.chatCard}>
        <div className={styles.chatLog} aria-live="polite">
          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className={styles.msgUser}>
                {m.text}
              </div>
            ) : (
              <div key={m.id} className={styles.msgBot}>
                <span className={styles.botAvatar} aria-hidden="true">
                  <Dna size={16} />
                </span>
                <div className={styles.msgBotBody}>
                  <p>{m.text}</p>
                  {m.answer && (
                    <div className={styles.source}>
                      <span className={styles.sourceLabel}>
                        <EdifyMark size={12} />
                        From Edify: {m.answer.source}
                      </span>
                      <Link href={m.answer.href} className={styles.sourceLink}>
                        Open in Edify
                        <ArrowUpRight size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
          {thinking && (
            <div className={styles.msgBot}>
              <span className={styles.botAvatar} aria-hidden="true">
                <Dna size={16} />
              </span>
              <div className={styles.typing} aria-label="Bot is typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {suggestions.length > 0 && (
          <div className={styles.suggestions}>
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                className={styles.suggestion}
                onClick={() => ask(s.question)}
                disabled={thinking}
              >
                {s.question}
              </button>
            ))}
          </div>
        )}

        <form
          className={styles.composer}
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
        >
          <label htmlFor="bot-input" className={styles.srOnly}>
            Ask the Bot a question
          </label>
          <input
            id="bot-input"
            className={styles.composerInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about sales, people, stock or GP"
            autoComplete="off"
          />
          <button
            type="submit"
            className={styles.composerSend}
            disabled={!draft.trim() || thinking}
            aria-label="Send"
          >
            <Send size={16} aria-hidden="true" />
          </button>
        </form>
      </div>
    </section>
  );
}

const SETTINGS_ROWS = [
  { label: 'Locations', value: '8 pizzerias' },
  { label: 'Users', value: '46 people with access' },
  { label: 'Bot data sources', value: 'Sales, people, feedback, Edify' },
];

function SettingsView() {
  return (
    <section className={styles.group} aria-labelledby="settings-heading">
      <div className={styles.groupHeader}>
        <h2 id="settings-heading" className={styles.groupHeading}>
          Settings
        </h2>
      </div>
      <div className={styles.settingsCard}>
        {SETTINGS_ROWS.map((r) => (
          <div key={r.label} className={styles.settingsRow}>
            <span className={styles.settingsLabel}>{r.label}</span>
            <span className={styles.settingsValue}>{r.value}</span>
          </div>
        ))}
        <div className={styles.settingsRow}>
          <span className={styles.settingsLabel}>
            <span className={styles.integrationName}>
              <EdifyMark size={14} />
              Edify
            </span>
          </span>
          <span className={styles.connected}>
            <span className={styles.connectedDot} aria-hidden="true" />
            Connected
          </span>
        </div>
      </div>
    </section>
  );
}

function JoshuaPortal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const param = searchParams?.get('view') ?? '';
  const view: ViewId = VIEW_IDS.has(param) ? (param as ViewId) : 'operations';
  const [query, setQuery] = useState('');

  const groups = useMemo(
    () => (view === 'bot' || view === 'settings' ? [] : VIEW_GROUPS[view]),
    [view],
  );

  function go(id: ViewId) {
    setQuery('');
    router.replace(id === 'operations' ? pathname : `${pathname}?view=${id}`, { scroll: false });
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <Dna size={20} />
          </span>
          <span className={styles.brandName}>JOSHUA</span>
        </div>

        <nav aria-label="Main">
          <ul className={styles.nav}>
            {NAV.map((item) => {
              const active = item.id === view;
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => go(item.id)}
                  >
                    <span className={styles.navIcon} aria-hidden="true">
                      {Icon === 'edify' ? <EdifyMark size={16} /> : <Icon size={17} />}
                    </span>
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <button type="button" className={styles.signOut}>
          Sign Out
        </button>
      </aside>

      <main className={styles.main}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} aria-hidden="true" />
          <label htmlFor="portal-search" className={styles.srOnly}>
            Search reports
          </label>
          <input
            id="portal-search"
            type="search"
            className={styles.search}
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={view === 'bot' || view === 'settings'}
          />
        </div>

        <div className={styles.content}>
          {view === 'bot' && <BotView />}
          {view === 'settings' && <SettingsView />}
          {groups.length > 0 && <TileView groups={groups} query={query} onGo={go} />}
        </div>
      </main>
    </div>
  );
}

export default function PizzaPilgrimsPage() {
  return (
    <Suspense fallback={null}>
      <JoshuaPortal />
    </Suspense>
  );
}
