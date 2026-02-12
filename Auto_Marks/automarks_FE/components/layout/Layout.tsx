import { ReactNode } from 'react';
import { Navbar } from './Navbar';

interface LayoutProps {
    children: ReactNode;
    onSettingsClick: () => void;
    onNotificationClick: () => void;
}

export function Layout({ children, onSettingsClick, onNotificationClick }: LayoutProps) {
    return (
        <div className="min-h-screen bg-background text-foreground font-sans">
            <Navbar onSettingsClick={onSettingsClick} onNotificationClick={onNotificationClick} />
            <main className="container mx-auto p-4 md:p-8 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                {children}
            </main>
        </div>
    );
}
