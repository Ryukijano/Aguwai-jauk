import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BriefcaseIcon, 
  RocketIcon, 
  BrainIcon, 
  ChartBarIcon,
  CheckCircleIcon,
  StarIcon,
  ArrowRightIcon,
  GraduationCapIcon,
  MapPinIcon,
  ClockIcon,
  UsersIcon,
  TrendingUpIcon,
  ShieldCheckIcon
} from 'lucide-react';
import heroImage from '@/assets/images/Hero_section_teachers_classroom_8101a003.png';
import jobSearchIcon from '@/assets/images/Job_search_feature_icon_aeeaeef0.png';
import aiAssistantIcon from '@/assets/images/AI_assistant_feature_illustration_691f26a3.png';
import applicationTrackingIcon from '@/assets/images/Application_tracking_dashboard_ea8bfe73.png';
import bgPattern from '@/assets/images/Education_background_pattern_6634482c.png';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCapIcon className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-gray-900">Aguwai Jauk</h1>
              <Badge variant="secondary" className="ml-2">Teacher Portal</Badge>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/jobs">
                <Button variant="ghost" data-testid="nav-jobs">Jobs</Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" data-testid="nav-login">Login</Button>
              </Link>
              <Link href="/register">
                <Button data-testid="nav-register">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div 
          className="absolute inset-0 opacity-5"
          style={{ backgroundImage: `url(${bgPattern})`, backgroundRepeat: 'repeat' }}
        />
        <div className="container mx-auto px-4 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge className="inline-flex" variant="secondary">
                <TrendingUpIcon className="mr-1 h-3 w-3" />
                11+ Live Teaching Jobs Available
              </Badge>
              <h1 className="text-5xl font-bold text-gray-900 leading-tight">
                Find Your Dream Teaching Job in 
                <span className="text-primary"> Assam</span>
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                Connecting passionate educators with opportunities across government schools, colleges, and universities. 
                Powered by AI to match you with the perfect teaching position.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/register">
                  <Button size="lg" className="gap-2" data-testid="hero-cta">
                    Start Your Journey
                    <ArrowRightIcon className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/jobs">
                  <Button size="lg" variant="outline" data-testid="hero-browse">
                    Browse Jobs
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-6 pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-600">Government Verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheckIcon className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-gray-600">100% Free</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <img 
                src={heroImage} 
                alt="Teachers in classroom" 
                className="rounded-2xl shadow-2xl"
                data-testid="hero-image"
              />
              <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 rounded-full p-2">
                    <UsersIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">1,200+</div>
                    <div className="text-sm text-gray-600">Active Teachers</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-primary/5 py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">4,500+</div>
              <div className="text-gray-600 mt-2">Total Vacancies</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">27</div>
              <div className="text-gray-600 mt-2">Districts Covered</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">89%</div>
              <div className="text-gray-600 mt-2">Placement Rate</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">24/7</div>
              <div className="text-gray-600 mt-2">AI Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Land Your Dream Teaching Job
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our platform combines cutting-edge AI technology with comprehensive job listings 
              to help you find the perfect teaching position in Assam.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover:shadow-xl transition-shadow duration-300" data-testid="feature-search">
              <CardHeader className="text-center">
                <img 
                  src={jobSearchIcon} 
                  alt="Job Search" 
                  className="w-32 h-32 mx-auto mb-4 rounded-lg"
                />
                <CardTitle>Smart Job Search</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  Find teaching positions from government schools, colleges, and universities. 
                  Filter by location, subject, and experience level.
                </CardDescription>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircleIcon className="h-4 w-4 text-green-600" />
                    <span>Real-time job updates</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircleIcon className="h-4 w-4 text-green-600" />
                    <span>Government & private schools</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircleIcon className="h-4 w-4 text-green-600" />
                    <span>Automated job matching</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-shadow duration-300 border-primary" data-testid="feature-ai">
              <CardHeader className="text-center">
                <img 
                  src={aiAssistantIcon} 
                  alt="AI Assistant" 
                  className="w-32 h-32 mx-auto mb-4 rounded-lg"
                />
                <CardTitle>AI Career Assistant</CardTitle>
                <Badge className="mt-2">Most Popular</Badge>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  Get personalized guidance from our AI assistant. Resume analysis, 
                  interview preparation, and career advice tailored for teachers.
                </CardDescription>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircleIcon className="h-4 w-4 text-green-600" />
                    <span>Resume optimization</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircleIcon className="h-4 w-4 text-green-600" />
                    <span>Interview preparation</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircleIcon className="h-4 w-4 text-green-600" />
                    <span>24/7 availability</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-xl transition-shadow duration-300" data-testid="feature-track">
              <CardHeader className="text-center">
                <img 
                  src={applicationTrackingIcon} 
                  alt="Application Tracking" 
                  className="w-32 h-32 mx-auto mb-4 rounded-lg"
                />
                <CardTitle>Application Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  Keep track of all your job applications in one place. 
                  Monitor status, schedule interviews, and never miss a deadline.
                </CardDescription>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircleIcon className="h-4 w-4 text-green-600" />
                    <span>Status tracking</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircleIcon className="h-4 w-4 text-green-600" />
                    <span>Interview scheduler</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircleIcon className="h-4 w-4 text-green-600" />
                    <span>Deadline reminders</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Recent Jobs Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Latest Teaching Opportunities
            </h2>
            <p className="text-xl text-gray-600">
              Fresh job postings updated daily from verified sources
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card className="hover:shadow-lg transition-shadow" data-testid="job-card-1">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Assistant Teacher - Lower Primary</CardTitle>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <BriefcaseIcon className="h-4 w-4" />
                          DEE, Assam
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPinIcon className="h-4 w-4" />
                          Various Districts
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary">2900 Posts</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Government teaching positions for lower primary schools across Assam. 
                  B.Ed qualification required.
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <ClockIcon className="h-4 w-4" />
                    Posted 2 days ago
                  </span>
                  <Link href="/jobs/4">
                    <Button size="sm">View Details</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow" data-testid="job-card-2">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Post Graduate Teacher (PGT)</CardTitle>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <BriefcaseIcon className="h-4 w-4" />
                          DSE, Assam
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPinIcon className="h-4 w-4" />
                          All Districts
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary">1385 Posts</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Teaching positions for post graduate teachers in government schools. 
                  Masters degree with B.Ed required.
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <ClockIcon className="h-4 w-4" />
                    Posted 3 days ago
                  </span>
                  <Link href="/jobs/7">
                    <Button size="sm">View Details</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Link href="/jobs">
              <Button size="lg" variant="outline" className="gap-2">
                View All Jobs
                <ArrowRightIcon className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Success Stories from Teachers
            </h2>
            <p className="text-xl text-gray-600">
              Join thousands of teachers who found their dream jobs through our portal
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card data-testid="testimonial-1">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <CardTitle className="text-lg">Priya Sharma</CardTitle>
                <CardDescription>Mathematics Teacher, KV Guwahati</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 italic">
                  "The AI assistant helped me prepare for my interview perfectly. 
                  I got selected in my first attempt! The job listings are always updated."
                </p>
              </CardContent>
            </Card>

            <Card data-testid="testimonial-2">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <CardTitle className="text-lg">Rajesh Kumar</CardTitle>
                <CardDescription>Science Teacher, JNV Jorhat</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 italic">
                  "Found my dream job within 2 weeks of registration. The application 
                  tracking feature kept me organized throughout the process."
                </p>
              </CardContent>
            </Card>

            <Card data-testid="testimonial-3">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <CardTitle className="text-lg">Anita Devi</CardTitle>
                <CardDescription>English Teacher, DPS Guwahati</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 italic">
                  "The portal made job searching so easy! Real government job postings 
                  and excellent AI support for resume building."
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Ready to Start Your Teaching Career?
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Join Aguwai Jauk today and get access to exclusive teaching opportunities, 
            AI-powered career assistance, and more.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                Create Free Account
                <ArrowRightIcon className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/jobs">
              <Button size="lg" variant="outline">
                Browse Jobs First
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <GraduationCapIcon className="h-6 w-6" />
                <span className="text-xl font-bold">Aguwai Jauk</span>
              </div>
              <p className="text-gray-400">
                Empowering teachers to find their perfect teaching positions in Assam.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/jobs">Browse Jobs</Link></li>
                <li><Link href="/about">About Us</Link></li>
                <li><Link href="/contact">Contact</Link></li>
                <li><Link href="/privacy">Privacy Policy</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Job Categories</h3>
              <ul className="space-y-2 text-gray-400">
                <li>Primary Teacher</li>
                <li>Secondary Teacher</li>
                <li>Higher Secondary</li>
                <li>College Lecturer</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Stay Updated</h3>
              <p className="text-gray-400 mb-4">
                Get the latest teaching job updates directly in your inbox.
              </p>
              <Button className="w-full">Subscribe</Button>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Aguwai Jauk. All rights reserved. Made with ❤️ for Assam's Teachers</p>
          </div>
        </div>
      </footer>
    </div>
  );
}