import {
    Activity,
    BookOpen,
    Building2,
    FileText,
    Globe,
    Inbox,
    List,
    ScrollText,
    Send,
    Users,
    Wrench,
    type LucideIcon,
} from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** The sidebar is the primary interaction surface, so its shape is data. */
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
    {
        label: 'Resources',
        items: [
            { href: '/resources', label: 'My Resources', icon: FileText },
            { href: '/shared', label: 'Shared with me', icon: Inbox },
            { href: '/explore', label: 'Explore', icon: Globe },
        ],
    },
    {
        label: 'Access',
        items: [
            { href: '/policy', label: 'My Policy', icon: ScrollText },
            { href: '/request', label: 'Request builder', icon: Send },
        ],
    },
    {
        label: 'Network',
        items: [
            { href: '/connections', label: 'Connections', icon: Users },
            { href: '/groups', label: 'Groups', icon: Building2 },
        ],
    },
    {
        label: 'Developer',
        items: [
            { href: '/debug', label: 'Reset & seed', icon: Wrench },
            { href: '/debug/log', label: 'Event log', icon: List },
            { href: '/debug/status', label: 'Service status', icon: Activity },
            { href: '/debug/api', label: 'API docs', icon: BookOpen },
        ],
    },
];
