import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavServers } from '@/components/nav-servers';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
} from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import type { Server as ServerType } from '@/types/entities';
import { Link, usePage } from '@inertiajs/react';
import { BookOpen, Folder, LayoutGrid, Server, Shield, Users } from 'lucide-react';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutGrid,
    },
];

const adminNavItems: NavItem[] = [
    {
        title: 'Users',
        href: '/admin/users',
        icon: Users,
    },
    {
        title: 'Roles',
        href: '/admin/roles',
        icon: Shield,
    },
    {
        title: 'Servers',
        href: '/admin/servers',
        icon: Server,
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Repository',
        href: 'https://github.com/Tech-Arch1tect/berth',
        icon: Folder,
    },
    {
        title: 'Documentation',
        href: 'https://github.com/Tech-Arch1tect/berth/blob/main/README.md',
        icon: BookOpen,
    },
];

export function AppSidebar() {
    const { auth, servers } = usePage().props as unknown as {
        auth: { user: { roles: { name: string }[] } };
        servers?: ServerType[];
    };
    const user = auth?.user;
    const isAdmin = user?.roles?.some((role) => role.name === 'admin');

    return (
        <Sidebar collapsible="icon" variant="inset" className="overflow-x-hidden border-r">
            <SidebarHeader className="border-b border-sidebar-border/50">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild className="hover:bg-sidebar-accent">
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="overflow-x-hidden py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <NavMain items={mainNavItems} />

                {/* Servers Section */}
                {servers && servers.length > 0 && (
                    <>
                        <SidebarSeparator className="my-2" />
                        <div className="overflow-hidden px-3 py-2">
                            <p className="truncate text-xs font-semibold tracking-wider text-sidebar-foreground/70 uppercase">Servers</p>
                        </div>
                        <NavServers servers={servers} />
                    </>
                )}

                {/* Admin Section */}
                {isAdmin && (
                    <>
                        <SidebarSeparator className="my-2" />
                        <div className="overflow-hidden px-3 py-2">
                            <p className="truncate text-xs font-semibold tracking-wider text-sidebar-foreground/70 uppercase">Administration</p>
                        </div>
                        <NavMain items={adminNavItems} />
                    </>
                )}
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border/50 p-2">
                <NavUser />
                <SidebarSeparator className="my-2" />
                <NavFooter items={footerNavItems} />
            </SidebarFooter>
        </Sidebar>
    );
}
