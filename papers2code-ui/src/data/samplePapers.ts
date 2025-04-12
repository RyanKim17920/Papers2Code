import { Paper, ImplementationStatus, ImplementationStep, Author } from '../types/paper';

const sampleAuthors1: Author[] = [{ name: 'John Doe' }, { name: 'Jane Smith' }];
const sampleAuthors2: Author[] = [{ name: 'Alice Wonderland' }, { name: 'Bob The Builder' }];

const defaultSteps: () => ImplementationStep[] = () => [
    { id: 1, name: 'Contact Author', description: 'Email first author about open-sourcing.', status: 'pending' },
    { id: 2, name: 'Define Requirements', description: 'Outline key components, data, and metrics.', status: 'pending' },
    { id: 3, name: 'Implement Code', description: 'Develop the core algorithm and experiments.', status: 'pending' },
    { id: 4, name: 'Annotate & Explain (Optional)', description: 'Add detailed code comments linking to the paper.', status: 'pending' },
    { id: 5, name: 'Submit & Review', description: 'Submit code for review and potential merging.', status: 'pending' },
];

export const samplePapers: Paper[] = [
  {
    id: 'paper-1',
    pwcUrl: 'https://paperswithcode.com/paper/some-cool-new-gan',
    arxivId: '2301.12345',
    title: 'A Really Cool New GAN Architecture',
    abstract: 'This paper introduces a novel Generative Adversarial Network that achieves state-of-the-art results on image generation tasks by using a unique attention mechanism...',
    authors: sampleAuthors1,
    urlAbs: 'https://arxiv.org/abs/2301.12345',
    urlPdf: 'https://arxiv.org/pdf/2301.12345.pdf',
    date: '2023-01-15',
    proceeding: 'NeurIPS 2023',
    tasks: ['Image Generation', 'Generative Adversarial Networks'],
    isImplementable: true,
    implementationStatus: ImplementationStatus.NotStarted,
    implementationSteps: defaultSteps(),
  },
  {
    id: 'paper-2',
    pwcUrl: 'https://paperswithcode.com/paper/advanced-rl-technique',
    arxivId: '2302.05678',
    title: 'Advanced Reinforcement Learning Technique for Robotics',
    abstract: 'We propose a new RL algorithm that learns complex manipulation tasks much faster than previous methods. Tested on simulated and real robots...',
    authors: sampleAuthors2,
    urlAbs: 'https://arxiv.org/abs/2302.05678',
    urlPdf: 'https://arxiv.org/pdf/2302.05678.pdf',
    date: '2023-02-20',
    proceeding: 'ICLR 2024',
    tasks: ['Reinforcement Learning', 'Robotics'],
    isImplementable: true,
    implementationStatus: ImplementationStatus.DefiningRequirements,
    implementationSteps: [
        { id: 1, name: 'Contact Author', description: 'Email first author about open-sourcing.', status: 'completed' },
        { id: 2, name: 'Define Requirements', description: 'Outline key components, data, and metrics.', status: 'in-progress' },
        { id: 3, name: 'Implement Code', description: 'Develop the core algorithm and experiments.', status: 'pending' },
        { id: 4, name: 'Annotate & Explain (Optional)', description: 'Add detailed code comments linking to the paper.', status: 'pending' },
        { id: 5, name: 'Submit & Review', description: 'Submit code for review and potential merging.', status: 'pending' },
    ],
  },
  {
    id: 'paper-3',
    pwcUrl: 'https://paperswithcode.com/paper/theoretical-cs-proof',
    arxivId: '2303.11223',
    title: 'A Theoretical Proof Regarding Complexity Classes',
    abstract: 'This paper presents a purely theoretical proof concerning the relationship between P and NP...',
    authors: [{ name: 'Theoretical Physicist' }],
    urlAbs: 'https://arxiv.org/abs/2303.11223',
    urlPdf: 'https://arxiv.org/pdf/2303.11223.pdf',
    date: '2023-03-10',
    proceeding: 'STOC 2023',
    tasks: ['Complexity Theory'],
    isImplementable: false, // Marked as not implementable
    implementationStatus: ImplementationStatus.NotStarted, // Status might not matter if not implementable
    implementationSteps: defaultSteps(),
  },
   {
    id: 'paper-4',
    pwcUrl: 'https://paperswithcode.com/paper/author-declined-but-interesting',
    arxivId: '2304.44556',
    title: 'Interesting Method Where Author Declined Open Source',
    abstract: 'Describes a novel approach to sequence modeling. Author was contacted but prefers not to release the code at this time.',
    authors: [{ name: 'Reluctant Researcher' }],
    urlAbs: 'https://arxiv.org/abs/2304.44556',
    urlPdf: 'https://arxiv.org/pdf/2304.44556.pdf',
    date: '2023-04-01',
    proceeding: 'ACL 2023',
    tasks: ['Sequence Modeling', 'Natural Language Processing'],
    isImplementable: true,
    implementationStatus: ImplementationStatus.AuthorDeclined, // Specific status
    implementationSteps: [
        { id: 1, name: 'Contact Author', description: 'Email first author about open-sourcing.', status: 'completed' }, // Assume completed, result was 'no'
        { id: 2, name: 'Define Requirements', description: 'Outline key components, data, and metrics.', status: 'pending' }, // Community can still do this
        { id: 3, name: 'Implement Code', description: 'Develop the core algorithm and experiments.', status: 'pending' },
        { id: 4, name: 'Annotate & Explain (Optional)', description: 'Add detailed code comments linking to the paper.', status: 'pending' },
        { id: 5, name: 'Submit & Review', description: 'Submit code for review and potential merging.', status: 'pending' },
    ],
  },
];

// Simulate fetching data (replace with actual API call later)
export const fetchPapers = (): Promise<Paper[]> => {
    console.log("Fetching papers (using sample data)...");
    return new Promise(resolve => {
        setTimeout(() => {
            // Filter out non-implementable papers by default for the main list? Or provide a filter option.
            // Let's show implementable ones by default on the main list page.
            resolve(samplePapers.filter(p => p.isImplementable));
            // To fetch ALL papers including non-implementable:
            // resolve(samplePapers);
        }, 500); // Simulate network delay
    });
};

export const fetchPaperById = (id: string): Promise<Paper | undefined> => {
    console.log(`Fetching paper ${id} (using sample data)...`);
     return new Promise(resolve => {
        setTimeout(() => {
            const paper = samplePapers.find(p => p.id === id);
            resolve(paper);
        }, 300); // Simulate network delay
    });
}

// --- Functions to simulate backend updates (replace with API calls) ---

// Example: Update step status
export const updateStepStatus = async (paperId: string, stepId: number, newStatus: ImplementationStep['status']): Promise<Paper | undefined> => {
     console.log(`Updating step ${stepId} for paper ${paperId} to ${newStatus} (simulated)`);
     // In a real app, this would be:
     // const response = await fetch(`/api/papers/${paperId}/steps/${stepId}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }), headers: {'Content-Type': 'application/json'} });
     // const updatedPaper = await response.json();
     // return updatedPaper;

     // Simulation: Find paper, find step, update, return updated paper
     const paperIndex = samplePapers.findIndex(p => p.id === paperId);
     if (paperIndex === -1) return undefined;

     const stepIndex = samplePapers[paperIndex].implementationSteps.findIndex(s => s.id === stepId);
     if (stepIndex === -1) return samplePapers[paperIndex]; // Step not found, return original paper

     // Basic update
     samplePapers[paperIndex].implementationSteps[stepIndex].status = newStatus;

     // Basic logic to update overall status (could be more complex)
     const steps = samplePapers[paperIndex].implementationSteps;
     if (steps.every(s => s.status === 'completed' || s.status === 'skipped')) {
         samplePapers[paperIndex].implementationStatus = ImplementationStatus.Completed;
     } else if (steps.find(s => s.status === 'in-progress' || s.status === 'completed')) {
         // Very basic guess at progress based on step IDs and status
         if (steps.find(s => s.id === 4 && (s.status === 'in-progress' || s.status === 'completed'))) {
            samplePapers[paperIndex].implementationStatus = ImplementationStatus.AnnotatingCode;
         } else if (steps.find(s => s.id === 3 && (s.status === 'in-progress' || s.status === 'completed'))) {
            samplePapers[paperIndex].implementationStatus = ImplementationStatus.ImplementationInProgress;
         } else if (steps.find(s => s.id === 2 && (s.status === 'in-progress' || s.status === 'completed'))) {
            samplePapers[paperIndex].implementationStatus = ImplementationStatus.DefiningRequirements;
         } else if (steps.find(s => s.id === 1 && s.status === 'completed')) {
             // Check if author declined from specific status or just completed contact
             if (samplePapers[paperIndex].implementationStatus !== ImplementationStatus.AuthorDeclined) {
                samplePapers[paperIndex].implementationStatus = ImplementationStatus.ContactingAuthor; // Or move to Defining Req?
             }
         }
     } else {
        if (samplePapers[paperIndex].implementationStatus !== ImplementationStatus.AuthorDeclined) {
            samplePapers[paperIndex].implementationStatus = ImplementationStatus.NotStarted;
        }
     }


     // Return a copy to simulate immutability
     return { ...samplePapers[paperIndex] };
}

// Example: Flag paper as not implementable
export const flagPaperImplementability = async (paperId: string, isImplementable: boolean): Promise<Paper | undefined> => {
    console.log(`Setting implementability for paper ${paperId} to ${isImplementable} (simulated)`);
    // Real API call:
    // const response = await fetch(`/api/papers/${paperId}/implementability`, { method: 'PUT', body: JSON.stringify({ isImplementable }), headers: {'Content-Type': 'application/json'} });
    // const updatedPaper = await response.json();
    // return updatedPaper;

    // Simulation:
    const paperIndex = samplePapers.findIndex(p => p.id === paperId);
    if (paperIndex === -1) return undefined;

    samplePapers[paperIndex].isImplementable = isImplementable;
    // Maybe reset status if marked as not implementable?
    // if (!isImplementable) {
    //    samplePapers[paperIndex].implementationStatus = ImplementationStatus.NotStarted;
    //    samplePapers[paperIndex].implementationSteps = samplePapers[paperIndex].implementationSteps.map(s => ({ ...s, status: 'skipped' }));
    // }

    return { ...samplePapers[paperIndex] }; // Return copy
}