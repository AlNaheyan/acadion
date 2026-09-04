"use client"

import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

import Logo from "../public/acadion_icon1.png"

const links = [
  { href: "/checkCourse", label: "Plan" },
  { href: "/Catalog", label: "Courses" },
  { href: "/course-homeground", label: "Syllabus" },
  { href: "/profile", label: "Profile" },
]

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function Nav() {
  const pathname = usePathname()

  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav
        aria-label="Primary navigation"
        className="flex w-fit max-w-full items-center gap-1 rounded-full border border-neutral-200/80 bg-white/80 p-1.5 pl-4 shadow-lg shadow-neutral-900/5 backdrop-blur-md"
      >
        <Link href="/" aria-label="Acadion home" className="flex shrink-0 items-center pr-2">
          <Image
            src={Logo}
            alt="Acadion"
            width={94}
            height={25}
            priority
            className="h-auto w-[82px] sm:w-[94px]"
          />
        </Link>

        <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-neutral-200 md:block" />

        <div className="hidden items-center gap-0.5 text-sm md:flex">
          {links.map((link) => {
            const active = isActiveRoute(pathname, link.href)

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-full bg-neutral-100 px-3.5 py-1.5 font-medium text-neutral-900"
                    : "rounded-full px-3.5 py-1.5 font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                }
              >
                {link.label}
              </Link>
            )
          })}
        </div>

        <SignedOut>
          <SignInButton mode="modal">
            <button
              type="button"
              className="ml-1 shrink-0 rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
            >
              Sign in
            </button>
          </SignInButton>
        </SignedOut>

        <SignedIn>
          <div className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-900 ring-1 ring-neutral-900">
            <UserButton
              userProfileUrl="/profile"
              appearance={{
                elements: {
                  avatarBox: "h-7 w-7",
                  userButtonTrigger: "rounded-full focus:shadow-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2",
                },
              }}
            />
          </div>
        </SignedIn>
      </nav>
    </header>
  )
}
