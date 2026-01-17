import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { MapPin, Clock, Briefcase, ChevronRight, Users, Code, Palette, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

// Sample job postings
const jobs = [
  {
    id: '1',
    title: 'Senior Frontend Engineer',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    description: 'Build beautiful, performant interfaces for our travel platform.',
  },
  {
    id: '2',
    title: 'Product Designer',
    department: 'Product & Design',
    location: 'San Francisco, CA',
    type: 'Full-time',
    description: 'Design intuitive experiences that delight travelers worldwide.',
  },
  {
    id: '3',
    title: 'ML Engineer',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    description: 'Develop AI models that power personalized travel recommendations.',
  },
  {
    id: '4',
    title: 'Growth Marketing Manager',
    department: 'Marketing',
    location: 'New York, NY',
    type: 'Full-time',
    description: 'Drive user acquisition and engagement through creative campaigns.',
  },
];

const departments = [
  { id: 'all', name: 'All Departments', icon: Users },
  { id: 'Engineering', name: 'Engineering', icon: Code },
  { id: 'Product & Design', name: 'Product & Design', icon: Palette },
  { id: 'Marketing', name: 'Marketing', icon: TrendingUp },
];

export default function Careers() {
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  const filteredJobs = selectedDepartment === 'all'
    ? jobs
    : jobs.filter(job => job.department === selectedDepartment);

  return (
    <MainLayout>
      <Head
        title="Careers | Voyance"
        description="Join the Voyance team and help us redefine travel planning with AI."
      />
      
      {/* Hero */}
      <section className="pt-24 pb-16 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <div className="max-w-4xl mx-auto px-4 text-center">
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
            Why Voyance?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            We offer competitive salaries, equity, unlimited PTO, remote flexibility, and the chance to shape how the world travels.
          </p>
          <Button variant="outline" size="lg">
            Learn About Our Culture
          </Button>
        </div>
      </section>
    </MainLayout>
  );
}
