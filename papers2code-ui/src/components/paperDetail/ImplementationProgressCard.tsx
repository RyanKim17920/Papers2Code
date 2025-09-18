import React, { useState } from 'react';
import { Code, ChevronDown, ChevronUp, Users, GitBranch } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ImplementationProgressTab } from './Tabs/ImplementationProgress/ImplementationProgressTab';
import type { ImplementationProgress } from '../../common/types/implementation';
import type { UserProfile } from '../../common/types/user';

interface ImplementationProgressCardProps {
    progress: ImplementationProgress;
    paperId: string;
    currentUser: UserProfile | null;
    onImplementationProgressChange: (progress: ImplementationProgress) => Promise<void>;
}

const ImplementationProgressCard: React.FC<ImplementationProgressCardProps> = ({
    progress,
    paperId,
    currentUser,
    onImplementationProgressChange
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const getStatusColor = (emailStatus: string) => {
        switch (emailStatus) {
            case 'Code Uploaded': 
            case 'Response Received': return 'bg-green-500/10 text-green-700 border-green-500/20';
            case 'Sent': return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
            case 'Not Sent': return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
            case 'No Response':
            case 'Refused to Upload': return 'bg-red-500/10 text-red-700 border-red-500/20';
            default: return 'bg-muted/50 text-muted-foreground border-border';
        }
    };

    return (
        <Card className="bg-card/70 backdrop-blur border border-border/60">
            <CardContent className="p-6">
                <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <Code className="w-5 h-5 text-primary" />
                            Implementation Progress
                        </h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-1 h-auto"
                        >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </Button>
                    </div>

                    {/* Compact Summary */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users size={14} className="text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                    {progress.contributors?.length || 0} contributors
                                </span>
                            </div>
                            <Badge 
                                variant="outline" 
                                className={`text-xs ${getStatusColor(progress.emailStatus)}`}
                            >
                                {progress.emailStatus || 'Not Sent'}
                            </Badge>
                        </div>

                        {progress.githubRepoId && (
                            <div className="flex items-center gap-2">
                                <GitBranch size={14} className="text-muted-foreground" />
                                <span className="text-sm text-primary truncate max-w-[200px]">
                                    Repository Connected
                                </span>
                            </div>
                        )}

                        <div className="text-sm text-muted-foreground">
                            Started {new Date(progress.createdAt).toLocaleDateString()}
                        </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                        <div className="border-t border-border/60 pt-4 mt-4">
                            <ImplementationProgressTab 
                                progress={progress}
                                paperId={paperId}
                                currentUser={currentUser}
                                onImplementationProgressChange={onImplementationProgressChange}
                            />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default ImplementationProgressCard;