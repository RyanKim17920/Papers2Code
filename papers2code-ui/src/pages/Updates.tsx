import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchLatestUpdates } from '@/services/updatesApi';
import type { UpdateItem } from '@/types/update';

const Updates: React.FC = () => {
  const [items, setItems] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await fetchLatestUpdates();
        setItems(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-foreground mb-4">Updates</h1>
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse p-4 rounded border border-border/40 bg-card/40">
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No updates yet</div>
        ) : (
          <div className="space-y-3">
            {items.map((u) => (
              <div
                key={u.id}
                className="p-4 rounded border border-border/40 bg-card/40 hover:bg-card/60 cursor-pointer"
                onClick={() => navigate(`/updates/${encodeURIComponent(u.id)}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-medium text-foreground">{u.title}</h2>
                    {u.description && (
                      <p className="text-sm text-muted-foreground">{u.description}</p>
                    )}
                  </div>
                  {u.tag && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-muted/50 text-muted-foreground">{u.tag}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(u.date).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Updates;
