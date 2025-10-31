import HeroHeader from '@/features/landing/HeroHeader';

// The main Landing Page component
const LandingPage = () => {
  return (
    <div className="h-full w-full overflow-hidden">
      {/* Hero Header - Logo, search, overview - takes full screen */}
      <HeroHeader />
    </div>
  );
};

export default LandingPage; 