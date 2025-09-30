import React, { useEffect, useState } from 'react';
import { Megaphone, ChevronDown, ChevronUp } from 'lucide-react';
import type { UpdateItem } from '@/common/types/update';
import { fetchLatestUpdates } from '@/common/services/updatesApi';
import { useNavigate } from 'react-router-dom';

interface SiteUpdatesProps {
  updates?: UpdateItem[]; // optional preloaded
  showViewAllLink?: boolean;
}

export const SiteUpdates: React.FC<SiteUpdatesProps> = ({ updates, showViewAllLink = true }) => {
  const [items, setItems] = useState<UpdateItem[]>(updates || []);
  const [loading, setLoading] = useState<boolean>(!updates);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    if (!updates) {
      (async () => {
        try {
          setLoading(true);
          const data = await fetchLatestUpdates();
          if (mounted) setItems(data);
        } catch (e) {
          // fail silently for now; could add toast later
        } finally {
          if (mounted) setLoading(false);
        }
      })();
    }
    return () => {
      mounted = false;
    };
  }, [updates]);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Updates</h3>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-muted rounded-sm transition-colors"
            aria-label={isCollapsed ? "Expand updates" : "Collapse updates"}
          >
            {isCollapsed ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        </div>
        {showViewAllLink && (
          <button
            className="text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/updates')}
          >
            View all
          </button>
        )}
      </div>

      {!isCollapsed && (
        <>
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse p-3 rounded border border-border/40 bg-card/40">
                  <div className="h-3 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-2 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((u) => (
                <div
                  key={u.id}
                  className="p-3 rounded border border-border/40 bg-card/40 hover:bg-card/60 transition-colors cursor-pointer hover-raise"
                  onClick={() => navigate(`/updates/${encodeURIComponent(u.id)}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{u.title}</p>
                      {u.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{u.description}</p>
                      )}
                    </div>
                    {u.tag && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground whitespace-nowrap">{u.tag}</span>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(u.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-center py-6 border border-dashed border-border/60 rounded-lg bg-muted/20">
                  <p className="text-xs text-muted-foreground">No updates yet</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SiteUpdates;
