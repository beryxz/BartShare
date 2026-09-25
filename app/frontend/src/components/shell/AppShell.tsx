import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { SessionGate } from './SessionGate';

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <div className="mx-auto w-full max-w-6xl p-6">
                    <SessionGate>{children}</SessionGate>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
