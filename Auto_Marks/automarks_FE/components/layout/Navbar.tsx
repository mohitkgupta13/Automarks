import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    UploadCloud,
    FileSearch,
    UserCircle,
    BarChart3,
    Download,
    Bell,
    Search,
    Menu,
    X,
    Wrench
} from 'lucide-react';
import { ModeToggle } from '@/components/theme/mode-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
// We'll extract NotificationDropdown later, for now placeholder
// import { NotificationDropdown } from '../features/notifications/NotificationDropdown';

interface NavbarProps {
    onSettingsClick: () => void;
    onNotificationClick: () => void;
}

export function Navbar({ onSettingsClick, onNotificationClick }: NavbarProps) {
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/upload', icon: UploadCloud, label: 'Upload' },
        { to: '/results', icon: FileSearch, label: 'Results' },
        { to: '/profile', icon: UserCircle, label: 'Profile' },
        { to: '/analytics', icon: BarChart3, label: 'Analytics' },
        { to: '/export', icon: Download, label: 'Exports' },
    ];

    return (
        <nav className="sticky top-0 z-50 w-full border-b bg-surface/80 backdrop-blur-md">
            <div className="flex h-16 items-center px-4 md:px-8">
                {/* Logo */}
                <div className="flex items-center gap-2 mr-8">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20">
                        V
                    </div>
                    <span className="text-lg font-bold tracking-tight hidden md:inline-block">
                        VTU <span className="text-primary">Insight</span>
                    </span>
                </div>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.to;
                        return (
                            <Link
                                key={item.to}
                                to={item.to}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon size={18} />
                                {item.label}
                            </Link>
                        );
                    })}
                </div>

                {/* Spacer */}
                <div className="flex-1"></div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 md:gap-4">
                    <div className="relative hidden md:block w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            type="search"
                            placeholder="Search..."
                            className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    <Button variant="ghost" size="icon" className="relative" onClick={onNotificationClick}>
                        <Bell size={20} />
                        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 border border-background" />
                    </Button>

                    <ModeToggle />

                    <Button variant="ghost" size="icon" onClick={onSettingsClick} title="Configure">
                        <Wrench size={20} />
                    </Button>

                    <Button variant="ghost" size="icon" onClick={onSettingsClick} title="Settings">
                        <span className="sr-only">Settings</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
                    </Button>

                    <img
                        src="/student-avatar.svg"
                        alt="Avatar"
                        className="h-8 w-8 rounded-full border bg-background object-cover"
                    />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </Button>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden border-t p-4 space-y-2 bg-background">
                    {navItems.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors",
                                location.pathname === item.to
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted"
                            )}
                        >
                            <item.icon size={18} />
                            {item.label}
                        </Link>
                    ))}
                </div>
            )}
        </nav>
    );
}
