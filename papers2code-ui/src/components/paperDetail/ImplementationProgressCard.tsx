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
            <CardContent className="p-2 space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1">
                        <Code className="w-3 h-3 text-primary" />
                        Progress
                    </h3>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="h-5 w-5 p-0"
                    >
                        {isExpanded ? <ChevronUp className="h-2 w-2" /> : <ChevronDown className="h-2 w-2" />}
                    </Button>
                </div>

                {/* Always show basic info */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Status</span>
                        <Badge 
                            variant="outline" 
                            className={`text-xs h-4 px-1 ${getStatusColor(progress.status)}`}
                        >
                            {progress.status || 'Started'}
                        </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Contributors</span>
                        <span className="font-medium">{progress.contributors?.length || 0}</span>
                    </div>

                    {progress.githubRepoId && (
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Repository</span>
                            <GitBranch size={10} className="text-primary" />
                        </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                        Started {new Date(progress.createdAt).toLocaleDateString()}
                    </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="border-t border-border/60 pt-2">
                        <ImplementationProgressTab 
                            progress={progress}
                            paperId={paperId}
                            currentUser={currentUser}
                            onImplementationProgressChange={onImplementationProgressChange}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ImplementationProgressCard;