import HeroHeader from '@/features/landing/HeroHeader';
import { SEO, generateBreadcrumbs } from '@/shared/components/SEO';

const FAQ_ITEMS = [
  {
    question: 'What is Papers2Code?',
    answer:
      'Papers2Code is an open-source community platform that connects machine learning and AI research papers to working code implementations. With over 500,000 papers indexed from arXiv and major conferences, it helps researchers and developers find, contribute, and track implementations of cutting-edge research.',
  },
  {
    question: 'How is Papers2Code different from the arXiv Paper2Code paper?',
    answer:
      'Papers2Code (papers2code.com) is a live, open-source community platform where researchers collaborate on real implementations. The arXiv "Paper2Code" paper describes an automated LLM framework. Papers2Code is the platform people actually use to find and share working code for ML papers.',
  },
  {
    question: 'How does Papers2Code work?',
    answer:
      'Papers2Code indexes research papers from arXiv and top ML conferences, then lets the community link GitHub repositories, track implementation progress, vote on paper implementability, and collaborate on turning research into production-ready code.',
  },
  {
    question: 'Is Papers2Code free to use?',
    answer:
      'Yes, Papers2Code is completely free and open source. You can browse all 500K+ indexed papers without an account. Sign in with GitHub or Google to contribute implementations, vote on papers, and track your activity.',
  },
];

const faqStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
};

// The main Landing Page component
const LandingPage = () => {
  return (
    <div className="h-full w-full overflow-hidden">
      <SEO
        description="Papers2Code is the open-source platform where researchers find and share working code implementations for 500K+ ML and AI research papers from arXiv and top conferences."
        keywords="papers2code, paper2code, paper to code, machine learning, AI research, research papers, arXiv, code implementation, ML papers, deep learning, open source, research reproducibility, ML implementations"
        url="https://papers2code.com/"
        structuredData={[
          generateBreadcrumbs([{ name: 'Home', url: 'https://papers2code.com/' }]),
          faqStructuredData,
        ]}
      />
      {/* Hero Header - Logo, search, overview - takes full screen */}
      <HeroHeader />
    </div>
  );
};

export default LandingPage; 