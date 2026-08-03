'use client';

import { SiteHeader } from '@/components/site-header';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';

type User = { name: string; email: string; mobileNo?: string; city?: string; state?: string };

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!window.localStorage.getItem('prime-kicks-access-token')) {
      setHydrated(true);
      return;
    }
    // Profile details come from the API, not a cached localStorage copy.
    api
      .me()
      .then((me) => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setHydrated(true));
  }, []);

  function signOut() {
    window.localStorage.removeItem('prime-kicks-access-token');
    window.localStorage.removeItem('prime-kicks-refresh-token');
    window.location.assign('/');
  }

  if (!hydrated)
    return (
      <>
        <SiteHeader />
        <main className="min-h-[80vh] grid place-items-center">
          <i className="w-[18px] h-[18px] border-2 border-[#ccc] border-t-[#111] rounded-full animate-[spin_0.8s_linear_infinite]" />
        </main>
      </>
    );

  if (!user)
    return (
      <>
        <SiteHeader />
        <main className="min-h-[80vh] grid place-items-center text-center px-[7vw]">
          <h1 className="text-[clamp(32px,5vw,56px)] tracking-[-.06em] leading-[.95] m-0">
            Sign in to view your profile.
          </h1>
        </main>
      </>
    );

  const initial = user.name.trim().slice(0, 1).toUpperCase();

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-paper">
        {/* Profile Hero */}
        <section className="pt-[56px] px-[5.25vw] pb-[48px] bg-[#111] text-white max-[700px]:py-[36px] max-[700px]:px-[15px]">
          <div className="max-w-[820px] mx-auto flex items-center gap-[20px] max-[700px]:gap-[14px]">
            <div className="w-[68px] h-[68px] rounded-full grid place-items-center bg-accent text-[#111] text-[28px] font-bold max-[700px]:w-[52px] max-[700px]:h-[52px] max-[700px]:text-[22px]">
              {initial}
            </div>
            <div>
              <p className="text-[10px] tracking-[.16em] uppercase font-bold text-accent m-0 mb-[4px]">
                My account
              </p>
              <h1 className="m-0 text-[clamp(30px,4vw,52px)] leading-[.9] tracking-[-.06em]">
                Hi, {user.name.split(' ')[0]}.
              </h1>
              <p className="mt-[6px] text-[#999] text-[13px] m-0">{user.email}</p>
            </div>
          </div>
        </section>

        {/* Main content */}
        <div className="max-w-[820px] mx-auto pt-[36px] px-[5.25vw] pb-[100px] max-[700px]:px-[15px]">
          {/* User details — all visible */}
          <section className="border border-line bg-white p-[28px] rounded-lg max-[700px]:p-[20px]">
            <p className="text-[10px] tracking-[.16em] uppercase font-bold m-0 mb-[16px] text-[#777]">
              Account details
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-[32px] gap-y-[16px]">
              <div>
                <dt className="text-[9px] uppercase font-bold tracking-[.08em] text-[#777] mb-[4px]">
                  Full name
                </dt>
                <dd className="m-0 text-[14px]">{user.name}</dd>
              </div>
              <div>
                <dt className="text-[9px] uppercase font-bold tracking-[.08em] text-[#777] mb-[4px]">
                  Email
                </dt>
                <dd className="m-0 text-[14px]">{user.email}</dd>
              </div>
              {user.mobileNo && (
                <div>
                  <dt className="text-[9px] uppercase font-bold tracking-[.08em] text-[#777] mb-[4px]">
                    Mobile
                  </dt>
                  <dd className="m-0 text-[14px]">{user.mobileNo}</dd>
                </div>
              )}
              {user.city && (
                <div>
                  <dt className="text-[9px] uppercase font-bold tracking-[.08em] text-[#777] mb-[4px]">
                    City
                  </dt>
                  <dd className="m-0 text-[14px]">{user.city}</dd>
                </div>
              )}
              {user.state && (
                <div>
                  <dt className="text-[9px] uppercase font-bold tracking-[.08em] text-[#777] mb-[4px]">
                    State
                  </dt>
                  <dd className="m-0 text-[14px]">{user.state}</dd>
                </div>
              )}
              <div>
                <dt className="text-[9px] uppercase font-bold tracking-[.08em] text-[#777] mb-[4px]">
                  Member since
                </dt>
                <dd className="m-0 text-[14px]">July 2026</dd>
              </div>
            </dl>
          </section>

          {/* Sign out at bottom */}
          <button
            className="mt-[40px] w-full text-center px-[14px] py-[12px] text-[11px] font-bold uppercase tracking-[.1em] rounded-md text-[#b22b2b] hover:bg-red-50 transition-colors border border-red-200"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </main>
    </>
  );
}
