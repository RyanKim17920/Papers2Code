import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchLatestUpdates } from '@/services/updatesApi';
import type { UpdateItem } from '@/types/update';

const UpdateDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<UpdateItem[] | null>(null);

  useEffect(() => {
    (async () => {
      const data = await fetchLatestUpdates();
      setItems(data);
    })();
  }, []);

  const update = useMemo(() => items?.find(u => String(u.id) === String(id)), [items, id]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <button className="text-sm text-primary mb-4" onClick={() => navigate(-1)}>
          ← Back
        </button>
        {!items ? (
          <div className="space-y-3">
            <div className="h-6 w-2/3 bg-muted rounded animate-pulse" />
            <div className="h-4 w-full bg-muted rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
          </div>
        ) : !update ? (
          <div className="text-sm text-muted-foreground">Update not found.</div>
        ) : (
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">{update.title}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(update.date).toLocaleString()} {update.tag ? `• ${update.tag}` : ''}
            </p>
            {update.description && (
              <p className="text-base text-foreground mt-2">{update.description}</p>
            )}
            {/* Placeholder: later we can render rich content, markdown, etc. */}
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdateDetail;
