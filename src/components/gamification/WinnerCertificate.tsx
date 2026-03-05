import { useRef } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Download, Award, Star, Sparkles } from "lucide-react";
import { format } from "date-fns";
import rmplLogo from "@/assets/rmpl-logo.png";

interface WinnerCertificateProps {
  winnerName: string;
  teamName: string;
  monthYear: string;
  totalPoints: number;
}

export function WinnerCertificate({ 
  winnerName, 
  teamName, 
  monthYear, 
  totalPoints 
}: WinnerCertificateProps) {
  const certificateRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!certificateRef.current) return;

    // Using html2canvas for screenshot (would need to be added as dependency)
    // For now, we'll create a simple print dialog
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const certificateHtml = certificateRef.current.innerHTML;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Certificate - ${winnerName}</title>
          <style>
            body {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
              font-family: 'Nunito Sans', sans-serif;
            }
          </style>
        </head>
        <body>
          ${certificateHtml}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const monthDate = new Date(monthYear + '-01');
  const formattedMonth = format(monthDate, 'MMMM yyyy');

  return (
    <div className="space-y-4">
      <div
        ref={certificateRef}
        className="relative bg-gradient-to-br from-amber-50 via-white to-amber-50 border-8 border-double border-amber-400 rounded-xl p-8 shadow-2xl overflow-hidden"
        style={{ aspectRatio: '4/3', maxWidth: '600px', margin: '0 auto' }}
      >
        {/* Decorative corners */}
        <div className="absolute top-4 left-4">
          <Sparkles className="w-8 h-8 text-amber-400" />
        </div>
        <div className="absolute top-4 right-4">
          <Sparkles className="w-8 h-8 text-amber-400" />
        </div>
        <div className="absolute bottom-4 left-4">
          <Star className="w-8 h-8 text-amber-400 fill-amber-400" />
        </div>
        <div className="absolute bottom-4 right-4">
          <Star className="w-8 h-8 text-amber-400 fill-amber-400" />
        </div>

        {/* Content */}
        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
          {/* Logo */}
          <div className="mb-2">
            <img src={rmplLogo} alt="Logo" className="h-12 mx-auto" />
          </div>

          {/* Trophy */}
          <div className="relative">
            <Crown className="w-16 h-16 text-amber-500 fill-amber-500" />
            <div className="absolute -inset-4 bg-amber-400/20 rounded-full blur-xl -z-10" />
          </div>

          {/* Title */}
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-[0.3em] text-amber-600">
              Certificate of Achievement
            </p>
            <h2 className="text-3xl font-bold text-amber-700">
              Winner of the Month
            </h2>
          </div>

          {/* Month & Team */}
          <p className="text-lg text-muted-foreground">
            {formattedMonth} • {teamName}
          </p>

          {/* Winner Name */}
          <div className="py-4">
            <p className="text-4xl font-bold bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 bg-clip-text text-transparent">
              {winnerName}
            </p>
          </div>

          {/* Points */}
          <div className="flex items-center gap-2 bg-amber-100 px-4 py-2 rounded-full">
            <Award className="w-5 h-5 text-amber-600" />
            <span className="font-bold text-amber-700">{totalPoints} Points</span>
          </div>

          {/* Footer */}
          <p className="text-xs text-muted-foreground mt-4">
            Awarded for outstanding performance and dedication
          </p>
        </div>
      </div>

      <div className="flex justify-center">
        <Button onClick={handleDownload} className="gap-2">
          <Download className="w-4 h-4" />
          Download Certificate
        </Button>
      </div>
    </div>
  );
}
