import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'BartShare',
    description:
        'A resource-sharing platform where access to every resource is decided live by each party’s Bart policy.',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="h-full" suppressHydrationWarning>
            <body
                className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col antialiased`}
            >
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
