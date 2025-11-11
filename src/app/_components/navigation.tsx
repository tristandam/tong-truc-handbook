'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Overview' },
    { href: '/awards', label: 'Awards' },
    { href: '/participants', label: 'Participants' },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-900">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1">
          <h1 className="text-lg font-semibold text-white">
            Tong Truc Handbook
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/' && pathname?.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-white text-slate-900"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

