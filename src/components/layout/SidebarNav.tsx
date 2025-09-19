"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import Image from "next/image"
import Cookies from "js-cookie"
import { Separator } from "@/components/ui/separator"
import { cn, formatLocationName } from "@/lib/utils"
import { supabase } from "@/lib/supabase/client"
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  ChevronDown,
  ChevronUp,
  UserCircle, // Placeholder for user avatar
  LogOut,
} from "lucide-react"

interface Location {
  id: string
  name: string
}

const baseNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Employees", href: "/employees", icon: Users },
]

export function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [locations, setLocations] = useState<Array<{ name: string; href: string }>>([])
  const [isLoadingLocations, setIsLoadingLocations] = useState(true)
  const [userName, setUserName] = useState<string | null>(null)
  const [isLoadingUser, setIsLoadingUser] = useState(true)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    Cookies.remove("last-activity", { path: "/" })
    router.push("/login")
  }

  useEffect(() => {
    // Set schedule open state based on initial path
    if (pathname.startsWith("/schedule")) {
      setIsScheduleOpen(true);
    }

    const fetchLocations = async () => {
      setIsLoadingLocations(true)
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")

      if (error) {
        console.error("Error fetching locations:", error)
        setLocations([]) // Set to empty array on error
      } else if (data) {
        const formattedLocations = data.map((loc: Location) => ({
          name: formatLocationName(loc.name),
          href: `/schedule/${loc.name}`,
        }))
        setLocations(formattedLocations)
      }
      setIsLoadingLocations(false)
    }
    fetchLocations();
  }, [pathname]) // Keep pathname for location fetching and schedule open state

  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoadingUser(true)
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        console.error("Error fetching user or no user logged in:", authError)
        setUserName("User") // Default or placeholder
        setIsLoadingUser(false)
        return
      }

      // Now fetch from 'workers' table using the user.id
      console.log("[SidebarNav] Attempting to fetch worker details for user.id:", user.id);
      const { data: workerData, error: workerError } = await supabase
        .from("workers")
        .select("preferred_name, first_name, last_name")
        .eq("user_id", user.id) // Assuming the 'id' in 'workers' table is the auth user id
        .single()

      console.log("[SidebarNav] Worker data:", workerData);
      console.log("[SidebarNav] Worker error:", workerError);

      if (workerError) {
        console.error("Error fetching worker details:", workerError)
        setUserName(user.email || "User") // Fallback to email or generic User
      } else if (workerData) {
        setUserName((workerData as any)?.preferred_name || (workerData as any)?.first_name || "User")
      } else {
        console.log("[SidebarNav] No workerData found, falling back to email/User for user.id:", user.id);
        setUserName(user.email || "User") // Fallback if no worker record found
      }
      setIsLoadingUser(false)
    }
    fetchUserData()
  }, []) // Empty dependency array means this runs once on mount

  return (
    <div className="flex h-screen lg:w-60 xl:w-64 2xl:w-80 flex-col border-r bg-white p-8">
      <div className="mb-8 flex items-center space-x-0 px-1 mt-24 2xl:mt-20"> 
        <div className="rounded-sm shadow-sm hidden 2xl:block">
          <Image
          src="/rose_logo.png"
          alt="Rosette & Co. Logo"
          width={64}
          height={64}
          className="h-16 w-16"
          />
        </div>
        <h1 className="text-lg 2xl:text-xl font-semibold text-charcoalcocoa px-4">Rosette & Co.</h1> 
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-4 mt-2"> 
        {baseNavigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href && item.href !== "/" && pathname.startsWith(item.href)); // Adjusted to handle root and other paths

          const linkClasses = cn(
            "group flex items-center rounded-xl px-4 py-3 gap-1 lg:text-xs 2xl:text-sm font-semibold transition-all duration-200",
            isActive
              ? "bg-roseblush/80 text-charcoalcocoa my-nav-shadow"
              : "text-charcoalcocoa hover:bg-lavendercream"
          );

          const iconClasses = cn(
            "mr-3 w-4 h-4 2xl:h-5 2xl:w-5 flex-shrink-0",
            isActive
              ? "text-charcoalcocoa"
              : "text-charcoalcocoa group-hover:text-charcoalcocoa"
          );

          return (
            <Link
              key={item.name}
              href={item.href!}
              className={linkClasses}
            >
              <item.icon
                className={iconClasses}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}

        {/* Schedule Dropdown */}
        <div>
          <button
            onClick={() => setIsScheduleOpen(!isScheduleOpen)}
            disabled={isLoadingLocations} // Disable button while loading
            className={cn(
              "group flex w-full items-center rounded-xl px-4 py-3 gap-1 text-left lg:text-xs 2xl:text-sm font-semibold transition-all duration-200", 
              pathname.startsWith("/schedule")
                ? "bg-roseblush/80 text-charcoalcocoa my-nav-shadow"
                : "text-charcoalcocoa hover:bg-lavendercream transition-colors duration-200",
              isLoadingLocations && "cursor-not-allowed opacity-50"
            )}
          >
            <CalendarDays
              className={cn(
                "mr-3 h-4 w-4 2xl:h-5 2xl:w-5 flex-shrink-0",
                pathname.startsWith("/schedule")
                  ? "text-charcoalcocoa"
                  : "text-charcoalcocoa group-hover:text-charcoalcocoa"
              )}
              aria-hidden="true"
            />
            Schedule
            {isLoadingLocations ? (
              <span className="ml-auto text-xs italic">Loading...</span>
            ) : isScheduleOpen ? (
              <ChevronUp className="ml-auto h-4 w-4" /> // Adjusted icon size
            ) : (
              <ChevronDown className="ml-auto h-4 w-4" /> // Adjusted icon size
            )}
          </button>
          {!isLoadingLocations && isScheduleOpen && (
            <div className="mt-2 space-y-1 pl-10"> {/* Adjusted padding */}
              {locations.length > 0 ? (
                locations.map((loc) => (
                  <Link
                    key={loc.name}
                    href={loc.href}
                    className={cn(
                      "group flex items-center rounded-md px-3 py-2 lg:text-xs 2xl:text-sm font-medium", 
                      pathname === loc.href
                        ? "text-[#A597CE] font-semibold" 
                        : "text-charcoalcocoa hover:bg-lavendercream"
                    )}
                  >
                    {loc.name}
                  </Link>
                ))
              ) : (
                <span className="block px-3 py-1.5 text-xs text-charcoalcocoa">
                  No locations found.
                </span>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* User Info Footer */}
      <div className="mt-auto">
        <Separator className="my-2 bg-verylightbeige" />
        <div className="flex items-center space-x-2 pt-6 pl-1">
          <UserCircle className="w-7 h-7 2xl:h-9 2xl:w-9 rounded-full text-lavendercream" />
          <div>
            {isLoadingUser ? (
              <p className="text-xs font-semibold text-charcoalcocoa">Loading...</p>
            ) : (
              <>
                <p className="text-xs font-semibold text-charcoalcocoa">{userName}</p>
                <p className="text-[11px] text-charcoalcocoa">Regional Manager</p> 
              </>
            )}
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={handleLogout}
            className="group flex w-full items-center rounded-xl px-3 py-2.5 text-left text-xs 2xl:text-sm font-semibold text-charcoalcocoa/60 transition-colors hover:bg-roseblush/20 hover:text-charcoalcocoa"
          >
            <LogOut className="mr-3 h-4 w-4 2xl:h-5 2xl:w-5 flex-shrink-0" />
            <p className="pl-1">Logout</p>
          </button>
        </div>
      </div>
    </div>
  )
} 