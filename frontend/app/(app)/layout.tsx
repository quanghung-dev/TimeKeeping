import { AuthGuard } from "@/features/auth/components/auth-guard";
import { MobileNavigation } from "@/components/layout/mobile-navigation";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard><div className="pb-20 sm:pb-0">{children}</div><MobileNavigation /></AuthGuard>;
}
