'use client';

import { useEffect, useState } from 'react';
import type { PointerEvent } from 'react';
import MaterialIcon from '@/components/MaterialIcon';
import { Github } from 'lucide-react';

type GithubStarPillProps = {
  className?: string;
};

function formatCount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(value);
}

export default function GithubStarPill({ className = '' }: GithubStarPillProps) {
  const [count, setCount] = useState<string>('—');

  const handlePointerMove = (event: PointerEvent<HTMLAnchorElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    event.currentTarget.style.setProperty('--beam-x', `${(x * 100).toFixed(2)}%`);
    event.currentTarget.style.setProperty('--beam-y', `${(y * 100).toFixed(2)}%`);
  };

  const handlePointerLeave = (event: PointerEvent<HTMLAnchorElement>) => {
    event.currentTarget.style.setProperty('--beam-x', '50%');
    event.currentTarget.style.setProperty('--beam-y', '50%');
  };

  useEffect(() => {
    let isMounted = true;

    fetch('https://api.github.com/repos/figranium/figranium')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.stargazers_count) {
          return;
        }
        setCount(formatCount(Number(data.stargazers_count)));
      })
      .catch(() => {
        if (isMounted) {
          setCount('—');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <a
      href="https://github.com/figranium/figranium"
      target="_blank"
      rel="noreferrer"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`gh-pill beam-follow inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.25em] text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white ${className}`}
      aria-label="Star Figranium on GitHub"
    >
      <Github className="h-4 w-4" aria-hidden="true" />
      GitHub
      <span className="mx-1 h-3 w-px bg-white/20" aria-hidden="true" />
      <MaterialIcon name="star" className="text-base" fill />
      {count}
    </a>
  );
}
