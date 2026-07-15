import Link from "next/link";
import { ArrowRight, CalendarCheck2, Clock3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const benefits = [
  { icon: Clock3, title: "Chấm công linh hoạt", text: "Nhiều phiên làm việc, nghỉ giữa giờ và theo dõi thời gian chính xác." },
  { icon: CalendarCheck2, title: "Lịch làm việc rõ ràng", text: "Quản lý ca, ngày nghỉ và kế hoạch cá nhân trong một nơi." },
  { icon: ShieldCheck, title: "Dữ liệu riêng tư", text: "Mỗi tài khoản chỉ truy cập dữ liệu của chính mình qua API bảo mật." },
];

export default function HomePage() {
  return (
    <main className="relative flex min-h-svh flex-1 overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_42%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-5 py-8 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Clock3 className="size-5" aria-hidden="true" />
            </span>
            TimeKeeping
          </Link>
          <Button asChild variant="ghost"><Link href="/login">Đăng nhập</Link></Button>
        </header>

        <section className="flex flex-1 flex-col justify-center py-20 lg:py-28">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-medium text-primary">Thời gian của bạn, theo cách của bạn</p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              Chấm công cá nhân nhẹ nhàng như dùng một ứng dụng điện thoại.
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">
              Theo dõi giờ làm, ca nghỉ, lịch biểu và năng suất mà không cần bảng tính rối rắm.
              Giao diện mobile-first, sáng tối linh hoạt và sẵn sàng cho PWA.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register">Bắt đầu miễn phí <ArrowRight className="size-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline"><Link href="/login">Tôi đã có tài khoản</Link></Button>
            </div>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            {benefits.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border bg-card/80 p-5 shadow-sm backdrop-blur-sm">
                <Icon className="size-5 text-primary" aria-hidden="true" />
                <h2 className="mt-4 font-medium">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
