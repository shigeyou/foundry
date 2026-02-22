// Root layout - delegates to [locale]/layout.tsx for i18n support
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
