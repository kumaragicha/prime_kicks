'use client';

import { Icon } from '@/components/icon';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type User = { name: string; email: string };

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('prime-kicks-user');
    if (saved) setUser(JSON.parse(saved) as User);
    setHydrated(true);
  }, []);

  function signOut() {
    window.localStorage.removeItem('prime-kicks-user');
    window.localStorage.removeItem('prime-kicks-access-token');
    window.localStorage.removeItem('prime-kicks-refresh-token');
    window.location.assign('/');
  }

  if (!hydrated)
    return (
      <main className="min-h-screen py-[33px] px-[7vw] grid content-center gap-[25px] max-[700px]:py-[25px] max-[700px]:px-[22px] place-items-center uppercase font-bold tracking-[.12em] text-[10px]">
        <i className="w-[15px] h-[15px] border-2 border-[#ccc] border-t-[#111] rounded-full animate-[spin_0.8s_linear_infinite]" />
        <span>Loading your profile</span>
      </main>
    );
  if (!user)
    return (
      <main className="min-h-screen py-[33px] px-[7vw] grid content-center justify-items-start gap-[25px] max-[700px]:py-[25px] max-[700px]:px-[22px]">
        <Link
          className="font-[900] tracking-[-.09em] text-ink no-underline text-[21px] max-[800px]:text-[19px] [transform:skew(-9deg)] absolute top-[28px] max-[700px]:top-[25px]"
          href="/"
        >
          PRIME<span className="font-normal ml-[3px]">KICKS</span>
        </Link>
        <h1 className="text-[clamp(38px,6vw,72px)] max-w-[600px] tracking-[-.08em] leading-[.9] m-0">
          Sign in to view your profile.
        </h1>
        <Link
          className="inline-flex items-center gap-[19px] px-[15px] py-[13px] bg-ink text-white no-underline text-[10px] uppercase font-bold tracking-[.07em] [&_svg]:w-[15px]"
          href="/"
        >
          Back to shop <Icon name="arrow" />
        </Link>
      </main>
    );

  const initial = user.name.trim().slice(0, 1).toUpperCase();
  return (
    <main className="min-h-screen bg-paper">
      <header className="h-[74px] px-[5.25vw] flex items-center justify-between border-b border-line max-[700px]:h-[63px] max-[700px]:px-[15px]">
        <Link
          className="font-[900] tracking-[-.09em] text-ink no-underline text-[21px] max-[800px]:text-[19px] [transform:skew(-9deg)]"
          href="/"
        >
          PRIME<span className="font-normal ml-[3px]">KICKS</span>
        </Link>
        <Link
          className="text-ink text-[10px] uppercase tracking-[.08em] font-bold no-underline max-[700px]:text-[9px]"
          href="/"
        >
          ← Continue shopping
        </Link>
      </header>
      <section className="pt-[67px] px-[12vw] pb-[58px] bg-[#111] text-white flex gap-[24px] items-center max-[700px]:py-[43px] max-[700px]:px-[21px] max-[700px]:gap-[15px]">
        <div className="w-[76px] h-[76px] rounded-full grid place-items-center bg-accent text-[#111] text-[31px] font-bold max-[700px]:w-[55px] max-[700px]:h-[55px] max-[700px]:text-[23px]">
          {initial}
        </div>
        <div>
          <p className="text-[10px] tracking-[.16em] uppercase font-bold text-accent m-0 mb-[9px]">
            My account
          </p>
          <h1 className="m-0 text-[clamp(42px,5vw,70px)] leading-[.9] tracking-[-.08em] max-[700px]:text-[42px]">
            Hi, {user.name.split(' ')[0]}.
          </h1>
          <p className="mt-[11px] text-[#aaa] text-[13px]">{user.email}</p>
        </div>
      </section>
      <section className="max-w-[1120px] mx-auto pt-[55px] px-[28px] pb-[100px] grid grid-cols-[190px_1fr] gap-[70px] max-[700px]:pt-[30px] max-[700px]:px-[15px] max-[700px]:pb-[55px] max-[700px]:block">
        <nav
          className="grid content-start gap-[4px] max-[700px]:flex max-[700px]:overflow-auto max-[700px]:gap-[18px] max-[700px]:mb-[24px]"
          aria-label="Profile navigation"
        >
          <a
            className="border-0 bg-transparent text-ink text-left py-[12px] text-[11px] font-bold uppercase tracking-[.07em] no-underline border-b border-ink max-[700px]:whitespace-nowrap max-[700px]:py-[9px]"
            href="#overview"
          >
            Overview
          </a>
          <a
            className="border-0 bg-transparent text-[#666] text-left py-[12px] text-[11px] font-bold uppercase tracking-[.07em] no-underline border-b border-b-transparent max-[700px]:whitespace-nowrap max-[700px]:py-[9px]"
            href="#orders"
          >
            Orders{' '}
            <span className="float-right bg-[#ddd] px-[5px] py-[1px] text-[#555] text-[9px]">
              0
            </span>
          </a>
          <a
            className="border-0 bg-transparent text-[#666] text-left py-[12px] text-[11px] font-bold uppercase tracking-[.07em] no-underline border-b border-b-transparent max-[700px]:whitespace-nowrap max-[700px]:py-[9px]"
            href="#settings"
          >
            Account settings
          </a>
          <button
            className="border-0 bg-transparent text-left py-[12px] text-[11px] font-bold uppercase tracking-[.07em] no-underline border-b border-b-transparent text-[#b22b2b] mt-[17px] max-[700px]:whitespace-nowrap max-[700px]:py-[9px] max-[700px]:mt-0"
            onClick={signOut}
          >
            Sign out
          </button>
        </nav>
        <div className="grid gap-[21px]">
          <section
            id="overview"
            className="border border-line bg-white p-[30px] max-[700px]:py-[22px] max-[700px]:px-[18px]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] tracking-[.16em] uppercase font-bold m-0 mb-[11px]">
                  Account overview
                </p>
                <h2 className="text-[28px] leading-[.95] tracking-[-.06em] m-0 max-[700px]:text-[25px]">
                  Your details
                </h2>
              </div>
              <button className="border border-ink bg-transparent text-[9px] uppercase tracking-[.08em] font-bold px-[11px] py-[8px]">
                Edit
              </button>
            </div>
            <dl className="grid grid-cols-3 gap-[18px] border-t border-line mt-[29px] pt-[23px] max-[700px]:grid-cols-1 max-[700px]:gap-[17px]">
              <div>
                <dt className="text-[9px] uppercase font-bold tracking-[.08em] text-[#777] mb-[7px]">
                  Full name
                </dt>
                <dd className="m-0 text-[13px]">{user.name}</dd>
              </div>
              <div>
                <dt className="text-[9px] uppercase font-bold tracking-[.08em] text-[#777] mb-[7px]">
                  Email address
                </dt>
                <dd className="m-0 text-[13px]">{user.email}</dd>
              </div>
              <div>
                <dt className="text-[9px] uppercase font-bold tracking-[.08em] text-[#777] mb-[7px]">
                  Member since
                </dt>
                <dd className="m-0 text-[13px]">July 2026</dd>
              </div>
            </dl>
          </section>
          <section
            id="orders"
            className="border border-line bg-[#e9e8e3] p-[30px] max-[700px]:py-[22px] max-[700px]:px-[18px]"
          >
            <p className="text-[10px] tracking-[.16em] uppercase font-bold m-0 mb-[11px]">
              Order history
            </p>
            <h2 className="text-[28px] leading-[.95] tracking-[-.06em] m-0 max-[700px]:text-[25px]">
              Your next pair is waiting.
            </h2>
            <p className="text-[13px] text-[#666] max-w-[420px] leading-[1.5] mt-[13px] mb-[23px]">
              When you place an order, its shipping updates and details will appear here.
            </p>
            <Link
              className="inline-flex items-center gap-[19px] px-[15px] py-[13px] bg-ink text-white no-underline text-[10px] uppercase font-bold tracking-[.07em] [&_svg]:w-[15px]"
              href="/"
            >
              Explore new arrivals <Icon name="arrow" />
            </Link>
          </section>
        </div>
      </section>
    </main>
  );
}
