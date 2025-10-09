import React, { useState } from 'react';
import { Code, ChevronDown, ChevronUp, Users, GitBranch } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ImplementationProgressTab } from './Tabs/ImplementationProgress/ImplementationProgressTab';
import type { ImplementationProgress } from '../../common/types/implementation';
import type { UserProfile } from '../../common/types/user';
import { getStatusColorClasses } from '../../common/utils/statusUtils';

interface ImplementationProgressCardProps {
    progress: ImplementationProgress;
    paperId: string;
    paperStatus: string; // The paper's overall status (from paper.status field)
    currentUser: UserProfile | null;
    onImplementationProgressChange: (progress: ImplementationProgress) => Promise<void>;
    onRefreshPaper: () => Promise<void>; // Function to refresh paper data
}

const ImplementationProgressCard: React.FC<ImplementationProgressCardProps> = ({
    progress,
    paperId,
    paperStatus,
    currentUser,
    onImplementationProgressChange,
    onRefreshPaper
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

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
                            className={`text-xs h-4 px-1 ${getStatusColorClasses(paperStatus)}`}
                        >
                            {paperStatus || 'Not Started'}
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
                            paperStatus={paperStatus}
                            currentUser={currentUser}
                            onImplementationProgressChange={onImplementationProgressChange}
                            onRefreshPaper={onRefreshPaper}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ImplementationProgressCard;