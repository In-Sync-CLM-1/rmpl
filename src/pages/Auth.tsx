import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate("/dashboard", { replace: true });
        } else {
          setCheckingSession(false);
        }
      } catch (error) {
        logError(error, {
          component: "Auth",
          operation: "CHECK_SESSION",
        });
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !z.string().email().safeParse(forgotEmail).success) {
      toast.error("Please enter a valid email address");
      return;
    }
    try {
      setSendingReset(true);
      const { error } = await supabase.functions.invoke("send-password-otp", {
        body: { email: forgotEmail },
      });
      if (error) throw error;
      setResetEmailSent(true);
      toast.success("Verification code sent to your email!");
    } catch (error: any) {
      toast.error(error.message || "Failed to send verification code");
    } finally {
      setSendingReset(false);
    }
  };

  const handleCloseForgotPassword = () => {
    setShowForgotPassword(false);
    setResetEmailSent(false);
    setForgotEmail("");
  };

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
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(loginData.email);
                  setShowForgotPassword(true);
                }}
                className="text-xs text-[#0397d5] hover:underline"
              >
                Forgot password?
              </button>
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

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={handleCloseForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {resetEmailSent
                ? "Check your email for the 6-digit verification code."
                : "Enter your email address and we'll send you a 6-digit verification code."}
            </DialogDescription>
          </DialogHeader>

          {!resetEmailSent ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="your@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  disabled={sendingReset}
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={handleCloseForgotPassword} disabled={sendingReset}>
                  Cancel
                </Button>
                <Button type="submit" disabled={sendingReset}>
                  {sendingReset ? "Sending..." : "Send Verification Code"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Check your email for the 6-digit code, then click below to reset your password.
              </p>
              <DialogFooter className="flex-col gap-2 sm:gap-2">
                <Button
                  onClick={() => {
                    handleCloseForgotPassword();
                    navigate("/reset-password", { state: { email: forgotEmail } });
                  }}
                  className="w-full"
                >
                  Enter Verification Code
                </Button>
                <Button variant="outline" onClick={handleCloseForgotPassword} className="w-full">
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}