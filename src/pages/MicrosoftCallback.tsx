import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function MicrosoftCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const redirectPath = searchParams.get("redirect_path");

    if (success === "true") {
      setStatus("success");
      setTimeout(() => {
        navigate(redirectPath || "/my-profile", { replace: true });
      }, 2000);
    } else if (error) {
      setStatus("error");
      setErrorMessage(decodeURIComponent(error));
    } else {
      setStatus("error");
      setErrorMessage("Unknown callback state");
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Microsoft Outlook Connection</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Processing connection...</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-center font-medium">Outlook connected successfully!</p>
              <p className="text-sm text-muted-foreground">Redirecting...</p>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-center font-medium">Connection Failed</p>
              <p className="text-sm text-muted-foreground text-center">{errorMessage}</p>
              <Button onClick={() => navigate("/my-profile", { replace: true })}>
                Back to Profile
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
