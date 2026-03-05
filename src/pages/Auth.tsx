import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Mail, Lock } from "lucide-react";
import { z } from "zod";
import opmLoginBg from "@/assets/opm-login-bg.png";
import { logError, getSupabaseErrorMessage } from "@/lib/errorLogger";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Auth() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loginData, setLoginData] = useState({ email: "", password: "" });

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard", { replace: true });
      } else {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, [navigate]);

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0397d5]" />
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      loginSchema.parse(loginData);
      setIsLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) throw error;

      if (data.user) {
        toast.success("Welcome back!");
        navigate("/dashboard");
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        logError(error, {
          component: "Auth",
          operation: "VALIDATE_FORM",
          metadata: { action: "login", field: error.errors[0].path.join(".") },
        });
        toast.error(error.errors[0].message);
      } else {
        logError(error, {
          component: "Auth",
          operation: "AUTH_LOGIN",
          metadata: { email: loginData.email },
        });
        toast.error(getSupabaseErrorMessage(error));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center lg:justify-end p-6 lg:pr-24 relative"
      style={{ backgroundImage: `url(${opmLoginBg})` }}
    >
      {/* Subtle overlay to enhance readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/5 via-black/3 to-black/5" />
      
      <Card className="w-full max-w-[360px] bg-white/95 dark:bg-card/95 shadow-sm border border-border relative z-10">
        <CardHeader className="text-center pb-4 pt-6">
          <CardTitle className="text-2xl font-bold gradient-text-primary tracking-tight">
            Login
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-xs font-semibold text-foreground">Email Address</Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0397d5]/60 group-hover:text-[#0397d5] transition-colors" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="your@email.com"
                  className="pl-10 h-10 text-sm border border-border hover:border-[#0397d5]/50 focus:border-[#0397d5] transition-all duration-300"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="text-xs font-semibold text-foreground">Password</Label>
              <div className="relative group">
                <PasswordInput
                  id="login-password"
                  className="h-10 text-sm border border-border hover:border-[#0397d5]/50 focus:border-[#0397d5] transition-all duration-300"
                  leftIcon={<Lock className="w-4 h-4 text-[#0397d5]/60 group-hover:text-[#0397d5] transition-colors" />}
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full h-10 bg-[#0397d5] hover:bg-[#0397d5]/90 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-300" 
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-1.5 px-6 pb-5">
          <div className="w-full h-px bg-gradient-to-r from-transparent via-[#0397d5]/30 to-transparent my-1" />
          <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
            By continuing, you agree to our <span className="text-[#0397d5] font-medium">Terms of Service</span> and <span className="text-[#0397d5] font-medium">Privacy Policy</span>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}