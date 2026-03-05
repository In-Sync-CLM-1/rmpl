import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Loader2, Volume2, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceAssistant, VoiceState } from '@/hooks/useVoiceAssistant';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const VoiceAssistant = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const {
    state,
    currentText,
    responseText,
    error,
    startListening,
    stopListening,
    cancel
  } = useVoiceAssistant();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/');
        return;
      }
      setIsAuthenticated(true);
      setIsLoading(false);
    };
    
    checkAuth();
  }, [navigate]);

  const handleMicClick = async () => {
    if (state === 'listening') {
      await stopListening();
    } else if (state === 'idle' || state === 'error') {
      await startListening();
    }
  };

  const getStateMessage = (): string => {
    switch (state) {
      case 'idle':
        return 'Tap to speak';
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Thinking...';
      case 'speaking':
        return 'Speaking...';
      case 'error':
        return error || 'Something went wrong';
      default:
        return 'Tap to speak';
    }
  };

  const getStateColor = (): string => {
    switch (state) {
      case 'listening':
        return 'bg-red-500 hover:bg-red-600';
      case 'processing':
        return 'bg-amber-500 hover:bg-amber-600';
      case 'speaking':
        return 'bg-green-500 hover:bg-green-600';
      case 'error':
        return 'bg-destructive hover:bg-destructive/90';
      default:
        return 'bg-primary hover:bg-primary/90';
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Voice Assistant</h1>
        <div className="w-10" /> {/* Spacer for alignment */}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        {/* Animated rings around mic button */}
        <div className="relative">
          {/* Outer pulse ring */}
          <div 
            className={cn(
              "absolute inset-0 rounded-full transition-all duration-300",
              state === 'listening' && "animate-ping bg-red-400/30",
              state === 'speaking' && "animate-pulse bg-green-400/30"
            )}
            style={{ 
              width: '200px', 
              height: '200px',
              top: '-30px',
              left: '-30px'
            }}
          />
          
          {/* Middle ring */}
          <div 
            className={cn(
              "absolute rounded-full border-4 transition-all duration-300",
              state === 'listening' && "border-red-400/50 scale-110",
              state === 'speaking' && "border-green-400/50 scale-110",
              state === 'processing' && "border-amber-400/50 animate-pulse",
              state === 'idle' && "border-primary/20"
            )}
            style={{ 
              width: '170px', 
              height: '170px',
              top: '-15px',
              left: '-15px'
            }}
          />

          {/* Main mic button */}
          <button
            onClick={handleMicClick}
            disabled={state === 'processing' || state === 'speaking'}
            className={cn(
              "w-[140px] h-[140px] rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
              getStateColor(),
              "disabled:opacity-70 disabled:cursor-not-allowed",
              "focus:outline-none focus:ring-4 focus:ring-primary/30"
            )}
          >
            {state === 'processing' ? (
              <Loader2 className="h-16 w-16 text-white animate-spin" />
            ) : state === 'speaking' ? (
              <Volume2 className="h-16 w-16 text-white animate-pulse" />
            ) : state === 'listening' ? (
              <MicOff className="h-16 w-16 text-white" />
            ) : state === 'error' ? (
              <AlertCircle className="h-16 w-16 text-white" />
            ) : (
              <Mic className="h-16 w-16 text-white" />
            )}
          </button>
        </div>

        {/* State message */}
        <p className={cn(
          "text-lg font-medium transition-colors duration-300",
          state === 'error' && "text-destructive",
          state === 'listening' && "text-red-500",
          state === 'speaking' && "text-green-500",
          state === 'processing' && "text-amber-500"
        )}>
          {getStateMessage()}
        </p>

        {/* Current query text */}
        {currentText && (
          <div className="max-w-md text-center space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <p className="text-sm text-muted-foreground">You asked:</p>
            <p className="text-foreground font-medium">{currentText}</p>
          </div>
        )}

        {/* Response text (shown while speaking) */}
        {responseText && state === 'speaking' && (
          <div className="max-w-md text-center space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <p className="text-sm text-muted-foreground">Response:</p>
            <p className="text-foreground">{responseText}</p>
          </div>
        )}

        {/* Cancel button during processing */}
        {(state === 'processing' || state === 'speaking') && (
          <Button
            variant="outline"
            onClick={cancel}
            className="animate-in fade-in duration-300"
          >
            Cancel
          </Button>
        )}
      </div>

      {/* Footer hint */}
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Ask about payments, registrations, agent performance, or business metrics
        </p>
      </div>
    </div>
  );
};

export default VoiceAssistant;
