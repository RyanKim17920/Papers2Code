import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Globe, Twitter, Linkedin, Calendar, Users, ThumbsUp, Rocket, Award, ExternalLink, Settings, Github, Cloud, FileText } from 'lucide-react';
import { UserAvatar, LoadingSpinner } from '@/shared/components';
import { fetchUserProfileFromApi, UserProfileResponse, voteOnPaperInApi, getUserProfileSettings, AuthenticationError, CsrfError } from '@/shared/services/api';
import { Paper } from '@/shared/types/paper';
import ModernPaperCard from '@/features/paper-list/ModernPaperCard';
import { formatJoinedDate, formatLastSeen } from '@/shared/utils/dateUtils';
import { ProfileSettingsTab } from '@/features/profile/ProfileSettingsTab';
import { getStatusColorClasses } from '@/shared/utils/statusUtils';
import { useModal } from '@/shared/contexts/ModalContext';
import { SEO } from '@/shared/components/SEO';

type TabType = 'overview' | 'upvoted' | 'contributing' | 'settings';

const ProfilePage: React.FC = () => {
  const { github_username } = useParams<{ github_username: string }>();
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [currentUserData, setCurrentUserData] = useState<UserProfileResponse | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showLoginPrompt } = useModal();

  // Helper function to update a paper in the profile data
  const updatePaperInProfileData = (updatedPaper: Paper) => {
    if (!profileData) return;
    
    setProfileData(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        upvotedPapers: prev.upvotedPapers.map(paper => 
          paper.id === updatedPaper.id ? updatedPaper : paper
        ),
        contributedPapers: prev.contributedPapers.map(paper => 
          paper.id === updatedPaper.id ? updatedPaper : paper
        )
      };
    });
  };

  // Vote handler for paper cards
  const handleVote = async (paperId: string, voteType: 'up' | 'none') => {
    // Check if user is logged in before attempting to vote
    if (!currentUserData) {
      showLoginPrompt("Please sign in to upvote papers.");
      return;
    }
    
    try {
      const updatedPaper = await voteOnPaperInApi(paperId, voteType);
      updatePaperInProfileData(updatedPaper);
    } catch (error) {
      console.error('Failed to vote on paper:', error);
      if (error instanceof AuthenticationError || error instanceof CsrfError) {
        showLoginPrompt("Please sign in to upvote papers.");
      }
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (!github_username) {
        setError('No username provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        // Load profile and current user data in parallel
        const [data, currentUser] = await Promise.all([
          fetchUserProfileFromApi(github_username),
          getUserProfileSettings().catch(() => null) // Don't fail if not logged in
        ]);
        
        if (data) {
          setProfileData(data);
          setCurrentUserData(currentUser);
        } else {
          setError('User not found');
        }
      } catch (err) {
        console.error('Failed to load user profile:', err);
        setError('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [github_username]);

  const handleProfileUpdate = async () => {
    // Reload both profile and current user data after update
    try {
      const [data, currentUser] = await Promise.all([
        fetchUserProfileFromApi(github_username!),
        getUserProfileSettings().catch(() => null)
      ]);
      
      if (data) {
        setProfileData(data);
        setCurrentUserData(currentUser);
      }
    } catch (err) {
      console.error('Failed to reload profile:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoadingSpinner />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 p-8 bg-card border border-border rounded-lg shadow-sm max-w-md">
          <h1 className="text-2xl font-bold text-foreground">Profile Not Found</h1>
          <p className="text-muted-foreground">{error}</p>
          <Link 
            to="/papers" 
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            ← Back to Papers
          </Link>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 p-8 bg-card border border-border rounded-lg shadow-sm max-w-md">
          <h1 className="text-2xl font-bold text-foreground">Profile Not Found</h1>
          <p className="text-muted-foreground">The user profile you're looking for doesn't exist.</p>
          <Link 
            to="/papers" 
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            ← Back to Papers
          </Link>
        </div>
      </div>
    );
  }

  const { userDetails, upvotedPapers, contributedPapers } = profileData;
  console.log('profileData:', profileData);
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-8">
            {/* Bio Section */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users size={20} />
                Bio
              </h3>
              <div className="text-sm text-muted-foreground">
                {userDetails.bio ? (
                  <p className="leading-relaxed">{userDetails.bio}</p>
                ) : (
                  <p className="italic">This user hasn't added a bio yet.</p>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Award size={20} />
                Recent Activity
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <h4 className="font-medium mb-3 sm:mb-4 flex items-center gap-2 text-sm">
                    <ThumbsUp size={16} />
                    Recent Upvotes
                  </h4>
                  <div className="space-y-2 sm:space-y-3">
                    {upvotedPapers.slice(0, 3).map(paper => (
                      <div key={paper.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2 sm:p-3 bg-background rounded-md border border-border/50 hover:border-border transition-colors gap-2">
                        <Link 
                          to={`/paper/${paper.id}`} 
                          className="text-xs sm:text-sm font-medium text-primary hover:underline flex-1 line-clamp-2 sm:truncate sm:mr-3"
                        >
                          {paper.title}
                        </Link>
                        <span className={`px-2 py-1 text-xs rounded-full font-medium whitespace-nowrap border self-start sm:self-auto ${getStatusColorClasses(paper.status)}`}>
                          {paper.status}
                        </span>
                      </div>
                    ))}
                    {upvotedPapers.length === 0 && (
                      <p className="text-muted-foreground text-xs sm:text-sm italic text-center py-4">No papers upvoted yet</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3 sm:mb-4 flex items-center gap-2 text-sm">
                    <Rocket size={16} />
                    Active Contributions
                  </h4>
                  <div className="space-y-2 sm:space-y-3">
                    {contributedPapers.slice(0, 3).map(paper => (
                      <div key={paper.id} className="flex items-center justify-between p-3 bg-background rounded-md border border-border/50 hover:border-border transition-colors">
                        <Link 
                          to={`/paper/${paper.id}`} 
                          className="text-sm font-medium text-primary hover:underline flex-1 truncate mr-3"
                        >
                          {paper.title}
                        </Link>
                        <span className={`px-2 py-1 text-xs rounded-full font-medium whitespace-nowrap border ${getStatusColorClasses(paper.status)}`}>
                          {paper.status}
                        </span>
                      </div>
                    ))}
                    {contributedPapers.length === 0 && (
                      <p className="text-muted-foreground text-sm italic text-center py-4">No active contributions yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'upvoted':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <ThumbsUp size={20} />
              <h2 className="text-xl font-semibold">Upvoted Papers ({upvotedPapers.length})</h2>
            </div>
            {upvotedPapers.length > 0 ? (
              <div className="space-y-4">
                {upvotedPapers.map(paper => (
                  <ModernPaperCard
                    key={paper.id}
                    paper={paper}
                    onVote={handleVote}
                    className="bg-card/70 backdrop-blur border border-border/60 hover:border-border/80 focus-within:ring-2 focus-within:ring-primary/30"
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-lg">
                    <div className="mb-4">
                      <FileText size={48} className="text-muted-foreground" />
                    </div>
                <h3 className="text-lg font-medium mb-2">No papers upvoted yet</h3>
                <p className="text-muted-foreground mb-4">Upvoted papers will appear here</p>
                <Link
                  to="/papers"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border/60 bg-card/60 hover:bg-card/80 text-foreground transition-colors shadow-sm"
                >
                  <ExternalLink size={16} className="text-muted-foreground" />
                  <span className="font-medium">Browse Papers</span>
                </Link>
              </div>
            )}
          </div>
        );

      case 'contributing':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Rocket size={20} />
              <h2 className="text-xl font-semibold">Contributing To ({contributedPapers.length})</h2>
            </div>
            {contributedPapers.length > 0 ? (
              <div className="space-y-4">
                {contributedPapers.map(paper => (
                  <ModernPaperCard
                    key={paper.id}
                    paper={paper}
                    onVote={handleVote}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-lg">
                    <div className="mb-4">
                      <Rocket size={48} className="text-muted-foreground" />
                    </div>
                <h3 className="text-lg font-medium mb-2">No active contributions</h3>
                <p className="text-muted-foreground mb-4">Projects you're contributing to will appear here</p>
                <Link
                  to="/papers"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border/60 bg-card/60 hover:bg-card/80 text-foreground transition-colors shadow-sm"
                >
                  <ExternalLink size={16} className="text-muted-foreground" />
                  <span className="font-medium">Browse Papers</span>
                </Link>
              </div>
            )}
          </div>
        );
      
      case 'settings':
        return currentUserData?.userDetails ? (
          <ProfileSettingsTab 
            currentUser={currentUserData.userDetails}
            onProfileUpdate={handleProfileUpdate}
          />
        ) : null;
      
      default:
        return null;
    }
  };

  console.log('Profile data:', profileData);
  
  // Check if current user is viewing their own profile
  const isOwnProfile = currentUserData?.userDetails?.username === userDetails.username;
  
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${userDetails.name || userDetails.username}'s Profile`}
        description={`View ${userDetails.name || userDetails.username}'s contributions and upvoted papers on Papers2Code.`}
        url={`https://papers2code.com/user/${userDetails.username}`}
        type="profile"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: userDetails.name || userDetails.username,
          url: `https://papers2code.com/user/${userDetails.username}`,
        }}
      />
      {/* Header Section with Avatar and Basic Info */}
      <div className="bg-gradient-to-br from-card via-card to-background border-b border-border">
        <div className="container mx-auto px-3 sm:px-6 py-8 sm:py-16">
          <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
            {/* Avatar with Glow Effect */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-md scale-110"></div>
              <UserAvatar 
                avatarUrl={userDetails.avatarUrl}
                username={userDetails.username}
                className="relative w-24 h-24 sm:w-32 sm:h-32 border-4 border-primary/30 shadow-2xl"
              />
            </div>
            
            {/* User Info */}
            <div className="text-center md:text-left space-y-3 sm:space-y-4">
              <div>
                <p className="text-muted-foreground text-xs sm:text-sm mb-1">@{userDetails.username}</p>
                <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2">
                  {userDetails.name || userDetails.username}
                </h1>
                <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground justify-center md:justify-start flex-wrap">
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    <span>{formatJoinedDate(userDetails.createdAt)}</span>
                  </div>
                  <span className="hidden sm:inline">•</span>
                  <span className="w-full sm:w-auto">{formatLastSeen(userDetails.lastLoginAt)}</span>
                </div>
              </div>
              
              {/* Badges */}
              <div className="flex gap-2 justify-center md:justify-start flex-wrap">
                {userDetails.isOwner && (
                  <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full font-medium">
                    OWNER
                  </span>
                )}
                {userDetails.isAdmin && (
                  <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full font-medium">
                    ADMIN
                  </span>
                )}
              </div>
              
              {/* Social Links */}
              {(userDetails.websiteUrl || userDetails.twitterProfileUrl || userDetails.linkedinProfileUrl || userDetails.blueskyUsername || userDetails.huggingfaceUsername || userDetails.githubId) && (
                <div className="flex gap-3 justify-center md:justify-start">
                  {userDetails.websiteUrl && (
                    <a 
                      href={userDetails.websiteUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-muted hover:bg-muted/80 rounded-md transition-colors"
                      title="Website"
                    >
                      <Globe size={16} />
                    </a>
                  )}
                  {userDetails.githubId && userDetails.githubUsername && (
                    <a 
                      href={`https://github.com/${userDetails.githubUsername}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-muted hover:bg-muted/80 rounded-md transition-colors"
                      title="GitHub"
                    >
                      <Github size={16} />
                    </a>
                  )}
                  {userDetails.twitterProfileUrl && (
                    <a 
                      href={userDetails.twitterProfileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-muted hover:bg-muted/80 rounded-md transition-colors"
                      title="Twitter/X"
                    >
                      <Twitter size={16} />
                    </a>
                  )}
                  {userDetails.linkedinProfileUrl && (
                    <a 
                      href={userDetails.linkedinProfileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-muted hover:bg-muted/80 rounded-md transition-colors"
                      title="LinkedIn"
                    >
                      <Linkedin size={16} />
                    </a>
                  )}
                  {userDetails.blueskyUsername && (
                    <a 
                      href={userDetails.blueskyUsername.startsWith('http') ? userDetails.blueskyUsername : `https://bsky.app/profile/${userDetails.blueskyUsername}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-muted hover:bg-muted/80 rounded-md transition-colors"
                      title="Bluesky"
                    >
                      <Cloud size={16} />
                    </a>
                  )}
                  {userDetails.huggingfaceUsername && (
                    <a 
                      href={userDetails.huggingfaceUsername.startsWith('http') ? userDetails.huggingfaceUsername : `https://huggingface.co/${userDetails.huggingfaceUsername}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 bg-muted hover:bg-muted/80 rounded-md transition-colors"
                      title="Hugging Face"
                    >
                      <Rocket size={16} />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="ml-auto flex gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-foreground">{upvotedPapers.length}</div>
                <div className="text-sm text-muted-foreground">Upvotes</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{contributedPapers.length}</div>
                <div className="text-sm text-muted-foreground">Contributions</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-6">
          <nav className="flex gap-1">
            <button 
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button 
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'upvoted' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('upvoted')}
            >
              Upvoted
              <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded-full">
                {upvotedPapers.length}
              </span>
            </button>
            <button 
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'contributing' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('contributing')}
            >
              Contributing
              <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded-full">
                {contributedPapers.length}
              </span>
            </button>
            {isOwnProfile && (
              <button 
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'settings' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setActiveTab('settings')}
              >
                <Settings size={16} />
                Settings
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;