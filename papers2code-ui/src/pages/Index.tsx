import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BookOpen, TrendingUp, Users, ArrowRight } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-linear-to-br from-[hsl(var(--gradient-start))] to-[hsl(var(--gradient-end))]">
      {/* Hero Section */}
      <div className="flex items-center justify-center min-h-screen px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground">
              Research
              <span className="text-primary"> Platform</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              Discover, share, and collaborate on cutting-edge research with scholars worldwide
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => navigate('/dashboard')}
              className="text-lg px-8 py-6"
            >
              View Dashboard
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/papers')}
              className="text-lg px-8 py-6"
            >
              Browse Papers
              <BookOpen className="w-5 h-5 ml-2" />
            </Button>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            <div className="research-card p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Discover Trends</h3>
              <p className="text-sm text-muted-foreground">
                Stay updated with the latest research trends and breakthroughs in your field
              </p>
            </div>

            <div className="research-card p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Share Knowledge</h3>
              <p className="text-sm text-muted-foreground">
                Publish your research and contribute to the global scientific community
              </p>
            </div>

            <div className="research-card p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Collaborate</h3>
              <p className="text-sm text-muted-foreground">
                Connect with researchers and build meaningful academic partnerships
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
