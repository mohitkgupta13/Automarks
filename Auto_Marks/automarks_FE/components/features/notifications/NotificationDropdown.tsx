import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, BarChart3, Clock, X } from 'lucide-react';
import { endpoints, getApiBase } from '@/api/client';
import { Button } from '@/components/ui/button';

export type UiNotification = { id: number; title: string; detail?: string | null; level: string; created_at?: string | null };

interface NotificationDropdownProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NotificationDropdown = ({ isOpen, onClose }: NotificationDropdownProps) => {
    const [notifications, setNotifications] = useState<UiNotification[]>([]);
    const [loading, setLoading] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);

    const formatAgo = (iso?: string | null) => {
        if (!iso) return '';
        const ts = new Date(iso).getTime();
        if (!Number.isFinite(ts)) return '';
        const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
        if (diffSec < 60) return `${diffSec}s ago`;
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        const diffDay = Math.floor(diffHr / 24);
        return `${diffDay}d ago`;
    };

    const mapLevel = (level: string) => {
        const l = (level || '').toLowerCase();
        if (l === 'success') return { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' };
        if (l === 'warning') return { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50' };
        if (l === 'error') return { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10' };
        return { icon: BarChart3, color: 'text-primary', bg: 'bg-primary/10' };
    };

    useEffect(() => {
        if (!isOpen) return;

        let cancelled = false;
        setLoading(true);
        endpoints
            .getNotifications(50)
            .then((res) => {
                if (!cancelled) setNotifications(res || []);
            })
            .catch(() => {
                if (!cancelled) setNotifications([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        const wsUrl = getApiBase().replace('http', 'ws') + '/ws/notifications';
        const ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg?.type === 'notification' && msg?.data?.id) {
                    setNotifications((prev) => {
                        const next = [msg.data as UiNotification, ...prev.filter((n) => n.id !== msg.data.id)];
                        return next.slice(0, 50);
                    });
                }
                if (msg?.type === 'notification_cleared' && msg?.id) {
                    setNotifications((prev) => prev.filter((n) => n.id !== Number(msg.id)));
                }
            } catch {
                // ignore bad frames
            }
        };
        wsRef.current = ws;

        return () => {
            cancelled = true;
            try {
                ws.close();
            } catch {
                // ignore
            }
            wsRef.current = null;
        };
    }, [isOpen]);

    const handleClearAll = async () => {
        try {
            await endpoints.clearNotifications();
            setNotifications([]);
        } catch (e) {
            console.error('Failed to clear notifications', e);
        }
    };

    const handleDismissOne = async (id: number) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        try {
            await endpoints.clearNotification(id);
        } catch (e) {
            try {
                const res = await endpoints.getNotifications(50);
                setNotifications(res || []);
            } catch {
                // ignore
            }
            console.error('Failed to clear notification', e);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[60]" onClick={onClose} />
            <div className="absolute top-16 right-4 w-[calc(100vw-2rem)] sm:w-80 bg-background rounded-xl shadow-2xl border border-border z-[70] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
                    <h4 className="font-semibold text-foreground">Notifications</h4>
                    {notifications.length > 0 && (
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase tracking-widest">
                            {notifications.length} New
                        </span>
                    )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                    {loading ? (
                        <div className="p-6 text-sm text-muted-foreground font-medium text-center">Loading…</div>
                    ) : notifications.length === 0 ? (
                        <div className="p-6 text-sm text-muted-foreground font-medium text-center">No notifications</div>
                    ) : (
                        notifications.map((n) => {
                            const m = mapLevel(n.level);
                            const Icon = m.icon;
                            return (
                                <div key={n.id} className="p-4 hover:bg-muted/50 transition-colors flex gap-4 border-b border-border last:border-0 cursor-pointer">
                                    <div className={`shrink-0 w-10 h-10 rounded-full ${m.bg} flex items-center justify-center ${m.color}`}>
                                        <Icon size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-foreground leading-tight">{n.title}</p>
                                        {n.detail ? <p className="text-xs text-muted-foreground mt-1 leading-snug">{n.detail}</p> : null}
                                        <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                                            <Clock size={10} /> {formatAgo(n.created_at)}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleDismissOne(n.id);
                                        }}
                                    >
                                        <X size={14} />
                                    </Button>
                                </div>
                            );
                        })
                    )}
                </div>
                <div className="p-3 bg-muted/50 border-t border-border">
                    <Button
                        variant="ghost"
                        onClick={handleClearAll}
                        className="w-full h-8 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary"
                    >
                        Clear all
                    </Button>
                </div>
            </div>
        </>
    );
};
