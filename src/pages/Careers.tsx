import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, Briefcase, ChevronRight, Users, Code, Palette, TrendingUp, Mail } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CONTACT_CONFIG } from '@/config/contact';

// Full job listings with details
const jobs = [
  {
    id: '1',
    title: 'Senior Frontend Engineer',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    description: 'Build beautiful, performant interfaces for our travel platform.',
    fullDescription: `We're looking for a Senior Frontend Engineer to help build the future of travel planning. You'll work closely with our design and product teams to create delightful user experiences that help millions of travelers plan their dream trips.`,
    responsibilities: [
      'Build and maintain high-quality React components and features',
      'Collaborate with designers to implement pixel-perfect UIs',
      'Optimize application performance and user experience',
      'Mentor junior engineers and conduct code reviews',
      'Contribute to architectural decisions and technical strategy',
    ],
    requirements: [
      '5+ years of experience with React and TypeScript',
      'Strong understanding of modern CSS and responsive design',
      'Experience with state management (Redux, Zustand, etc.)',
      'Familiarity with testing frameworks (Jest, Playwright)',
      'Excellent communication and collaboration skills',
    ],
  },
  {
    id: '2',
    title: 'Product Designer',
    department: 'Product & Design',
    location: 'Remote',
    type: 'Full-time',
    description: 'Design intuitive experiences that delight travelers worldwide.',
    fullDescription: `Join our design team to craft beautiful, intuitive experiences for our travel planning platform. You'll own the end-to-end design process, from research and ideation to high-fidelity prototypes and production-ready designs.`,
    responsibilities: [
      'Lead design for key product areas and features',
      'Conduct user research and usability testing',
      'Create wireframes, prototypes, and high-fidelity designs',
      'Collaborate with engineering to ensure design quality',
      'Contribute to and evolve our design system',
    ],
    requirements: [
      '4+ years of product design experience',
      'Strong portfolio demonstrating UX and visual design skills',
      'Proficiency with Figma and prototyping tools',
      'Experience with user research methodologies',
      'Understanding of accessibility standards',
    ],
  },
  {
    id: '3',
    title: 'ML Engineer',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    description: 'Develop AI models that power personalized travel recommendations.',
    fullDescription: `We're building an AI-first travel platform and need an ML Engineer to help develop and deploy the models that power our personalized recommendations. You'll work on everything from natural language processing to recommendation systems.`,
    responsibilities: [
      'Design and implement ML models for travel recommendations',
      'Build and maintain ML infrastructure and pipelines',
      'Collaborate with product to identify ML opportunities',
      'Analyze data to improve model performance',
      'Stay current with ML/AI research and best practices',
    ],
    requirements: [
      '4+ years of ML engineering experience',
      'Strong Python and ML framework expertise (PyTorch, TensorFlow)',
      'Experience with NLP and recommendation systems',
      'Understanding of ML ops and model deployment',
      'MS or PhD in Computer Science or related field preferred',
    ],
  },
  {
    id: '4',
    title: 'Growth Marketing Manager',
    department: 'Marketing',
    location: 'Remote',
    type: 'Full-time',
    description: 'Drive user acquisition and engagement through creative campaigns.',
    fullDescription: `We're looking for a Growth Marketing Manager to lead our user acquisition and retention efforts. You'll develop and execute strategies that drive sustainable growth while building our brand presence in the travel industry.`,
    responsibilities: [
      'Develop and execute multi-channel marketing campaigns',
      'Manage paid acquisition across social, search, and display',
      'Analyze campaign performance and optimize for ROI',
      'Collaborate with product on growth experiments',
      'Build and manage relationships with travel influencers',
    ],
    requirements: [
      '4+ years of growth marketing experience',
      'Experience with paid social and performance marketing',
      'Strong analytical skills and data-driven mindset',
      'Excellent written and verbal communication',
      'Travel industry experience a plus',
    ],
  },
];

const departments = [
  { id: 'all', name: 'All Departments', icon: Users },
  { id: 'Engineering', name: 'Engineering', icon: Code },
  { id: 'Product & Design', name: 'Product & Design', icon: Palette },
  { id: 'Marketing', name: 'Marketing', icon: TrendingUp },
];

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
  fullDescription: string;
  responsibilities: string[];
  requirements: string[];
}

export default function Careers() {
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const filteredJobs = selectedDepartment === 'all'
    ? jobs
    : jobs.filter(job => job.department === selectedDepartment);

  const handleApply = (job: Job) => {
    const subject = encodeURIComponent(`Application for ${job.title}`);
    const body = encodeURIComponent(`Hi Voyance Team,\n\nI'm interested in applying for the ${job.title} position.\n\n[Please attach your resume and include a brief introduction about yourself]\n\nBest regards`);
    window.location.href = `mailto:${CONTACT_CONFIG.CAREERS_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <MainLayout>
      <Head
        title="Careers | Voyance"
        description="Join the Voyance team and help us redefine travel planning with AI."
      />
      
      {/* Hero */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4"
          >
            We're Hiring
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4"
          >
            Join Our Journey
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            We're building the future of travel. Come help us create experiences that inspire millions of travelers.
          </motion.p>
        </div>
      </section>
      
      {/* Department Filter */}
      <section className="py-8 border-b border-border">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {departments.map(dept => (
              <Button
                key={dept.id}
                variant={selectedDepartment === dept.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDepartment(dept.id)}
                className="gap-2"
              >
                <dept.icon className="h-4 w-4" />
                {dept.name}
              </Button>
            ))}
          </div>
        </div>
      </section>
      
      {/* Job Listings */}
      <section className="py-12">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-semibold text-foreground mb-8">
            Open Positions ({filteredJobs.length})
          </h2>
          <div className="space-y-4">
            {filteredJobs.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedJob(job)}
                className="group p-6 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                      {job.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-3">
                      {job.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        {job.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {job.type}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </motion.div>
            ))}
          </div>
          
          {filteredJobs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No positions available in this department right now.
            </div>
          )}
        </div>
      </section>
      
      {/* Culture Section */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-display font-bold text-foreground mb-4">
            Join a Growing Team
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            We're an early-stage startup building something meaningful. Join us and help shape how the world travels.
          </p>
          <Button variant="outline" size="lg" asChild>
            <a href={`mailto:${CONTACT_CONFIG.CAREERS_EMAIL}`}>
              <Mail className="h-4 w-4 mr-2" />
              Contact Careers Team
            </a>
          </Button>
        </div>
      </section>

      {/* Job Detail Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedJob.title}</DialogTitle>
                <DialogDescription asChild>
                  <div className="flex flex-wrap gap-3 mt-2">
                    <span className="flex items-center gap-1 text-sm">
                      <Briefcase className="h-4 w-4" />
                      {selectedJob.department}
                    </span>
                    <span className="flex items-center gap-1 text-sm">
                      <MapPin className="h-4 w-4" />
                      {selectedJob.location}
                    </span>
                    <span className="flex items-center gap-1 text-sm">
                      <Clock className="h-4 w-4" />
                      {selectedJob.type}
                    </span>
                  </div>
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 mt-4">
                <div>
                  <h4 className="font-semibold mb-2">About the Role</h4>
                  <p className="text-muted-foreground">{selectedJob.fullDescription}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Responsibilities</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    {selectedJob.responsibilities.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Requirements</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    {selectedJob.requirements.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="flex gap-3 pt-4 border-t">
                  <Button className="flex-1" onClick={() => handleApply(selectedJob)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Apply Now
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedJob(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
