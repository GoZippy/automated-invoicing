import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { 
  FileText, 
  Zap, 
  MessageSquare, 
  BarChart3, 
  Shield, 
  Clock,
  ArrowRight,
  CheckCircle
} from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <FileText className="h-6 w-6" />
              <span className="font-bold">Intelligent Invoicing</span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
            <nav className="flex items-center space-x-6">
              <Link href="/features" className="text-sm font-medium transition-colors hover:text-primary">
                Features
              </Link>
              <Link href="/pricing" className="text-sm font-medium transition-colors hover:text-primary">
                Pricing
              </Link>
              <Link href="/about" className="text-sm font-medium transition-colors hover:text-primary">
                About
              </Link>
            </nav>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Invoice Management{' '}
                  <span className="gradient-text">Powered by AI</span>
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-600 md:text-xl dark:text-gray-400">
                  Transform your invoice processing with intelligent automation. 
                  Upload, extract, and manage invoices through natural conversation.
                </p>
              </div>
              <div className="space-x-4">
                <Button size="lg" asChild>
                  <Link href="/register">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/demo">Watch Demo</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-gray-50 dark:bg-gray-900">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Everything You Need
              </h2>
              <p className="mt-4 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                Streamline your invoice management with powerful features designed for modern businesses.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <Card className="p-6">
                <Zap className="h-12 w-12 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">AI-Powered Extraction</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Automatically extract invoice data with 90% accuracy using advanced AI models.
                </p>
              </Card>
              <Card className="p-6">
                <MessageSquare className="h-12 w-12 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Natural Language Interface</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Query your invoices using plain English. No complex searches needed.
                </p>
              </Card>
              <Card className="p-6">
                <BarChart3 className="h-12 w-12 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Real-time Analytics</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Get instant insights into revenue, trends, and payment status.
                </p>
              </Card>
              <Card className="p-6">
                <Shield className="h-12 w-12 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Bank-Level Security</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Your data is encrypted and protected with enterprise-grade security.
                </p>
              </Card>
              <Card className="p-6">
                <Clock className="h-12 w-12 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Save 90% Time</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Reduce manual data entry and focus on growing your business.
                </p>
              </Card>
              <Card className="p-6">
                <FileText className="h-12 w-12 mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Smart Organization</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Automatically categorize and organize invoices for easy retrieval.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20">
          <div className="container px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-2 items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl mb-4">
                  Why Choose Intelligent Invoicing?
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-500 mt-0.5" />
                    <div>
                      <h3 className="font-semibold">90% Accuracy</h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Industry-leading accuracy in data extraction and processing.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-500 mt-0.5" />
                    <div>
                      <h3 className="font-semibold">Real-time Processing</h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Process invoices instantly with immediate results.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-500 mt-0.5" />
                    <div>
                      <h3 className="font-semibold">Seamless Integration</h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Connect with your existing accounting and business tools.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-6 w-6 text-green-500 mt-0.5" />
                    <div>
                      <h3 className="font-semibold">24/7 Support</h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Get help whenever you need it with our dedicated support team.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-video rounded-lg bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                  <p className="text-gray-500">Demo Video Placeholder</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-primary text-primary-foreground">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Ready to Transform Your Invoice Management?
              </h2>
              <p className="mx-auto max-w-[600px] text-primary-foreground/90 md:text-xl">
                Join thousands of businesses saving time and money with Intelligent Invoicing.
              </p>
              <div className="space-x-4">
                <Button size="lg" variant="secondary" asChild>
                  <Link href="/register">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="bg-transparent text-primary-foreground border-primary-foreground hover:bg-primary-foreground hover:text-primary" asChild>
                  <Link href="/contact">Contact Sales</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container px-4 md:px-6">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <FileText className="h-6 w-6" />
                <span className="font-bold">Intelligent Invoicing</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                AI-powered invoice management for modern businesses.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/features" className="text-gray-600 dark:text-gray-400 hover:text-primary">Features</Link></li>
                <li><Link href="/pricing" className="text-gray-600 dark:text-gray-400 hover:text-primary">Pricing</Link></li>
                <li><Link href="/integrations" className="text-gray-600 dark:text-gray-400 hover:text-primary">Integrations</Link></li>
                <li><Link href="/roadmap" className="text-gray-600 dark:text-gray-400 hover:text-primary">Roadmap</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="text-gray-600 dark:text-gray-400 hover:text-primary">About</Link></li>
                <li><Link href="/blog" className="text-gray-600 dark:text-gray-400 hover:text-primary">Blog</Link></li>
                <li><Link href="/careers" className="text-gray-600 dark:text-gray-400 hover:text-primary">Careers</Link></li>
                <li><Link href="/contact" className="text-gray-600 dark:text-gray-400 hover:text-primary">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-primary">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-gray-600 dark:text-gray-400 hover:text-primary">Terms of Service</Link></li>
                <li><Link href="/security" className="text-gray-600 dark:text-gray-400 hover:text-primary">Security</Link></li>
                <li><Link href="/gdpr" className="text-gray-600 dark:text-gray-400 hover:text-primary">GDPR</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-gray-600 dark:text-gray-400">
            © 2024 Intelligent Invoicing. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}