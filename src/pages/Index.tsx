import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Users, Briefcase, BarChart3, CheckCircle2, Zap, Building2 } from "lucide-react";
import rmplLogo from "@/assets/rmpl-logo.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-blue/10 via-healthcare-teal/10 to-accent-purple/10">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <div className="flex items-center justify-center mb-6 cursor-pointer" onClick={() => navigate("/dashboard")} style={{ perspective: '1200px' }}>
            <img 
              src={rmplLogo} 
              alt="RMPL" 
              className="h-24 w-auto transition-all duration-500" 
              style={{
                filter: 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.3)) drop-shadow(0 8px 20px rgba(0, 0, 0, 0.2))',
                transform: 'rotateX(8deg) rotateY(-8deg) translateZ(25px)',
                transformStyle: 'preserve-3d',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'rotateX(-3deg) rotateY(3deg) translateZ(35px) scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'rotateX(8deg) rotateY(-8deg) translateZ(25px)';
              }}
            />
          </div>
          <p className="text-xl text-muted-foreground mb-8">
            Streamline your healthcare recruitment with powerful participant management, 
            intelligent campaigns, and seamless ATS integration
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/")} className="shadow-elegant">
              Get Started
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/")}>
              Sign In
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 mb-16">
          <div className="glass-card p-6 hover-lift">
            <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Participant Management</h3>
            <p className="text-muted-foreground">
              Organize and track healthcare professionals with advanced search, 
              filters, and custom fields
            </p>
          </div>

          <div className="glass-card p-6 hover-lift">
            <div className="p-3 rounded-lg bg-healthcare-teal/10 w-fit mb-4">
              <Briefcase className="h-6 w-6 text-healthcare-teal" />
            </div>
            <h3 className="text-xl font-bold mb-2">Campaign Builder</h3>
            <p className="text-muted-foreground">
              Create targeted email campaigns with beautiful templates
              and merge tags
            </p>
          </div>

          <div className="glass-card p-6 hover-lift">
            <div className="p-3 rounded-lg bg-accent-purple/10 w-fit mb-4">
              <BarChart3 className="h-6 w-6 text-accent-purple" />
            </div>
            <h3 className="text-xl font-bold mb-2">Analytics & Insights</h3>
            <p className="text-muted-foreground">
              Track campaign performance, open rates, clicks, and conversions 
              in real-time
            </p>
          </div>

          <div className="glass-card p-6 hover-lift">
            <div className="p-3 rounded-lg bg-success-green/10 w-fit mb-4">
              <CheckCircle2 className="h-6 w-6 text-success-green" />
            </div>
            <h3 className="text-xl font-bold mb-2">ExcelHire Integration</h3>
            <p className="text-muted-foreground">
            Seamless bidirectional sync with your ATS for projects, participants, 
            and applications
            </p>
          </div>

          <div className="glass-card p-6 hover-lift">
            <div className="p-3 rounded-lg bg-accent-orange/10 w-fit mb-4">
              <Zap className="h-6 w-6 text-accent-orange" />
            </div>
            <h3 className="text-xl font-bold mb-2">AI-Powered Search</h3>
            <p className="text-muted-foreground">
              Find the perfect participants using natural language queries and 
              intelligent recommendations
            </p>
          </div>

          <div className="glass-card p-6 hover-lift">
            <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Multi-User Collaboration</h3>
            <p className="text-muted-foreground">
              Role-based access control with team collaboration features for 
              seamless workflow
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center glass-card p-12 rounded-2xl">
          <h2 className="text-3xl font-bold mb-4">Ready to transform your recruitment?</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join healthcare staffing agencies using RMPL OPM to streamline their 
            recruitment process and place more participants faster
          </p>
          <Button size="lg" onClick={() => navigate("/")} className="shadow-elegant">
            Start Your Free Trial
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
