import { SidebarTrigger } from '@/components/ui/sidebar';

export function PageHeader({
    title,
    description,
    actions,
}: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
}) {
    return (
        <div className="mb-6 flex items-start gap-3 border-b pb-4">
            <SidebarTrigger className="mt-0.5 md:hidden" />
            <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold tracking-tight">
                    {title}
                </h1>
                {description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {actions && (
                <div className="flex items-center gap-2">{actions}</div>
            )}
        </div>
    );
}
