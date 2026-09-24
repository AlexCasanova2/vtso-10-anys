import type { Metadata } from "next";
import "./globals.css";
import "./event.css";
import "./register.css";
import "./admin.css";

export const metadata: Metadata = {
  title: "10 anys · 10.000 € | The Style Outlets",
  description: "Sorteig del 10è aniversari de Viladecans The Style Outlets",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ca" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
