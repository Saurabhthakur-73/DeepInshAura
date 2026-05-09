"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavItem {
  title: string;
  href: string;
  icon?: React.ReactNode;
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard" },
  { title: "Documents", href: "/documents" },
  { title: "Upload", href: "/upload" },
  { title: "Reports", href: "/reports" },
  { title: "Settings", href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Page change hone pe mobile menu band karo
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 bg-gray-900 text-white p-2 rounded-md"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          // X icon
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          // Hamburger icon
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-800">
            <h1 className="text-xl font-bold">DeepInshAura</h1>
          </div>
          <nav className="flex-1 overflow-y-auto p-2">
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center px-4 py-2 rounded-md hover:bg-gray-800 ${
                      mounted && pathname === item.href
                        ? "bg-gray-800 text-white"
                        : "text-gray-400"
                    }`}
                  >
                    {item.icon}
                    <span className="ml-3">{item.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="p-4 border-t border-gray-800">
            <p className="text-sm text-gray-400">© DeepInshAura 2025</p>
          </div>
        </div>
      </aside>
    </>
  );
}